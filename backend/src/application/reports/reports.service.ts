import { Injectable, Inject, Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { REDIS_CLIENT } from '../../infrastructure/cache/redis.constants';
import Redis from 'ioredis';
import { InvoiceStatus, OrderStatus } from '@prisma/client';

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
