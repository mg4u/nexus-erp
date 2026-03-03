import { Injectable, NestMiddleware, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PrismaService } from '../../infrastructure/database/prisma.service';

export interface TenantRequest extends Request {
    tenantId: string;
}

// Paths that never require a tenant header
const PUBLIC_PATHS = [
    '/api/health',
    '/api/v1/auth/login',
    '/api/v1/auth/register',
    '/api/v1/auth/refresh',
    '/api/docs',
];

@Injectable()
export class TenantMiddleware implements NestMiddleware {
    constructor(private readonly prisma: PrismaService) { }

    async use(req: TenantRequest, _res: Response, next: NextFunction): Promise<void> {
        // Skip tenant check for public paths (health, auth, docs)
        const path = req.path || req.url || '';
        const isPublic = PUBLIC_PATHS.some(p => path.startsWith(p));
        if (isPublic) {
            return next();
        }

        const tenantId = req.headers['x-tenant-id'] as string | undefined;

        if (!tenantId) {
            throw new BadRequestException('X-Tenant-ID header is required');
        }

        // Validate tenant exists and is active
        const tenant = await this.prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { id: true, isActive: true },
        });

        if (!tenant) {
            throw new UnauthorizedException(`Tenant '${tenantId}' not found`);
        }

        if (!tenant.isActive) {
            throw new UnauthorizedException(`Tenant '${tenantId}' is inactive`);
        }

        req.tenantId = tenantId;
        next();
    }
}
