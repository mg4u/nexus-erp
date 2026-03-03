import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { CreateUserDto, UpdateUserDto, UsersQueryDto } from './dto/users.dto';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class UsersService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly configService: ConfigService,
    ) { }

    async findAll(tenantId: string, query: UsersQueryDto) {
        const { page = 1, limit = 20, role, search } = query;
        const skip = (page - 1) * limit;

        const where = {
            tenantId,
            ...(role && { role }),
            ...(search && {
                OR: [
                    { email: { contains: search, mode: 'insensitive' as const } },
                    { firstName: { contains: search, mode: 'insensitive' as const } },
                    { lastName: { contains: search, mode: 'insensitive' as const } },
                ],
            }),
        };

        const [items, total] = await Promise.all([
            this.prisma.user.findMany({
                where,
                skip,
                take: limit,
                select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                    role: true,
                    isActive: true,
                    lastLoginAt: true,
                    createdAt: true,
                },
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.user.count({ where }),
        ]);

        return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    async findOne(tenantId: string, id: string) {
        const user = await this.prisma.user.findFirst({
            where: { id, tenantId },
            select: {
                id: true, email: true, firstName: true, lastName: true,
                role: true, isActive: true, lastLoginAt: true, createdAt: true,
            },
        });

        if (!user) throw new NotFoundException(`User ${id} not found`);
        return user;
    }

    async create(tenantId: string, dto: CreateUserDto) {
        const existing = await this.prisma.user.findFirst({ where: { tenantId, email: dto.email } });
        if (existing) throw new ConflictException(`Email '${dto.email}' is already registered in this tenant`);

        const rounds = this.configService.get<number>('bcryptRounds', 12);
        const passwordHash = await bcrypt.hash(dto.password, rounds);

        const user = await this.prisma.user.create({
            data: { tenantId, email: dto.email, passwordHash, firstName: dto.firstName, lastName: dto.lastName, role: dto.role },
            select: {
                id: true, email: true, firstName: true, lastName: true, role: true, isActive: true, createdAt: true,
            },
        });
        return user;
    }

    async update(tenantId: string, id: string, dto: UpdateUserDto) {
        await this.findOne(tenantId, id);

        const data: Record<string, unknown> = { ...dto };
        if (dto.password) {
            const rounds = this.configService.get<number>('bcryptRounds', 12);
            data.passwordHash = await bcrypt.hash(dto.password, rounds);
            delete data.password;
        }

        return this.prisma.user.update({
            where: { id },
            data,
            select: { id: true, email: true, firstName: true, lastName: true, role: true, isActive: true, updatedAt: true },
        });
    }

    async deactivate(tenantId: string, id: string) {
        await this.findOne(tenantId, id);
        return this.prisma.user.update({ where: { id }, data: { isActive: false }, select: { id: true, isActive: true } });
    }
}
