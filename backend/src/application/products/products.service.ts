import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { CreateProductDto, UpdateProductDto, ProductsQueryDto, AdjustStockDto } from './dto/products.dto';

@Injectable()
export class ProductsService {
    constructor(private readonly prisma: PrismaService) { }

    async findAll(tenantId: string, query: ProductsQueryDto) {
        const { page = 1, limit = 20, category, search, lowStock } = query;
        const skip = (page - 1) * limit;

        const where: Record<string, unknown> = { tenantId, isActive: true };
        if (category) where.category = category;
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { sku: { contains: search, mode: 'insensitive' } },
            ];
        }
        if (lowStock) {
            where.stockQuantity = { lte: this.prisma.$queryRaw`"lowStockAlert"` };
        }

        const [items, total] = await Promise.all([
            this.prisma.product.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.product.count({ where }),
        ]);

        return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    async findLowStock(tenantId: string) {
        return this.prisma.product.findMany({
            where: { tenantId, isActive: true, stockQuantity: { lte: 10 } },
            orderBy: { stockQuantity: 'asc' },
        });
    }

    async findOne(tenantId: string, id: string) {
        const product = await this.prisma.product.findFirst({ where: { id, tenantId } });
        if (!product) throw new NotFoundException(`Product ${id} not found`);
        return product;
    }

    async create(tenantId: string, dto: CreateProductDto) {
        const existing = await this.prisma.product.findFirst({ where: { tenantId, sku: dto.sku } });
        if (existing) throw new ConflictException(`SKU '${dto.sku}' already exists in this tenant`);

        return this.prisma.product.create({ data: { tenantId, ...dto } });
    }

    async update(tenantId: string, id: string, dto: UpdateProductDto) {
        await this.findOne(tenantId, id);

        if (dto.sku) {
            const existing = await this.prisma.product.findFirst({
                where: { tenantId, sku: dto.sku, NOT: { id } },
            });
            if (existing) throw new ConflictException(`SKU '${dto.sku}' already in use`);
        }

        return this.prisma.product.update({ where: { id }, data: dto });
    }

    async adjustStock(tenantId: string, id: string, dto: AdjustStockDto) {
        const product = await this.findOne(tenantId, id);
        const newQuantity = product.stockQuantity + dto.quantity;
        if (newQuantity < 0) {
            throw new BadRequestException(`Insufficient stock. Available: ${product.stockQuantity}, requested reduction: ${Math.abs(dto.quantity)}`);
        }
        return this.prisma.product.update({
            where: { id },
            data: { stockQuantity: newQuantity },
        });
    }

    async remove(tenantId: string, id: string) {
        await this.findOne(tenantId, id);
        return this.prisma.product.update({ where: { id }, data: { isActive: false } });
    }
}
