import { Injectable, BadRequestException, NotFoundException, ConflictException, ForbiddenException, Logger } from '@nestjs/common';
import { JournalStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { JournalCacheService } from '../../infrastructure/journal/journal-cache.service';
import { CreateJournalEntryDto, JournalQueryDto, TrialBalanceQueryDto } from './dto/journal.dto';

// ─── Response Types ───────────────────────────────────────────────────────────

export interface TrialBalanceLine {
    accountId: string;
    accountCode: string;
    accountName: string;
    accountType: string;
    totalDebit: string;
    totalCredit: string;
    balance: string;
}

export interface TrialBalanceResult {
    lines: TrialBalanceLine[];
    totalDebit: string;
    totalCredit: string;
    isBalanced: boolean;
    asOfDate: Date;
    cachedAt?: string;
}

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class JournalService {
    private readonly logger = new Logger(JournalService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly cache: JournalCacheService,
    ) { }

    // ── 1. Post Manual Journal Entry ─────────────────────────────────────────

    async postManualEntry(tenantId: string, userId: string, dto: CreateJournalEntryDto) {
        return this.prisma.$transaction(async (tx) => {
            return this.postManualEntryWithTx(tx, tenantId, userId, dto);
        });
    }

    // ── Internal: post journal entry within an existing transaction ───────────

    async postManualEntryWithTx(
        tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0],
        tenantId: string,
        userId: string,
        dto: CreateJournalEntryDto,
    ) {
        // ── Validate: at least 2 lines ─────────────────────────────────
        if (!dto.lines || dto.lines.length < 2) {
            throw new BadRequestException('A journal entry must have at least 2 lines');
        }

        // ── Validate: no line has both debit and credit > 0 ────────────
        for (const line of dto.lines) {
            const hasDebit = Number(line.debit) > 0;
            const hasCredit = Number(line.credit) > 0;
            if (hasDebit && hasCredit) {
                throw new BadRequestException(
                    `Line for account ${line.accountId} has both debit and credit > 0. Each line must be exclusively debit or credit.`,
                );
            }
            if (!hasDebit && !hasCredit) {
                throw new BadRequestException(
                    `Line for account ${line.accountId} has zero debit and zero credit. Each line must have a positive amount.`,
                );
            }
        }

        // ── Validate: SUM(debit) == SUM(credit) ───────────────────────
        const totalDebit = dto.lines.reduce((sum, l) => sum + Number(l.debit), 0);
        const totalCredit = dto.lines.reduce((sum, l) => sum + Number(l.credit), 0);
        if (Math.abs(totalDebit - totalCredit) > 0.0001) {
            throw new BadRequestException(
                `Debit total (${totalDebit.toFixed(4)}) must equal credit total (${totalCredit.toFixed(4)})`,
            );
        }

        // ── Validate: all accounts exist, are postable, active, belong to tenant ─
        const accountIds = [...new Set(dto.lines.map((l) => l.accountId))];
        const accounts = await tx.account.findMany({
            where: { id: { in: accountIds } },
            select: { id: true, tenantId: true, isPostable: true, isActive: true, code: true, name: true },
        });

        if (accounts.length !== accountIds.length) {
            throw new NotFoundException('One or more accounts were not found');
        }

        for (const acc of accounts) {
            if (acc.tenantId !== tenantId) {
                throw new ForbiddenException(`Account ${acc.code} does not belong to your tenant`);
            }
            if (!acc.isActive) {
                throw new BadRequestException(`Account ${acc.code} (${acc.name}) is inactive and cannot be posted to`);
            }
            if (!acc.isPostable) {
                throw new BadRequestException(
                    `Account ${acc.code} (${acc.name}) is not postable. Only leaf accounts can receive journal postings.`,
                );
            }
        }

        // ── Create DRAFT entry ─────────────────────────────────────────
        const entry = await tx.journalEntry.create({
            data: {
                tenantId,
                description: dto.description,
                referenceType: dto.referenceType ?? 'MANUAL',
                referenceId: dto.referenceId ?? null,
                status: 'DRAFT',
                createdBy: userId,
                lines: {
                    create: dto.lines.map((l) => ({
                        accountId: l.accountId,
                        debit: l.debit,
                        credit: l.credit,
                        description: l.description ?? null,
                    })),
                },
            },
            include: { lines: true },
        });

        // ── Promote to POSTED atomically ───────────────────────────────
        const posted = await tx.journalEntry.update({
            where: { id: entry.id },
            data: { status: 'POSTED', postedAt: new Date() },
            include: {
                lines: {
                    include: {
                        account: { select: { code: true, name: true, type: true } },
                    },
                },
            },
        });

        // ── Invalidate trial balance cache ─────────────────────────────
        await this.cache.invalidate(tenantId);

        this.logger.log(`Journal entry posted: ${posted.id} for tenant ${tenantId} by user ${userId}`);
        return posted;
    }

    // ── 2. Auto-Post Invoice ─────────────────────────────────────────────────
    //    Called by InvoicesService when invoice transitions to SENT.
    //    DR: Accounts Receivable (total)
    //    CR: Sales Revenue (subtotal)
    //    CR: Tax Payable (taxAmount) — only if taxAmount > 0

    async autoPostInvoice(tenantId: string, userId: string, invoiceId: string) {
        return this.prisma.$transaction(async (tx) => {
            // ── Idempotency: prevent duplicate posting ────────────────────
            const existing = await tx.journalEntry.findFirst({
                where: { tenantId, referenceType: 'INVOICE', referenceId: invoiceId },
            });
            if (existing) {
                throw new ConflictException(`Invoice ${invoiceId} already has a journal entry (${existing.id})`);
            }

            const invoice = await tx.invoice.findFirst({
                where: { id: invoiceId, tenantId },
            });
            if (!invoice) throw new NotFoundException(`Invoice ${invoiceId} not found`);

            // ── Resolve accounts ──────────────────────────────────────────
            const [arAccount, revenueAccount, taxAccount] = await Promise.all([
                tx.account.findFirst({ where: { tenantId, code: '1120' } }),
                tx.account.findFirst({ where: { tenantId, code: '4100' } }),
                tx.account.findFirst({ where: { tenantId, code: '2130' } }),
            ]);

            if (!arAccount || !revenueAccount) {
                this.logger.warn(`Cannot auto-post invoice ${invoiceId}: required accounts (1120, 4100) not found for tenant ${tenantId}`);
                return null;
            }

            // ── Build journal lines ───────────────────────────────────────
            const lines: { accountId: string; debit: number; credit: number }[] = [
                { accountId: arAccount.id, debit: Number(invoice.total), credit: 0 },
                { accountId: revenueAccount.id, debit: 0, credit: Number(invoice.subtotal) },
            ];

            const taxAmount = Number(invoice.taxAmount);
            if (taxAmount > 0 && taxAccount) {
                lines.push({ accountId: taxAccount.id, debit: 0, credit: taxAmount });
            } else if (taxAmount > 0 && !taxAccount) {
                // No tax account configured — credit full amount to revenue
                lines[1].credit = Number(invoice.total);
                this.logger.warn(`Tax account (2130) not found for tenant ${tenantId}; crediting full amount to revenue`);
            }

            // ── Post the journal entry ────────────────────────────────────
            const posted = await this.postManualEntryWithTx(tx, tenantId, userId, {
                description: `Auto-post: Invoice ${invoice.invoiceNumber}`,
                referenceType: 'INVOICE',
                referenceId: invoiceId,
                lines,
            });

            // ── Link journal entry to invoice ──────────────────────────────
            await tx.invoice.update({
                where: { id: invoiceId },
                data: { journalEntryId: posted.id },
            });

            this.logger.log(`Invoice ${invoiceId} auto-posted → journal ${posted.id} for tenant ${tenantId}`);
            return posted;
        });
    }

    // ── 3. Auto-Post Payment ─────────────────────────────────────────────────
    //    Called by PaymentsService after payment creation.
    //    DR: Cash / Bank (amount)
    //    CR: Accounts Receivable (amount)

    async autoPostPayment(tenantId: string, userId: string, paymentId: string) {
        return this.prisma.$transaction(async (tx) => {
            // ── Idempotency: prevent duplicate posting ────────────────────
            const existing = await tx.journalEntry.findFirst({
                where: { tenantId, referenceType: 'PAYMENT', referenceId: paymentId },
            });
            if (existing) {
                throw new ConflictException(`Payment ${paymentId} already has a journal entry (${existing.id})`);
            }

            const payment = await tx.payment.findFirst({
                where: { id: paymentId, tenantId },
                include: { invoice: { select: { invoiceNumber: true } } },
            });
            if (!payment) throw new NotFoundException(`Payment ${paymentId} not found`);

            // ── Resolve accounts ──────────────────────────────────────────
            const [cashAccount, arAccount] = await Promise.all([
                tx.account.findFirst({ where: { tenantId, code: '1110' } }),
                tx.account.findFirst({ where: { tenantId, code: '1120' } }),
            ]);

            if (!cashAccount || !arAccount) {
                this.logger.warn(`Cannot auto-post payment ${paymentId}: required accounts not found for tenant ${tenantId}`);
                return null;
            }

            // ── Post the journal entry ────────────────────────────────────
            const posted = await this.postManualEntryWithTx(tx, tenantId, userId, {
                description: `Auto-post: Payment for Invoice ${payment.invoice.invoiceNumber}`,
                referenceType: 'PAYMENT',
                referenceId: paymentId,
                lines: [
                    { accountId: cashAccount.id, debit: Number(payment.amount), credit: 0 },
                    { accountId: arAccount.id, debit: 0, credit: Number(payment.amount) },
                ],
            });

            // ── Link journal entry to payment ─────────────────────────────
            await tx.payment.update({
                where: { id: paymentId },
                data: { journalEntryId: posted.id },
            });

            this.logger.log(`Payment ${paymentId} auto-posted → journal ${posted.id} for tenant ${tenantId}`);
            return posted;
        });
    }

    // ── 3b. Auto-Reversal for Invoice Cancellation ───────────────────────────

    async autoReversalForInvoice(tenantId: string, userId: string, invoiceId: string) {
        return this.prisma.$transaction(async (tx) => {
            const invoice = await tx.invoice.findFirst({
                where: { id: invoiceId, tenantId },
            });
            if (!invoice) throw new NotFoundException(`Invoice ${invoiceId} not found`);
            if (!invoice.journalEntryId) {
                this.logger.debug(`Invoice ${invoiceId} has no journal entry to reverse`);
                return null;
            }

            // Use the existing reverseEntry logic (inline within this tx)
            const original = await tx.journalEntry.findFirst({
                where: { id: invoice.journalEntryId, tenantId },
                include: { lines: true, reversals: true },
            });

            if (!original) throw new NotFoundException(`Journal entry ${invoice.journalEntryId} not found`);
            if (original.status !== 'POSTED') {
                throw new ConflictException(`Only POSTED entries can be reversed. Current status: ${original.status}`);
            }
            if (original.reversals.length > 0) {
                throw new ConflictException(`Journal entry ${original.id} has already been reversed`);
            }

            const reversal = await tx.journalEntry.create({
                data: {
                    tenantId,
                    description: `REVERSAL of: ${original.description}`,
                    referenceType: 'INVOICE',
                    referenceId: invoiceId,
                    reversalOf: original.id,
                    status: 'POSTED',
                    postedAt: new Date(),
                    createdBy: userId,
                    lines: {
                        create: original.lines.map((l) => ({
                            accountId: l.accountId,
                            debit: l.credit,   // Swap
                            credit: l.debit,   // Swap
                            description: l.description,
                        })),
                    },
                },
                include: {
                    lines: {
                        include: {
                            account: { select: { code: true, name: true, type: true } },
                        },
                    },
                },
            });

            await tx.journalEntry.update({
                where: { id: original.id },
                data: { status: 'REVERSED' },
            });

            // Clear the FK on the invoice
            await tx.invoice.update({
                where: { id: invoiceId },
                data: { journalEntryId: null },
            });

            await this.cache.invalidate(tenantId);
            this.logger.log(`Invoice ${invoiceId} journal reversed: ${original.id} → ${reversal.id} for tenant ${tenantId}`);
            return reversal;
        });
    }

    // ── 4. Reverse Journal Entry ─────────────────────────────────────────────

    async reverseEntry(tenantId: string, userId: string, entryId: string) {
        return this.prisma.$transaction(async (tx) => {
            const original = await tx.journalEntry.findFirst({
                where: { id: entryId, tenantId },
                include: { lines: true, reversals: true },
            });

            if (!original) throw new NotFoundException(`Journal entry ${entryId} not found`);
            if (original.status !== 'POSTED') {
                throw new ConflictException(`Only POSTED entries can be reversed. Current status: ${original.status}`);
            }
            if (original.reversals.length > 0) {
                throw new ConflictException(`Journal entry ${entryId} has already been reversed`);
            }

            // Create the mirror (reversal) entry — debit/credit swapped
            const reversal = await tx.journalEntry.create({
                data: {
                    tenantId,
                    description: `REVERSAL of: ${original.description}`,
                    referenceType: original.referenceType ?? 'MANUAL',
                    referenceId: original.referenceId ?? null,
                    reversalOf: original.id,
                    status: 'POSTED',
                    postedAt: new Date(),
                    createdBy: userId,
                    lines: {
                        create: original.lines.map((l) => ({
                            accountId: l.accountId,
                            debit: l.credit,   // Swap
                            credit: l.debit,   // Swap
                            description: l.description,
                        })),
                    },
                },
                include: {
                    lines: {
                        include: {
                            account: { select: { code: true, name: true, type: true } },
                        },
                    },
                },
            });

            // Lock the original as REVERSED
            await tx.journalEntry.update({
                where: { id: original.id },
                data: { status: 'REVERSED' },
            });

            await this.cache.invalidate(tenantId);
            this.logger.log(`Journal entry reversed: ${original.id} → ${reversal.id} for tenant ${tenantId}`);
            return reversal;
        });
    }

    // ── 5. Get Trial Balance ──────────────────────────────────────────────────

    async getTrialBalance(tenantId: string, query: TrialBalanceQueryDto): Promise<TrialBalanceResult> {
        const asOfDate = query.asOfDate ? new Date(query.asOfDate) : new Date();
        const cacheKey = query.asOfDate ?? 'now';

        // Cache check — only cache "now" queries (no custom asOfDate)
        if (!query.asOfDate) {
            const cached = await this.cache.getTrialBalance(tenantId);
            if (cached) {
                this.logger.debug(`Trial balance cache HIT for tenant ${tenantId}`);
                return cached;
            }
        }

        this.logger.debug(`Trial balance cache MISS for tenant ${tenantId}, computing from DB`);

        // Aggregate debit/credit per account from POSTED entries only, up to asOfDate
        const rawLines = await this.prisma.journalEntryLine.groupBy({
            by: ['accountId'],
            where: {
                account: { tenantId },
                journalEntry: {
                    tenantId,
                    status: 'POSTED',
                    postedAt: { lte: asOfDate },
                },
            },
            _sum: { debit: true, credit: true },
        });

        if (rawLines.length === 0) {
            const empty: TrialBalanceResult = {
                lines: [],
                totalDebit: '0.0000',
                totalCredit: '0.0000',
                isBalanced: true,
                asOfDate,
            };
            return empty;
        }

        // Enrich with account details
        const accountIds = rawLines.map((r) => r.accountId);
        const accounts = await this.prisma.account.findMany({
            where: { id: { in: accountIds }, tenantId },
            select: { id: true, code: true, name: true, type: true },
        });
        const accMap = new Map(accounts.map((a) => [a.id, a]));

        const lines: TrialBalanceLine[] = rawLines
            .map((r) => {
                const acc = accMap.get(r.accountId);
                if (!acc) return null;
                const totalDebit = r._sum.debit ?? new Decimal(0);
                const totalCredit = r._sum.credit ?? new Decimal(0);
                const balance = new Decimal(totalDebit).minus(totalCredit);
                return {
                    accountId: acc.id,
                    accountCode: acc.code,
                    accountName: acc.name,
                    accountType: acc.type,
                    totalDebit: totalDebit.toFixed(4),
                    totalCredit: totalCredit.toFixed(4),
                    balance: balance.toFixed(4),
                };
            })
            .filter(Boolean) as TrialBalanceLine[];

        // Sort by account code
        lines.sort((a, b) => a.accountCode.localeCompare(b.accountCode));

        const grandDebit = lines.reduce((s, l) => s + Number(l.totalDebit), 0);
        const grandCredit = lines.reduce((s, l) => s + Number(l.totalCredit), 0);
        const isBalanced = Math.abs(grandDebit - grandCredit) < 0.0001;

        const result: TrialBalanceResult = {
            lines,
            totalDebit: grandDebit.toFixed(4),
            totalCredit: grandCredit.toFixed(4),
            isBalanced,
            asOfDate,
        };

        // Only cache live (no asOfDate) queries
        if (!query.asOfDate) {
            await this.cache.setTrialBalance(tenantId, result);
        }

        return result;
    }

    // ── 6. Validate Global Debit = Credit ────────────────────────────────────

    async validateGlobalEquality(tenantId: string): Promise<{ isBalanced: boolean; totalDebit: string; totalCredit: string; delta: string }> {
        const agg = await this.prisma.journalEntryLine.aggregate({
            where: {
                account: { tenantId },
                journalEntry: { tenantId, status: 'POSTED' },
            },
            _sum: { debit: true, credit: true },
        });

        const totalDebit = agg._sum.debit ?? new Decimal(0);
        const totalCredit = agg._sum.credit ?? new Decimal(0);
        const delta = new Decimal(totalDebit).minus(totalCredit).abs();
        const isBalanced = delta.lessThan('0.0001');

        if (!isBalanced) {
            this.logger.error(`⚠️ SYSTEM INVARIANT VIOLATION: Tenant ${tenantId} has debit=${totalDebit} credit=${totalCredit} — system is CORRUPTED`);
        }

        return {
            isBalanced,
            totalDebit: new Decimal(totalDebit).toFixed(4),
            totalCredit: new Decimal(totalCredit).toFixed(4),
            delta: delta.toFixed(4),
        };
    }

    // ── findAll ──────────────────────────────────────────────────────────────

    async findAll(tenantId: string, query: JournalQueryDto) {
        const { page = 1, limit = 20, status, dateFrom, dateTo } = query;
        const skip = (page - 1) * limit;

        const where: Record<string, unknown> = { tenantId };
        if (status) where.status = status;
        if (dateFrom || dateTo) {
            where.createdAt = {
                ...(dateFrom && { gte: new Date(dateFrom) }),
                ...(dateTo && { lte: new Date(dateTo) }),
            };
        }

        const [items, total] = await Promise.all([
            this.prisma.journalEntry.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    lines: {
                        include: {
                            account: { select: { code: true, name: true, type: true } },
                        },
                    },
                },
            }),
            this.prisma.journalEntry.count({ where }),
        ]);

        return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    // ── findOne ──────────────────────────────────────────────────────────────

    async findOne(tenantId: string, id: string) {
        const entry = await this.prisma.journalEntry.findFirst({
            where: { id, tenantId },
            include: {
                lines: {
                    include: {
                        account: { select: { id: true, code: true, name: true, type: true } },
                    },
                },
            },
        });
        if (!entry) throw new NotFoundException(`Journal entry ${id} not found`);
        return entry;
    }
}
