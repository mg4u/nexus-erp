import {
    Injectable,
    ConflictException,
    UnauthorizedException,
    NotFoundException,
    BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { RegisterDto, LoginDto, RefreshTokenDto } from './dto/auth.dto';
import * as bcrypt from 'bcrypt';
import { UserRole } from '@prisma/client';
import { JwtPayload } from '../../infrastructure/auth/jwt.strategy';

export interface AuthTokens {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
}

export interface AuthResponse extends AuthTokens {
    user: {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        role: UserRole;
        tenantId: string;
    };
    tenant: {
        id: string;
        name: string;
        slug: string;
    };
}

@Injectable()
export class AuthService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
    ) { }

    async register(dto: RegisterDto): Promise<AuthResponse> {
        // Check slug uniqueness
        const existingTenant = await this.prisma.tenant.findUnique({ where: { slug: dto.companySlug } });
        if (existingTenant) {
            throw new ConflictException(`Company slug '${dto.companySlug}' is already taken`);
        }

        const passwordHash = await bcrypt.hash(dto.password, this.configService.get<number>('bcryptRounds', 12));

        // Create tenant + admin user in a transaction
        const result = await this.prisma.$transaction(async (tx) => {
            const tenant = await tx.tenant.create({
                data: { name: dto.companyName, slug: dto.companySlug },
            });

            const user = await tx.user.create({
                data: {
                    tenantId: tenant.id,
                    email: dto.email,
                    passwordHash,
                    firstName: dto.firstName,
                    lastName: dto.lastName,
                    role: UserRole.ADMIN,
                },
            });

            return { tenant, user };
        });

        const tokens = await this.generateTokens(result.user.id, result.user.email, result.user.role, result.tenant.id);
        await this.updateRefreshToken(result.user.id, tokens.refreshToken);

        return {
            ...tokens,
            user: {
                id: result.user.id,
                email: result.user.email,
                firstName: result.user.firstName,
                lastName: result.user.lastName,
                role: result.user.role,
                tenantId: result.user.tenantId,
            },
            tenant: { id: result.tenant.id, name: result.tenant.name, slug: result.tenant.slug },
        };
    }

    async login(dto: LoginDto): Promise<AuthResponse> {
        // Find user across all tenants (email must be unique per tenant; we search globally for login)
        const user = await this.prisma.user.findFirst({
            where: { email: dto.email, isActive: true },
            include: { tenant: true },
        });

        if (!user) {
            throw new UnauthorizedException('Invalid email or password');
        }

        if (!user.tenant.isActive) {
            throw new UnauthorizedException('Your organization account is inactive');
        }

        const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
        if (!isPasswordValid) {
            throw new UnauthorizedException('Invalid email or password');
        }

        const tokens = await this.generateTokens(user.id, user.email, user.role, user.tenantId);
        await this.updateRefreshToken(user.id, tokens.refreshToken);

        // Update last login
        await this.prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
        });

        return {
            ...tokens,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role,
                tenantId: user.tenantId,
            },
            tenant: { id: user.tenant.id, name: user.tenant.name, slug: user.tenant.slug },
        };
    }

    async refresh(dto: RefreshTokenDto, userId: string): Promise<AuthTokens> {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, email: true, role: true, tenantId: true, refreshToken: true, isActive: true },
        });

        if (!user || !user.isActive) {
            throw new UnauthorizedException('User not found or inactive');
        }

        if (!user.refreshToken) {
            throw new UnauthorizedException('No refresh token found. Please login again');
        }

        const isValid = await bcrypt.compare(dto.refreshToken, user.refreshToken);
        if (!isValid) {
            throw new UnauthorizedException('Invalid refresh token');
        }

        const tokens = await this.generateTokens(user.id, user.email, user.role, user.tenantId);
        await this.updateRefreshToken(user.id, tokens.refreshToken);

        return tokens;
    }

    async logout(userId: string): Promise<{ message: string }> {
        await this.prisma.user.update({
            where: { id: userId },
            data: { refreshToken: null },
        });
        return { message: 'Logged out successfully' };
    }

    private async generateTokens(
        userId: string,
        email: string,
        role: UserRole,
        tenantId: string,
    ): Promise<AuthTokens> {
        const payload: JwtPayload = { sub: userId, email, role, tenantId };

        const [accessToken, refreshToken] = await Promise.all([
            this.jwtService.signAsync(payload, {
                secret: this.configService.get<string>('jwt.accessSecret'),
                expiresIn: this.configService.get<string>('jwt.accessExpiresIn', '15m'),
            }),
            this.jwtService.signAsync(payload, {
                secret: this.configService.get<string>('jwt.refreshSecret'),
                expiresIn: this.configService.get<string>('jwt.refreshExpiresIn', '7d'),
            }),
        ]);

        return { accessToken, refreshToken, expiresIn: 900 }; // 15 min in seconds
    }

    private async updateRefreshToken(userId: string, refreshToken: string): Promise<void> {
        const bcryptRounds = this.configService.get<number>('bcryptRounds', 12);
        const hashedRefreshToken = await bcrypt.hash(refreshToken, bcryptRounds);
        await this.prisma.user.update({
            where: { id: userId },
            data: { refreshToken: hashedRefreshToken },
        });
    }
}
