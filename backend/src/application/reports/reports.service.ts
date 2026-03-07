import { Injectable, Inject, Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { REDIS_CLIENT } from '../../infrastructure/cache/redis.constants';
import Redis from 'ioredis';
import { Decimal } from '@prisma/client/runtime/library';
import { InvoiceStatus, OrderStatus } from '@prisma/client';
import { AccountType } from '@domain/accounts/account.entity';

// ─── P&L Response Types ──────────────────────────────────────────────────────

export interface ProfitLossLine {
    accountId: string;
    accountCode: string;
    accountName: string;
    amount: string; // net amount as fixed-4 decimal string
}

export interface ProfitLossResult {
    dateFrom: string;
    dateTo: string;
    revenueLines: ProfitLossLine[];
    expenseLines: ProfitLossLine[];
    totalRevenue: string;
    totalExpenses: string;
    netProfit: string;
    isProfit: boolean;
    cachedAt?: string;
}

// ─── P&L Entries (Drill-Down) Types ──────────────────────────────────────────

export interface ProfitLossEntryRow {
    date: string;
    journalReference: string;
    accountCode: string;
    accountName: string;
    description: string;
    debit: string;
    credit: string;
}

export interface ProfitLossEntriesResult {
    rows: ProfitLossEntryRow[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

const CACHE_TTL_SECONDS = 3600; // 1 hour

@Injectable()
export class ReportsService {
    private readonly logger = new Logger(ReportsService.name);

    constructor(
        private readonly prisma: PrismaService,
        @Inject(REDIS_CLIENT) private readonly redis: Redis,
    ) { }

    private async getCached<T>(key: string, fn: () => Promise<T>): Promise<T> {
        try {
            const cached = await this.redis.get(key);
            if (cached) {
                this.logger.debug(`Cache HIT: ${key}`);
                return JSON.parse(cached) as T;
            }
        } catch (err) {
            this.logger.warn(`Redis get failed for key ${key}: ${(err as Error).message}`);
        }

        const data = await fn();

        try {
            await this.redis.setex(key, CACHE_TTL_SECONDS, JSON.stringify(data));
        } catch (err) {
            this.logger.warn(`Redis set failed for key ${key}: ${(err as Error).message}`);
        }

        return data;
    }

    // ── Profit & Loss Report ─────────────────────────────────────────────────

    async getProfitLoss(tenantId: string, dateFrom?: string, dateTo?: string): Promise<ProfitLossResult> {
        const now = new Date();
        const from = dateFrom ?? new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
        const to = dateTo ?? now.toISOString().slice(0, 10);

        const cacheKey = `reports:profit-loss:${tenantId}:${from}:${to}`;

        return this.getCached<ProfitLossResult>(cacheKey, async () => {
            const fromDate = new Date(from);
            const toDate = new Date(to + 'T23:59:59.999Z');

            // Aggregate debit/credit per account for REVENUE and EXPENSE accounts only
            const rawLines = await this.prisma.journalEntryLine.groupBy({
                by: ['accountId'],
                where: {
                    account: {
                        tenantId,
                        type: { in: ['REVENUE', 'EXPENSE'] },
                    },
                    journalEntry: {
                        tenantId,
                        status: 'POSTED',
                        postedAt: { gte: fromDate, lte: toDate },
                    },
                },
                _sum: { debit: true, credit: true },
            });

            if (rawLines.length === 0) {
                return {
                    dateFrom: from,
                    dateTo: to,
                    revenueLines: [],
                    expenseLines: [],
                    totalRevenue: '0.0000',
                    totalExpenses: '0.0000',
                    netProfit: '0.0000',
                    isProfit: true,
                    cachedAt: new Date().toISOString(),
                };
            }

            // Enrich with account details
            const accountIds = rawLines.map((r) => r.accountId);
            const accounts = await this.prisma.account.findMany({
                where: { id: { in: accountIds }, tenantId },
                select: { id: true, code: true, name: true, type: true },
            });
            const accMap = new Map(accounts.map((a) => [a.id, a]));

            const revenueLines: ProfitLossLine[] = [];
            const expenseLines: ProfitLossLine[] = [];

            for (const raw of rawLines) {
                const acc = accMap.get(raw.accountId);
                if (!acc) continue;

                const totalDebit = new Decimal(raw._sum.debit ?? 0);
                const totalCredit = new Decimal(raw._sum.credit ?? 0);

                if (acc.type === 'REVENUE') {
                    // Revenue = credit - debit (net credit balance)
                    const amount = totalCredit.minus(totalDebit);
                    revenueLines.push({
                        accountId: acc.id,
                        accountCode: acc.code,
                        accountName: acc.name,
                        amount: amount.toFixed(4),
                    });
                } else if (acc.type === 'EXPENSE') {
                    // Expense = debit - credit (net debit balance)
                    const amount = totalDebit.minus(totalCredit);
                    expenseLines.push({
                        accountId: acc.id,
                        accountCode: acc.code,
                        accountName: acc.name,
                        amount: amount.toFixed(4),
                    });
                }
            }

            // Sort by account code
            revenueLines.sort((a, b) => a.accountCode.localeCompare(b.accountCode));
            expenseLines.sort((a, b) => a.accountCode.localeCompare(b.accountCode));

            const totalRevenue = revenueLines.reduce((s, l) => s.plus(l.amount), new Decimal(0));
            const totalExpenses = expenseLines.reduce((s, l) => s.plus(l.amount), new Decimal(0));
            const netProfit = totalRevenue.minus(totalExpenses);

            return {
                dateFrom: from,
                dateTo: to,
                revenueLines,
                expenseLines,
                totalRevenue: totalRevenue.toFixed(4),
                totalExpenses: totalExpenses.toFixed(4),
                netProfit: netProfit.toFixed(4),
                isProfit: netProfit.greaterThanOrEqualTo(0),
                cachedAt: new Date().toISOString(),
            };
        });
    }

    // ── Profit & Loss Entries (Drill-Down) ───────────────────────────────────

    async getProfitLossEntries(
        tenantId: string,
        dateFrom?: string,
        dateTo?: string,
        page = 1,
        limit = 20,
    ): Promise<ProfitLossEntriesResult> {
        const now = new Date();
        const from = dateFrom ?? new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
        const to = dateTo ?? now.toISOString().slice(0, 10);

        const fromDate = new Date(from);
        const toDate = new Date(to + 'T23:59:59.999Z');
        const skip = (page - 1) * limit;

        const whereClause = {
            account: {
                tenantId,
                type: { in: ['REVENUE', 'EXPENSE'] as AccountType[] },
            },
            journalEntry: {
                tenantId,
                status: 'POSTED' as const,
                postedAt: { gte: fromDate, lte: toDate },
            },
        };

        const [rows, total] = await Promise.all([
            this.prisma.journalEntryLine.findMany({
                where: whereClause,
                include: {
                    journalEntry: {
                        select: { postedAt: true, referenceType: true, referenceId: true, description: true },
                    },
                    account: {
                        select: { code: true, name: true, type: true },
                    },
                },
                orderBy: { journalEntry: { postedAt: 'desc' } },
                skip,
                take: limit,
            }),
            this.prisma.journalEntryLine.count({ where: whereClause }),
        ]);

        const mapped: ProfitLossEntryRow[] = rows.map((row: any) => ({
            date: row.journalEntry.postedAt?.toISOString().slice(0, 10) ?? '',
            journalReference: row.journalEntry.referenceType
                ? `${row.journalEntry.referenceType}#${row.journalEntry.referenceId ?? ''}`
                : 'MANUAL',
            accountCode: row.account.code,
            accountName: row.account.name,
            description: row.description ?? row.journalEntry.description ?? '',
            debit: Number(row.debit).toFixed(4),
            credit: Number(row.credit).toFixed(4),
        }));

        return {
            rows: mapped,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }

    // ── Dashboard Summary ────────────────────────────────────────────────────

    async getDashboardSummary(tenantId: string) {
        const cacheKey = `reports:dashboard:${tenantId}`;
        return this.getCached(cacheKey, async () => {
            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

            const [
                totalCustomers,
                totalProducts,
                totalOrders,
                monthlyOrders,
                pendingInvoices,
                paidInvoices,
                totalRevenue,
                monthlyRevenue,
                lowStockCount,
            ] = await Promise.all([
                this.prisma.customer.count({ where: { tenantId, isActive: true } }),
                this.prisma.product.count({ where: { tenantId, isActive: true } }),
                this.prisma.order.count({ where: { tenantId } }),
                this.prisma.order.count({ where: { tenantId, createdAt: { gte: startOfMonth } } }),
                this.prisma.invoice.count({ where: { tenantId, status: InvoiceStatus.SENT } }),
                this.prisma.invoice.count({ where: { tenantId, status: InvoiceStatus.PAID } }),
                this.prisma.payment.aggregate({ where: { tenantId }, _sum: { amount: true } }),
                this.prisma.payment.aggregate({
                    where: { tenantId, paidAt: { gte: startOfMonth } },
                    _sum: { amount: true },
                }),
                this.prisma.product.count({
                    where: { tenantId, isActive: true, stockQuantity: { lte: 10 } },
                }),
            ]);

            return {
                customers: { total: totalCustomers },
                products: { total: totalProducts, lowStock: lowStockCount },
                orders: { total: totalOrders, thisMonth: monthlyOrders },
                invoices: { pending: pendingInvoices, paid: paidInvoices },
                revenue: {
                    total: Number(totalRevenue._sum.amount ?? 0),
                    thisMonth: Number(monthlyRevenue._sum.amount ?? 0),
                },
            };
        });
    }

    async getMonthlySales(tenantId: string, year: number) {
        const cacheKey = `reports:monthly-sales:${tenantId}:${year}`;
        return this.getCached(cacheKey, async () => {
            const startDate = new Date(`${year}-01-01`);
            const endDate = new Date(`${year + 1}-01-01`);

            const payments = await this.prisma.payment.findMany({
                where: { tenantId, paidAt: { gte: startDate, lt: endDate } },
                select: { amount: true, paidAt: true },
            });

            // Aggregate by month
            const monthly: Record<number, number> = {};
            for (let i = 1; i <= 12; i++) monthly[i] = 0;

            for (const payment of payments) {
                const month = payment.paidAt.getMonth() + 1;
                monthly[month] += Number(payment.amount);
            }

            return Object.entries(monthly).map(([month, revenue]) => ({
                month: parseInt(month),
                monthName: new Date(year, parseInt(month) - 1, 1).toLocaleString('default', { month: 'long' }),
                revenue: Math.round(revenue * 100) / 100,
            }));
        });
    }

    async getTopProducts(tenantId: string, limit = 10) {
        const cacheKey = `reports:top-products:${tenantId}:${limit}`;
        return this.getCached(cacheKey, async () => {
            const items = await this.prisma.orderItem.groupBy({
                by: ['productId'],
                where: { order: { tenantId } },
                _sum: { quantity: true, totalPrice: true },
                orderBy: { _sum: { totalPrice: 'desc' } },
                take: limit,
            });

            const productIds = items.map((i) => i.productId);
            const products = await this.prisma.product.findMany({
                where: { id: { in: productIds } },
                select: { id: true, name: true, sku: true, category: true },
            });

            return items.map((item) => ({
                product: products.find((p) => p.id === item.productId),
                totalQuantitySold: item._sum.quantity ?? 0,
                totalRevenue: Number(item._sum.totalPrice ?? 0),
            }));
        });
    }

    async getRevenueByCategory(tenantId: string) {
        const cacheKey = `reports:revenue-by-category:${tenantId}`;
        return this.getCached(cacheKey, async () => {
            const items = await this.prisma.orderItem.findMany({
                where: { order: { tenantId } },
                include: { product: { select: { category: true } } },
            });

            const categoryMap: Record<string, number> = {};
            for (const item of items) {
                const cat = item.product.category ?? 'Uncategorized';
                categoryMap[cat] = (categoryMap[cat] ?? 0) + Number(item.totalPrice);
            }

            return Object.entries(categoryMap)
                .map(([category, revenue]) => ({ category, revenue: Math.round(revenue * 100) / 100 }))
                .sort((a, b) => b.revenue - a.revenue);
        });
    }

    async invalidateCache(tenantId: string): Promise<void> {
        const keys = await this.redis.keys(`reports:*:${tenantId}*`);
        if (keys.length > 0) {
            await this.redis.del(...keys);
            this.logger.log(`Invalidated ${keys.length} report cache keys for tenant ${tenantId}`);
        }
    }
}
