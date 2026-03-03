import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { UpdateInvoiceStatusDto, InvoicesQueryDto } from './dto/invoices-payments.dto';
import { InvoiceStatus, Prisma } from '@prisma/client';

@Injectable()
export class InvoicesService {
    constructor(private readonly prisma: PrismaService) { }

    async findAll(tenantId: string, query: InvoicesQueryDto) {
        const { page = 1, limit = 20, status } = query;
        const skip = (page - 1) * limit;

        const where: Prisma.InvoiceWhereInput = { tenantId, ...(status && { status }) };

        const [items, total] = await Promise.all([
            this.prisma.invoice.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    order: {
                        include: {
                            customer: { select: { id: true, firstName: true, lastName: true, email: true } },
                        },
                    },
                    payments: { select: { id: true, amount: true, method: true, paidAt: true } },
                },
            }),
            this.prisma.invoice.count({ where }),
        ]);

        return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    async findOne(tenantId: string, id: string) {
        const invoice = await this.prisma.invoice.findFirst({
            where: { id, tenantId },
            include: {
                order: { include: { customer: true, items: { include: { product: true } } } },
                payments: true,
            },
        });
        if (!invoice) throw new NotFoundException(`Invoice ${id} not found`);
        return invoice;
    }

    async updateStatus(tenantId: string, id: string, dto: UpdateInvoiceStatusDto) {
        const invoice = await this.findOne(tenantId, id);

        // Lifecycle: DRAFT → SENT → PAID | CANCELLED
        const allowedTransitions: Record<InvoiceStatus, InvoiceStatus[]> = {
            [InvoiceStatus.DRAFT]: [InvoiceStatus.SENT, InvoiceStatus.CANCELLED],
            [InvoiceStatus.SENT]: [InvoiceStatus.PAID, InvoiceStatus.CANCELLED],
            [InvoiceStatus.PAID]: [],
            [InvoiceStatus.CANCELLED]: [],
        };

        if (!allowedTransitions[invoice.status].includes(dto.status)) {
            throw new BadRequestException(
                `Cannot transition invoice from ${invoice.status} to ${dto.status}`,
            );
        }

        const updateData: Prisma.InvoiceUpdateInput = { status: dto.status };
        if (dto.status === InvoiceStatus.SENT) updateData.sentAt = new Date();
        if (dto.status === InvoiceStatus.PAID) updateData.paidAt = new Date();
        if (dto.status === InvoiceStatus.CANCELLED) updateData.cancelledAt = new Date();

        return this.prisma.invoice.update({ where: { id }, data: updateData });
    }

    async getOverdueSummary(tenantId: string) {
        const now = new Date();
        const overdue = await this.prisma.invoice.findMany({
            where: {
                tenantId,
                status: InvoiceStatus.SENT,
                dueDate: { lt: now },
            },
            include: {
                order: { include: { customer: { select: { firstName: true, lastName: true, email: true } } } },
            },
        });

        const totalAmount = overdue.reduce((sum, inv) => sum + Number(inv.total), 0);

        return { count: overdue.length, totalAmount, invoices: overdue };
    }
}
