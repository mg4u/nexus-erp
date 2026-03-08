import { SetMetadata } from '@nestjs/common';
import { RbacAction, RbacModule } from '../rbac/rbac.config';

export const PERMISSIONS_KEY = 'permissions';

export interface RequiredPermission {
    module: RbacModule;
    action: RbacAction;
}

export const RequirePermissions = (module: RbacModule, action: RbacAction) =>
    SetMetadata(PERMISSIONS_KEY, { module, action });
