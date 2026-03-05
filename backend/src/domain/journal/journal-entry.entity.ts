/**
 * Domain Entity: JournalEntry
 * Pure domain layer — zero external dependencies.
 * Encapsulates double-entry accounting business rules.
 */

export type JournalStatus = 'DRAFT' | 'POSTED' | 'REVERSED';

export interface JournalEntryProps {
    id: string;
    tenantId: string;
    referenceType: string | null;
    referenceId: string | null;
    description: string;
    status: JournalStatus;
    postedAt: Date | null;
    reversalOf: string | null;
    createdBy: string;
    createdAt: Date;
}

export class JournalEntryEntity {
    readonly id: string;
    readonly tenantId: string;
    readonly referenceType: string | null;
    readonly referenceId: string | null;
    readonly description: string;
    readonly status: JournalStatus;
    readonly postedAt: Date | null;
    readonly reversalOf: string | null;
    readonly createdBy: string;
    readonly createdAt: Date;

    constructor(props: JournalEntryProps) {
        this.id = props.id;
        this.tenantId = props.tenantId;
        this.referenceType = props.referenceType;
        this.referenceId = props.referenceId;
        this.description = props.description;
        this.status = props.status;
        this.postedAt = props.postedAt;
        this.reversalOf = props.reversalOf;
        this.createdBy = props.createdBy;
        this.createdAt = props.createdAt;
    }

    /**
     * A journal entry can only be reversed if it is in POSTED status.
     * REVERSED entries cannot be reversed again (double reversal prevention).
     */
    canBeReversed(): boolean {
        return this.status === 'POSTED';
    }

    /**
     * Posted and Reversed entries are immutable — no edits allowed.
     */
    isImmutable(): boolean {
        return this.status === 'POSTED' || this.status === 'REVERSED';
    }

    /**
     * Tenant boundary enforcement.
     */
    belongsTo(tenantId: string): boolean {
        return this.tenantId === tenantId;
    }

    /**
     * True only when the entry was created to reverse another entry.
     */
    isReversal(): boolean {
        return this.reversalOf !== null;
    }
}
