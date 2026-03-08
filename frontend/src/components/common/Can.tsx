import { ReactNode } from 'react';
import { useAuthStore } from '../../store/auth.store';
import { can, RbacModule, RbacAction } from '../../utils/rbac';

interface CanProps {
    module: RbacModule;
    action: RbacAction;
    children: ReactNode;
    fallback?: ReactNode;
}

export function Can({ module, action, children, fallback = null }: CanProps) {
    const user = useAuthStore((state) => state.user);

    if (can(user?.role, module, action)) {
        return <>{children}</>;
    }

    return <>{fallback}</>;
}
