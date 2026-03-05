/**
 * Domain Value Object: JournalEntryLine
 * Represents a single debit or credit line in a double-entry journal.
 */

export interface JournalEntryLineProps {
    id: string;
    journalEntryId: string;
    accountId: string;
    debit: number;
    credit: number;
    description: string | null;
}

export class JournalEntryLineEntity {
    readonly id: string;
    readonly journalEntryId: string;
    readonly accountId: string;
    readonly debit: number;
    readonly credit: number;
    readonly description: string | null;

    constructor(props: JournalEntryLineProps) {
        this.id = props.id;
        this.journalEntryId = props.journalEntryId;
        this.accountId = props.accountId;
        this.debit = props.debit;
        this.credit = props.credit;
        this.description = props.description;
    }

    /**
     * A valid line has either debit > 0 OR credit > 0, not both and not neither.
     * Values must be non-negative.
     * Allows debit=0,credit=0 in reversal context when amounts cancel out — use isZero() to detect.
     */
    isValidAmount(): boolean {
        if (this.debit < 0 || this.credit < 0) return false;
        // At least one must be positive; both being positive is invalid
        const hasDebit = this.debit > 0;
        const hasCredit = this.credit > 0;
        return hasDebit !== hasCredit; // XOR
    }

    /**
     * Zero-value line (debit = 0, credit = 0) — should be rejected.
     */
    isZero(): boolean {
        return this.debit === 0 && this.credit === 0;
    }
}
