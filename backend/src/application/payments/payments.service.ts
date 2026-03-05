import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { CreatePaymentDto, PaymentsQueryDto } from '../invoices/dto/invoices-payments.dto';
import { InvoiceStatus, Prisma } from '@prisma/client';
import { JournalService } from '../journal/journal.service';

@Injectable()
export class PaymentsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly journalService: JournalService,
    ) { }

    async findAll(tenantId: string, query: PaymentsQueryDto) {
        const { page = 1, limit = 20, invoiceId } = query;
        const skip = (page - 1) * limit;

        const where: Prisma.PaymentWhereInput = { tenantId, ...(invoiceId && { invoiceId }) };

        const [items, total] = await Promise.all([
            this.prisma.payment.findMany({
                where,
                skip,
                take: limit,
                orderBy: { paidAt: 'desc' },
                include: {
                    invoice: {
                        select: { invoiceNumber: true, total: true, status: true },
                    },
                },
            }),
            this.prisma.payment.count({ where }),
        ]);

        return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    async create(tenantId: string, dto: CreatePaymentDto, userId: string) {
        const payment = await this.prisma.$transaction(async (tx) => {
            // Lock invoice row and validate
            const invoice = await tx.invoice.findFirst({
                where: { id: dto.invoiceId, tenantId },
                include: { payments: { select: { amount: true } } },
            });

            if (!invoice) throw new NotFoundException(`Invoice ${dto.invoiceId} not found`);

            if (invoice.status === InvoiceStatus.CANCELLED) {
                throw new BadRequestException('Cannot add payment to a cancelled invoice');
            }

            if (invoice.status === InvoiceStatus.PAID) {
                throw new BadRequestException('Invoice is already fully paid');
            }

            if (invoice.status === InvoiceStatus.DRAFT) {
                throw new BadRequestException('Invoice must be sent before payment can be recorded');
            }

            // Check overpayment
            const totalPaid = invoice.payments.reduce((sum, p) => sum + Number(p.amount), 0);
            const remaining = Number(invoice.total) - totalPaid;

            if (dto.amount > remaining + 0.01) {
                throw new BadRequestException(
                    `Payment amount ($${dto.amount}) exceeds remaining balance ($${remaining.toFixed(2)})`,
                );
            }

            // Create payment
            const newPayment = await tx.payment.create({
                data: {
                    tenantId,
                    invoiceId: dto.invoiceId,
                    amount: dto.amount,
                    method: dto.method,
                    reference: dto.reference,
                    notes: dto.notes,
                },
            });

            // Update invoice status: PAID or PARTIALLY_PAID
            const newTotalPaid = totalPaid + dto.amount;
            if (newTotalPaid >= Number(invoice.total) - 0.01) {
                await tx.invoice.update({
                    where: { id: dto.invoiceId },
                    data: { status: InvoiceStatus.PAID, paidAt: new Date() },
                });
            } else if (newTotalPaid > 0) {
                await tx.invoice.update({
                    where: { id: dto.invoiceId },
                    data: { status: InvoiceStatus.PARTIALLY_PAID },
                });
            }

            return newPayment;
        });

        // ── Financial Automation: auto-post payment journal entry ─────────
        await this.journalService.autoPostPayment(tenantId, userId, payment.id);

        return payment;
    }
}
