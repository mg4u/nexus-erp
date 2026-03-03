import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { CreateCustomerDto, UpdateCustomerDto, CustomersQueryDto } from './dto/customers.dto';

@Injectable()
export class CustomersService {
    constructor(private readonly prisma: PrismaService) { }

    async findAll(tenantId: string, query: CustomersQueryDto) {
        const { page = 1, limit = 20, search } = query;
        const skip = (page - 1) * limit;

        const where: Record<string, unknown> = { tenantId, isActive: true };
        if (search) {
            where.OR = [
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
            ];
        }

        const [items, total] = await Promise.all([
            this.prisma.customer.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
            this.prisma.customer.count({ where }),
        ]);

        return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    async findOne(tenantId: string, id: string) {
        const customer = await this.prisma.customer.findFirst({
            where: { id, tenantId },
            include: {
                orders: {
                    orderBy: { createdAt: 'desc' },
                    take: 10,
                    select: { id: true, orderNumber: true, status: true, total: true, createdAt: true },
                },
            },
        });
        if (!customer) throw new NotFoundException(`Customer ${id} not found`);
        return customer;
    }

    async create(tenantId: string, dto: CreateCustomerDto) {
        return this.prisma.customer.create({ data: { tenantId, ...dto } });
    }

    async update(tenantId: string, id: string, dto: UpdateCustomerDto) {
        await this.findOne(tenantId, id);
        return this.prisma.customer.update({ where: { id }, data: dto });
    }

    async remove(tenantId: string, id: string) {
        await this.findOne(tenantId, id);
        return this.prisma.customer.update({ where: { id }, data: { isActive: false } });
    }
}
