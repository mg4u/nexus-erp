/**
 * Domain Entity: Account
 * Pure domain layer — zero external dependencies.
 * Encapsulates Chart of Accounts business rules.
 */

export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';

export interface AccountProps {
    id: string;
    tenantId: string;
    code: string;
    name: string;
    type: AccountType;
    parentId: string | null;
    level: number;
    isSystem: boolean;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export class AccountEntity {
    readonly id: string;
    readonly tenantId: string;
    readonly code: string;
    readonly name: string;
    readonly type: AccountType;
    readonly parentId: string | null;
    readonly level: number;
    readonly isSystem: boolean;
    readonly isActive: boolean;
    readonly createdAt: Date;
    readonly updatedAt: Date;

    constructor(props: AccountProps) {
        this.id = props.id;
        this.tenantId = props.tenantId;
        this.code = props.code;
        this.name = props.name;
        this.type = props.type;
        this.parentId = props.parentId;
        this.level = props.level;
        this.isSystem = props.isSystem;
        this.isActive = props.isActive;
        this.createdAt = props.createdAt;
        this.updatedAt = props.updatedAt;
    }

    /**
     * Account code must be alphanumeric, optionally separated by dashes or dots.
     * Examples: "1000", "1-100", "1.100"
     */
    static isValidCode(code: string): boolean {
        return /^[A-Za-z0-9]([A-Za-z0-9.\-]*[A-Za-z0-9])?$/.test(code);
    }

    /**
     * System accounts (seeded defaults) cannot be deleted.
     */
    canBeDeleted(): boolean {
        return !this.isSystem;
    }

    /**
     * An account can be disabled even if it is a system account —
     * deletion is the hard constraint.
     */
    canBeDisabled(): boolean {
        return this.isActive;
    }

    /**
     * Returns whether this account belongs to the given tenant.
     * Used to enforce cross-tenant boundary checks.
     */
    belongsTo(tenantId: string): boolean {
        return this.tenantId === tenantId;
    }
}
