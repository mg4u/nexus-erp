import { UserRole } from '@prisma/client';

export type RbacAction = 'create' | 'read' | 'update' | 'delete' | 'check_trial_balance';
export type RbacModule =
    | 'users'
    | 'chart_of_accounts'
    | 'journals'
    | 'invoices'
    | 'payments'
    | 'customers'
    | 'products'
    | 'orders'
    | 'reports'
    | 'profit_loss_report';

export type RolePermissions = {
    [K in RbacModule]?: RbacAction[];
};

export const PERMISSIONS_MATRIX: Record<UserRole, RolePermissions> = {
    [UserRole.ADMIN]: {
        users: ['create', 'read', 'update', 'delete'],
        chart_of_accounts: ['create', 'read', 'update', 'delete'],
        journals: ['create', 'read', 'update', 'check_trial_balance'],
        invoices: ['read', 'update'],
        payments: ['create', 'read'],
        customers: ['create', 'read', 'update', 'delete'],
        products: ['create', 'read', 'update', 'delete'],
        orders: ['create', 'read', 'update', 'delete'],
        reports: ['read'],
        profit_loss_report: ['read'],
    },
    [UserRole.MANAGER]: {
        users: ['read'],
        chart_of_accounts: ['read'],
        journals: ['read'],
        customers: ['create', 'read', 'update'],
        products: ['create', 'read', 'update'],
        orders: ['create', 'read', 'update'],
        invoices: ['read', 'update'],
        payments: ['read'],
        reports: ['read'],
        profit_loss_report: ['read'],
    },
    [UserRole.ACCOUNTANT]: {
        chart_of_accounts: ['read'],
        journals: ['create', 'read', 'update'],
        customers: ['read'],
        products: ['read'],
        orders: ['read'],
        invoices: ['read', 'update'],
        payments: ['create', 'read', 'update'],
        reports: ['read'],
        profit_loss_report: ['read'],
    },
    [UserRole.EMPLOYEE]: {
        customers: ['read'],
        products: ['read'],
        orders: ['create', 'read'],
        invoices: ['read'],
    },
};

export function checkPermission(role: UserRole, module: RbacModule, action: RbacAction): boolean {
    if (role === UserRole.ADMIN) {
        return true; // Admin has full access to all actions and modules
    }

    const rolePermissions = PERMISSIONS_MATRIX[role];
    if (!rolePermissions) {
        return false;
    }

    const modulePermissions = rolePermissions[module];
    if (!modulePermissions) {
        return false;
    }

    return modulePermissions.includes(action);
}
