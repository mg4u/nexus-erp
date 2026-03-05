import {
    Injectable,
    NotFoundException,
    ConflictException,
    ForbiddenException,
    BadRequestException,
    Logger,
    Inject,
} from '@nestjs/common';
import { AccountType } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AccountCacheService } from '../../infrastructure/accounts/account-cache.service';
import { CreateAccountDto, UpdateAccountDto, AccountsQueryDto } from './dto/accounts.dto';

// ─── Tree node type ───────────────────────────────────────────────────────────

export interface AccountTreeNode {
    id: string;
    tenantId: string;
    code: string;
    name: string;
    type: AccountType;
    parentId: string | null;
    level: number;
    isSystem: boolean;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    children: AccountTreeNode[];
}

// ─── Default CoA Seed Data ────────────────────────────────────────────────────

const DEFAULT_ACCOUNTS: Array<{
    code: string;
    name: string;
    type: AccountType;
    parentCode?: string;
    level: number;
    isSystem: boolean;
}> = [
        // ── Assets ──────────────────────────────────────────────────────────────
        { code: '1000', name: 'Assets', type: 'ASSET', level: 0, isSystem: true },
        { code: '1100', name: 'Current Assets', type: 'ASSET', parentCode: '1000', level: 1, isSystem: true },
        { code: '1110', name: 'Cash and Cash Equivalents', type: 'ASSET', parentCode: '1100', level: 2, isSystem: true },
        { code: '1120', name: 'Accounts Receivable', type: 'ASSET', parentCode: '1100', level: 2, isSystem: true },
        { code: '1130', name: 'Inventory', type: 'ASSET', parentCode: '1100', level: 2, isSystem: true },
        { code: '1200', name: 'Non-Current Assets', type: 'ASSET', parentCode: '1000', level: 1, isSystem: true },
        { code: '1210', name: 'Property, Plant & Equipment', type: 'ASSET', parentCode: '1200', level: 2, isSystem: true },
        // ── Liabilities ──────────────────────────────────────────────────────────
        { code: '2000', name: 'Liabilities', type: 'LIABILITY', level: 0, isSystem: true },
        { code: '2100', name: 'Current Liabilities', type: 'LIABILITY', parentCode: '2000', level: 1, isSystem: true },
        { code: '2110', name: 'Accounts Payable', type: 'LIABILITY', parentCode: '2100', level: 2, isSystem: true },
        { code: '2120', name: 'Short-Term Loans', type: 'LIABILITY', parentCode: '2100', level: 2, isSystem: true },
        { code: '2200', name: 'Non-Current Liabilities', type: 'LIABILITY', parentCode: '2000', level: 1, isSystem: true },
        { code: '2210', name: 'Long-Term Debt', type: 'LIABILITY', parentCode: '2200', level: 2, isSystem: true },
        // ── Equity ───────────────────────────────────────────────────────────────
        { code: '3000', name: 'Equity', type: 'EQUITY', level: 0, isSystem: true },
        { code: '3100', name: 'Owner\'s Capital', type: 'EQUITY', parentCode: '3000', level: 1, isSystem: true },
        { code: '3200', name: 'Retained Earnings', type: 'EQUITY', parentCode: '3000', level: 1, isSystem: true },
        // ── Revenue ──────────────────────────────────────────────────────────────
        { code: '4000', name: 'Revenue', type: 'REVENUE', level: 0, isSystem: true },
        { code: '4100', name: 'Sales Revenue', type: 'REVENUE', parentCode: '4000', level: 1, isSystem: true },
        { code: '4200', name: 'Service Revenue', type: 'REVENUE', parentCode: '4000', level: 1, isSystem: true },
        { code: '4300', name: 'Other Revenue', type: 'REVENUE', parentCode: '4000', level: 1, isSystem: true },
        // ── Expenses ─────────────────────────────────────────────────────────────
        { code: '5000', name: 'Expenses', type: 'EXPENSE', level: 0, isSystem: true },
        { code: '5100', name: 'Cost of Goods Sold', type: 'EXPENSE', parentCode: '5000', level: 1, isSystem: true },
        { code: '5200', name: 'Operating Expenses', type: 'EXPENSE', parentCode: '5000', level: 1, isSystem: true },
        { code: '5210', name: 'Salaries & Wages', type: 'EXPENSE', parentCode: '5200', level: 2, isSystem: true },
        { code: '5220', name: 'Rent Expense', type: 'EXPENSE', parentCode: '5200', level: 2, isSystem: true },
        { code: '5230', name: 'Marketing & Advertising', type: 'EXPENSE', parentCode: '5200', level: 2, isSystem: true },
        { code: '5300', name: 'Depreciation Expense', type: 'EXPENSE', parentCode: '5000', level: 1, isSystem: true },
        { code: '5400', name: 'Tax Expense', type: 'EXPENSE', parentCode: '5000', level: 1, isSystem: true },
    ];

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class AccountsService {
    private readonly logger = new Logger(AccountsService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly cache: AccountCacheService,
    ) { }

    // ── findAll (flat paginated list) ─────────────────────────────────────────

    async findAll(tenantId: string, query: AccountsQueryDto) {
        const { page = 1, limit = 50, type, search, activeOnly = true } = query;
        const skip = (page - 1) * limit;

        const where: Record<string, unknown> = { tenantId };
        if (activeOnly) where.isActive = true;
        if (type) where.type = type;
        if (search) {
            where.OR = [
                { code: { contains: search, mode: 'insensitive' } },
                { name: { contains: search, mode: 'insensitive' } },
            ];
        }

        const [items, total] = await Promise.all([
            this.prisma.account.findMany({
                where,
                skip,
                take: limit,
                orderBy: [{ code: 'asc' }],
            }),
            this.prisma.account.count({ where }),
        ]);

        return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    // ── findOne ───────────────────────────────────────────────────────────────

    async findOne(tenantId: string, id: string) {
        const account = await this.prisma.account.findFirst({
            where: { id, tenantId },
            include: {
                children: {
                    where: { isActive: true },
                    orderBy: { code: 'asc' },
                },
            },
        });
        if (!account) {
            throw new NotFoundException(`Account ${id} not found`);
        }
        return account;
    }

    // ── getTree (cached) ───────────────────────────────────────────────────────

    async getTree(tenantId: string): Promise<AccountTreeNode[]> {
        // Cache hit
        const cached = await this.cache.getTree(tenantId);
        if (cached) {
            this.logger.debug(`CoA tree cache HIT for tenant ${tenantId}`);
            return cached;
        }

        // Cache miss — build from DB
        this.logger.debug(`CoA tree cache MISS for tenant ${tenantId}, querying DB`);
        const accounts = await this.prisma.account.findMany({
            where: { tenantId },
            orderBy: { code: 'asc' },
        });

        const tree = this.buildTree(accounts);
        await this.cache.setTree(tenantId, tree);
        return tree;
    }

    // ── create ────────────────────────────────────────────────────────────────

    async create(tenantId: string, dto: CreateAccountDto) {
        return this.prisma.$transaction(async (tx) => {
            // 1. Duplicate code check
            const existing = await tx.account.findUnique({
                where: { tenantId_code: { tenantId, code: dto.code } },
            });
            if (existing) {
                throw new ConflictException(`Account code '${dto.code}' already exists for this tenant`);
            }

            // 2. Parent validation
            let level = 0;
            let parentId: string | null = dto.parentId ?? null;

            if (parentId) {
                const parent = await tx.account.findFirst({ where: { id: parentId, tenantId } });
                if (!parent) {
                    throw new NotFoundException(`Parent account '${parentId}' not found for this tenant`);
                }
                level = parent.level + 1;
            }

            // 3. Create
            const account = await tx.account.create({
                data: {
                    tenantId,
                    code: dto.code,
                    name: dto.name,
                    type: dto.type as AccountType,
                    parentId,
                    level,
                    isSystem: dto.isSystem ?? false,
                    isActive: true,
                },
            });

            // 4. Invalidate cache
            await this.cache.invalidate(tenantId);

            this.logger.log(`Account created: ${account.code} (${account.id}) for tenant ${tenantId}`);
            return account;
        });
    }

    // ── update ────────────────────────────────────────────────────────────────

    async update(tenantId: string, id: string, dto: UpdateAccountDto) {
        return this.prisma.$transaction(async (tx) => {
            const account = await tx.account.findFirst({ where: { id, tenantId } });
            if (!account) throw new NotFoundException(`Account ${id} not found`);

            // If parentId is being changed, validate new parent
            let level = account.level;
            let parentId = account.parentId;

            if (dto.parentId !== undefined) {
                if (dto.parentId === null) {
                    level = 0;
                    parentId = null;
                } else {
                    // Circular reference guard
                    await this.assertNoCircularReference(tx, id, dto.parentId, tenantId);

                    const parent = await tx.account.findFirst({
                        where: { id: dto.parentId, tenantId },
                    });
                    if (!parent) {
                        throw new NotFoundException(`Parent account '${dto.parentId}' not found`);
                    }
                    level = parent.level + 1;
                    parentId = dto.parentId;
                }
            }

            // Cannot change code if it conflicts
            if (dto.code && dto.code !== account.code) {
                const conflict = await tx.account.findUnique({
                    where: { tenantId_code: { tenantId, code: dto.code } },
                });
                if (conflict) {
                    throw new ConflictException(`Account code '${dto.code}' already exists`);
                }
            }

            const updated = await tx.account.update({
                where: { id },
                data: {
                    ...(dto.code !== undefined && { code: dto.code }),
                    ...(dto.name !== undefined && { name: dto.name }),
                    ...(dto.type !== undefined && { type: dto.type as AccountType }),
                    ...(dto.isPostable !== undefined && { isPostable: dto.isPostable }),
                    parentId,
                    level,
                },
            });

            await this.cache.invalidate(tenantId);
            this.logger.log(`Account updated: ${updated.code} (${id}) for tenant ${tenantId}`);
            return updated;
        });
    }

    // ── togglePostable ─────────────────────────────────────────────────────────

    async togglePostable(tenantId: string, id: string): Promise<{ id: string; isPostable: boolean }> {
        const account = await this.prisma.account.findFirst({ where: { id, tenantId } });
        if (!account) throw new NotFoundException(`Account ${id} not found`);

        // Guard: parent accounts (have children) should not be postable
        const childCount = await this.prisma.account.count({ where: { parentId: id, tenantId } });
        if (!account.isPostable && childCount > 0) {
            throw new ConflictException(
                `Account '${account.code}' has ${childCount} child account(s). Only leaf accounts can be marked postable.`,
            );
        }

        const updated = await this.prisma.account.update({
            where: { id },
            data: { isPostable: !account.isPostable },
            select: { id: true, isPostable: true, code: true },
        });

        await this.cache.invalidate(tenantId);
        this.logger.log(`Account ${account.code} isPostable toggled → ${updated.isPostable} for tenant ${tenantId}`);
        return { id: updated.id, isPostable: updated.isPostable };
    }

    // ── disable ───────────────────────────────────────────────────────────────

    async disable(tenantId: string, id: string) {
        const account = await this.prisma.account.findFirst({ where: { id, tenantId } });
        if (!account) throw new NotFoundException(`Account ${id} not found`);
        if (!account.isActive) throw new ConflictException(`Account ${id} is already inactive`);

        // Check for active children
        const activeChildCount = await this.prisma.account.count({
            where: { parentId: id, tenantId, isActive: true },
        });
        if (activeChildCount > 0) {
            throw new ConflictException(
                `Cannot disable account '${account.code}': it has ${activeChildCount} active child account(s). Disable children first.`,
            );
        }

        const updated = await this.prisma.account.update({
            where: { id },
            data: { isActive: false },
        });

        await this.cache.invalidate(tenantId);
        this.logger.log(`Account disabled: ${account.code} (${id}) for tenant ${tenantId}`);
        return updated;
    }

    // ── delete ────────────────────────────────────────────────────────────────

    async delete(tenantId: string, id: string): Promise<void> {
        const account = await this.prisma.account.findFirst({ where: { id, tenantId } });
        if (!account) throw new NotFoundException(`Account ${id} not found`);

        // Rule: system accounts cannot be deleted
        if (account.isSystem) {
            throw new ForbiddenException(
                `Account '${account.code}' is a system account and cannot be deleted`,
            );
        }

        // Rule: cannot delete if has children
        const childCount = await this.prisma.account.count({ where: { parentId: id, tenantId } });
        if (childCount > 0) {
            throw new ConflictException(
                `Cannot delete account '${account.code}': it has ${childCount} child account(s)`,
            );
        }

        // Rule: cannot delete if account has been used in journal entries
        const lineCount = await this.prisma.journalEntryLine.count({
            where: { accountId: id, account: { tenantId } },
        });
        if (lineCount > 0) {
            throw new ConflictException(
                `Cannot delete account '${account.code}': it has been used in ${lineCount} journal entry line(s). Disable it instead.`,
            );
        }

        await this.prisma.account.delete({ where: { id } });
        await this.cache.invalidate(tenantId);
        this.logger.log(`Account deleted: ${account.code} (${id}) for tenant ${tenantId}`);
    }

    // ── seedDefaultCoA ────────────────────────────────────────────────────────

    async seedDefaultCoA(tenantId: string): Promise<{ seeded: number; skipped: number }> {
        let seeded = 0;
        let skipped = 0;

        // Build code → id map for resolving parentId from parentCode
        const existingAccounts = await this.prisma.account.findMany({
            where: { tenantId },
            select: { id: true, code: true },
        });
        const codeToId = new Map<string, string>(existingAccounts.map((a) => [a.code, a.id]));

        for (const def of DEFAULT_ACCOUNTS) {
            const alreadyExists = codeToId.has(def.code);
            if (alreadyExists) {
                skipped++;
                continue;
            }

            const parentId = def.parentCode ? (codeToId.get(def.parentCode) ?? null) : null;

            const created = await this.prisma.account.create({
                data: {
                    tenantId,
                    code: def.code,
                    name: def.name,
                    type: def.type,
                    parentId,
                    level: def.level,
                    isSystem: def.isSystem,
                    isActive: true,
                },
            });

            codeToId.set(def.code, created.id);
            seeded++;
        }

        await this.cache.invalidate(tenantId);
        this.logger.log(`Default CoA seeded for tenant ${tenantId}: ${seeded} created, ${skipped} skipped`);
        return { seeded, skipped };
    }

    // ── Private: build tree from flat list ───────────────────────────────────

    private buildTree(accounts: Omit<AccountTreeNode, 'children'>[]): AccountTreeNode[] {
        const map = new Map<string, AccountTreeNode>();
        const roots: AccountTreeNode[] = [];

        for (const acc of accounts) {
            map.set(acc.id, { ...acc, children: [] });
        }

        for (const node of map.values()) {
            if (node.parentId && map.has(node.parentId)) {
                map.get(node.parentId)!.children.push(node);
            } else {
                roots.push(node);
            }
        }

        return roots;
    }

    // ── Private: circular reference detection ─────────────────────────────────

    private async assertNoCircularReference(
        tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0],
        accountId: string,
        newParentId: string,
        tenantId: string,
    ): Promise<void> {
        if (accountId === newParentId) {
            throw new BadRequestException('An account cannot be its own parent');
        }

        // Walk up the ancestor chain of newParentId; if we encounter accountId → circular
        let currentId: string | null = newParentId;
        const visited = new Set<string>();

        while (currentId) {
            if (visited.has(currentId)) {
                throw new BadRequestException('Circular parent reference detected in account hierarchy');
            }
            visited.add(currentId);

            if (currentId === accountId) {
                throw new BadRequestException(
                    `Setting parent '${newParentId}' would create a circular reference`,
                );
            }

            const parent = await tx.account.findFirst({
                where: { id: currentId, tenantId },
                select: { parentId: true },
            });
            currentId = parent?.parentId ?? null;
        }
    }
}
