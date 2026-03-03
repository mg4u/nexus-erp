import { Injectable, Inject, Logger } from '@nestjs/common';
import { AI_PROVIDER, AIProvider } from '../../domain/ai/ai-provider.interface';
import { PrismaService } from '../../infrastructure/database/prisma.service';

const SCHEMA_CONTEXT = `
ERP Database Schema:
- tenants: id, name, slug, plan, isActive
- users: id, tenantId, email, role(ADMIN/MANAGER/ACCOUNTANT/EMPLOYEE), firstName, lastName
- products: id, tenantId, name, sku, price, stockQuantity, category
- customers: id, tenantId, firstName, lastName, email, city, country
- orders: id, tenantId, customerId, status(PENDING/CONFIRMED/SHIPPED/DELIVERED/CANCELLED), subtotal, total, createdAt
- order_items: id, orderId, productId, quantity, unitPrice, totalPrice
- invoices: id, tenantId, orderId, invoiceNumber, status(DRAFT/SENT/PAID/CANCELLED), total, dueDate, paidAt
- payments: id, tenantId, invoiceId, amount, method, paidAt
`;

@Injectable()
export class AiAssistantService {
    private readonly logger = new Logger(AiAssistantService.name);

    constructor(
        @Inject(AI_PROVIDER) private readonly aiProvider: AIProvider,
        private readonly prisma: PrismaService,
    ) { }

    async processQuery(tenantId: string, query: string) {
        this.logger.log(`[${tenantId}] AI Query: "${query}"`);

        // Gather real-time context to enrich the AI response
        const [totalRevenue, topCustomer, lowStockCount, pendingInvoices] = await Promise.all([
            this.prisma.payment.aggregate({ where: { tenantId }, _sum: { amount: true } }),
            this.prisma.order.groupBy({
                by: ['customerId'],
                where: { tenantId },
                _sum: { total: true },
                orderBy: { _sum: { total: 'desc' } },
                take: 1,
            }),
            this.prisma.product.count({ where: { tenantId, stockQuantity: { lte: 10 } } }),
            this.prisma.invoice.count({ where: { tenantId, status: 'SENT', dueDate: { lt: new Date() } } }),
        ]);

        const context = {
            totalRevenue: Number(totalRevenue._sum.amount ?? 0),
            topCustomerId: topCustomer[0]?.customerId,
            lowStockProducts: lowStockCount,
            overdueInvoices: pendingInvoices,
        };

        const response = await this.aiProvider.query({ query, context }, SCHEMA_CONTEXT);

        return {
            query,
            ...response,
            generatedAt: new Date().toISOString(),
            tenantId,
        };
    }
}
