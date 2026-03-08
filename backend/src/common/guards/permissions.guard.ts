import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY, RequiredPermission } from '../decorators/require-permissions.decorator';
import { AuthUser } from '../decorators/current-user.decorator';
import { checkPermission } from '../rbac/rbac.config';

@Injectable()
export class PermissionsGuard implements CanActivate {
    constructor(private readonly reflector: Reflector) { }

    canActivate(context: ExecutionContext): boolean {
        const requiredPermission = this.reflector.getAllAndOverride<RequiredPermission>(PERMISSIONS_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        if (!requiredPermission) {
            // If no permissions are required, allow access
            return true;
        }

        const request = context.switchToHttp().getRequest<{ user: AuthUser; tenantId: string }>();
        const user = request.user;
        const tenantId = request.tenantId;

        if (!user) {
            throw new ForbiddenException('Authentication required');
        }

        // Additional safety check: Validate that the token's tenant matches the requested bound tenant from middleware
        // This stops cross-tenant requests even if the user has correct roles inside their own tenant.
        if (user.tenantId !== tenantId) {
            throw new ForbiddenException('Tenant mismatch: Cannot access resources for this tenant');
        }

        const hasPermission = checkPermission(user.role, requiredPermission.module, requiredPermission.action);

        if (!hasPermission) {
            throw new ForbiddenException(
                `Access denied. You do not have permission to perform '${requiredPermission.action}' on '${requiredPermission.module}'`,
            );
        }

        return true;
    }
}
