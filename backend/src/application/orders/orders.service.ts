import {
    Injectable,
    NotFoundException,
    BadRequestException,
    ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { CreateOrderDto, UpdateOrderStatusDto, OrdersQueryDto } from './dto/orders.dto';
import { OrderStatus, InvoiceStatus, Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class OrdersService {
    constructor(private readonly prisma: PrismaService) { }

    async findAll(tenantId: string, query: OrdersQueryDto) {
        const { page = 1, limit = 20, status, customerId } = query;
        const skip = (page - 1) * limit;

        const where: Prisma.OrderWhereInput = {
            tenantId,
            ...(status && { status }),
            ...(customerId && { customerId }),
        };

        const [items, total] = await Promise.all([
            this.prisma.order.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    customer: { select: { id: true, firstName: true, lastName: true, email: true } },
                    items: { include: { product: { select: { id: true, name: true, sku: true } } } },
                    invoice: { select: { id: true, invoiceNumber: true, status: true, total: true } },
                },
            }),
            this.prisma.order.count({ where }),
        ]);

        return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    async findOne(tenantId: string, id: string) {
        const order = await this.prisma.order.findFirst({
            where: { id, tenantId },
            include: {
                customer: true,
                items: { include: { product: true } },
                invoice: true,
            },
        });
        if (!order) throw new NotFoundException(`Order ${id} not found`);
        return order;
    }

    async create(tenantId: string, dto: CreateOrderDto): Promise<Prisma.OrderGetPayload<{ include: { items: true; customer: true } }>> {
        // Validate customer belongs to tenant
        const customer = await this.prisma.customer.findFirst({ where: { id: dto.customerId, tenantId } });
        if (!customer) throw new NotFoundException(`Customer ${dto.customerId} not found`);

        // Fetch products and validate stock — do this in a transaction to prevent race conditions
        const result = await this.prisma.$transaction(async (tx) => {
            const productIds = dto.items.map((i) => i.productId);
            const products = await tx.product.findMany({
                where: { id: { in: productIds }, tenantId, isActive: true },
            });

            if (products.length !== productIds.length) {
                const foundIds = products.map((p) => p.id);
                const missing = productIds.filter((id) => !foundIds.includes(id));
                throw new NotFoundException(`Products not found: ${missing.join(', ')}`);
            }

            // Validate & calculate items
            const orderItems = dto.items.map((item) => {
                const product = products.find((p) => p.id === item.productId)!;
                if (product.stockQuantity < item.quantity) {
                    throw new BadRequestException(
                        `Insufficient stock for "${product.name}" (SKU: ${product.sku}). Available: ${product.stockQuantity}, requested: ${item.quantity}`,
                    );
                }
                return {
                    productId: item.productId,
                    quantity: item.quantity,
                    unitPrice: product.price,
                    totalPrice: new Prisma.Decimal(product.price.toString()).mul(item.quantity),
                };
            });

            const subtotal = orderItems.reduce((sum, i) => sum.add(i.totalPrice), new Prisma.Decimal(0));
            const taxDecimal = new Prisma.Decimal((dto.taxPercent ?? 0) / 100);
            const taxAmount = subtotal.mul(taxDecimal);
            const total = subtotal.add(taxAmount);

            // Create order with items
            const order = await tx.order.create({
                data: {
                    tenantId,
                    customerId: dto.customerId,
                    orderNumber: `ORD-${Date.now()}`,
                    subtotal,
                    taxAmount,
                    total,
                    notes: dto.notes,
                    status: OrderStatus.PENDING,
                    items: { create: orderItems },
                },
                include: { items: true, customer: true },
            });

            // Auto-reduce stock on order creation
            await Promise.all(
                dto.items.map((item) =>
                    tx.product.update({
                        where: { id: item.productId },
                        data: { stockQuantity: { decrement: item.quantity } },
                    }),
                ),
            );

            // Auto-create a DRAFT invoice
            await tx.invoice.create({
                data: {
                    tenantId,
                    orderId: order.id,
                    invoiceNumber: `INV-${new Date().getFullYear()}-${uuidv4().substring(0, 8).toUpperCase()}`,
                    status: InvoiceStatus.DRAFT,
                    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // +30 days
                    subtotal,
                    taxAmount,
                    total,
                },
            });

            return order;
        });

        return result;
    }

    async updateStatus(tenantId: string, id: string, dto: UpdateOrderStatusDto) {
        const order = await this.findOne(tenantId, id);

        // Business rules for status transitions
        const allowedTransitions: Record<OrderStatus, OrderStatus[]> = {
            [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
            [OrderStatus.CONFIRMED]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
            [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED],
            [OrderStatus.DELIVERED]: [],
            [OrderStatus.CANCELLED]: [],
        };

        if (!allowedTransitions[order.status].includes(dto.status)) {
            throw new BadRequestException(
                `Cannot transition from ${order.status} to ${dto.status}. Allowed: ${allowedTransitions[order.status].join(', ') || 'none'}`,
            );
        }

        return this.prisma.order.update({ where: { id }, data: { status: dto.status } });
    }
}
