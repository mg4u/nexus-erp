# Journal Entries & Double-Entry Accounting

> Last Updated: 2026-03-05

---

## Overview

The SaaS ERP platform implements a full **double-entry accounting engine** that automatically generates balanced journal entries when invoices are posted and payments are recorded. This ensures the General Ledger always reflects the true financial state of each tenant — without requiring manual journal creation for standard flows.

### Core Principle: The Accounting Equation

```
Assets = Liabilities + Equity
```

Every financial transaction is recorded as a journal entry with **at least two lines** where:

```
SUM(Debits) == SUM(Credits)    ← System invariant. Violation = corruption.
```

---

## Key Concepts

### What Is a Journal Entry?

A journal entry is the foundational record of a financial transaction. Each entry contains:

| Field           | Description                                              |
|-----------------|----------------------------------------------------------|
| `id`            | UUID primary key                                         |
| `tenantId`      | Tenant isolation                                         |
| `description`   | Human-readable summary (e.g. "Auto-post: Invoice INV-2025-0001") |
| `referenceType` | Source document type: `INVOICE`, `PAYMENT`, or `MANUAL`  |
| `referenceId`   | UUID of the source invoice/payment (nullable for manual) |
| `status`        | `DRAFT` → `POSTED` → `REVERSED`                         |
| `createdBy`     | The user who initiated the transaction                   |
| `postedAt`      | Timestamp when the entry was finalized                   |
| `reversalOf`    | Self-referential FK for reversal entries                 |

### What Is a Journal Entry Line?

Each line represents one side of the transaction:

| Field            | Description                                  |
|------------------|----------------------------------------------|
| `accountId`      | FK to Chart of Accounts (must be postable)   |
| `debit`          | Amount debited (Decimal 18,4)                |
| `credit`         | Amount credited (Decimal 18,4)               |
| `description`    | Optional line-level note                     |

**Rules:**
- A line can have **either** a debit or credit > 0, but **never both**.
- A line with both debit and credit = 0 is rejected.

---

## Accounts Used in Automation

These accounts are resolved by **code** from the Chart of Accounts:

| Code   | Name                       | Type      | Normal Balance |
|--------|----------------------------|-----------|----------------|
| `1110` | Cash and Cash Equivalents  | Asset     | Debit          |
| `1120` | Accounts Receivable        | Asset     | Debit          |
| `4100` | Sales Revenue              | Revenue   | Credit         |
| `2130` | Tax Payable                | Liability | Credit         |

All accounts must be:
- **Active** (`isActive = true`)
- **Postable** (`isPostable = true`) — only leaf accounts (no children)
- **Owned by the tenant** — cross-tenant posting is forbidden

---

## Automated Flows

### 1. Invoice Posted (Status → `SENT`)

When an invoice transitions from `DRAFT` to `SENT`, the system automatically generates:

```
┌────────────────────────────────────────────────────────────┐
│  Journal Entry: "Auto-post: Invoice INV-2025-0001"         │
├──────────────────────────┬──────────┬──────────────────────┤
│  Account                 │  Debit   │  Credit              │
├──────────────────────────┼──────────┼──────────────────────┤
│  Accounts Receivable     │  1,889.98│                      │
│  Sales Revenue           │          │  1,749.98            │
│  Tax Payable             │          │    140.00            │
├──────────────────────────┼──────────┼──────────────────────┤
│  TOTAL                   │  1,889.98│  1,889.98  ✓ Balanced│
└──────────────────────────┴──────────┴──────────────────────┘
```

**What happens:**
1. Idempotency check — if a journal entry already exists for this invoice, a `409 Conflict` is raised.
2. The AR, Revenue, and Tax Payable accounts are resolved by code.
3. If `taxAmount > 0` and a Tax Payable account exists → tax is split out.
4. If `taxAmount > 0` but no Tax Payable account → full amount goes to Revenue (with a warning log).
5. The journal entry is created as `DRAFT`, validated (debit = credit, accounts postable), promoted to `POSTED`.
6. The `journalEntryId` FK is set on the invoice atomically.

### 2. Payment Received

When a payment is created against an invoice:

```
┌────────────────────────────────────────────────────────────┐
│  Journal Entry: "Auto-post: Payment for Invoice INV-..."   │
├──────────────────────────┬──────────┬──────────────────────┤
│  Account                 │  Debit   │  Credit              │
├──────────────────────────┼──────────┼──────────────────────┤
│  Cash / Bank             │   500.00 │                      │
│  Accounts Receivable     │          │   500.00             │
├──────────────────────────┼──────────┼──────────────────────┤
│  TOTAL                   │   500.00 │   500.00   ✓ Balanced│
└──────────────────────────┴──────────┴──────────────────────┘
```

**What happens:**
1. Payment is created inside a DB transaction (validates invoice status, overpayment, etc.).
2. Invoice status updates to `PARTIALLY_PAID` or `PAID` depending on total amount received.
3. After the payment transaction commits, a journal entry is auto-posted.
4. The `journalEntryId` FK is set on the payment atomically.

### 3. Invoice Cancelled

When an invoice that was previously posted is cancelled:

```
┌────────────────────────────────────────────────────────────┐
│  Journal Entry: "REVERSAL of: Auto-post: Invoice INV-..."  │
├──────────────────────────┬──────────┬──────────────────────┤
│  Account                 │  Debit   │  Credit              │
├──────────────────────────┼──────────┼──────────────────────┤
│  Sales Revenue           │  1,749.98│                      │
│  Tax Payable             │    140.00│                      │
│  Accounts Receivable     │          │  1,889.98            │
├──────────────────────────┼──────────┼──────────────────────┤
│  TOTAL                   │  1,889.98│  1,889.98  ✓ Balanced│
└──────────────────────────┴──────────┴──────────────────────┘
```

**What happens:**
1. The original journal entry is found via `invoice.journalEntryId`.
2. A mirror reversal entry is created — debits and credits are **swapped**.
3. The original entry status is set to `REVERSED`.
4. `invoice.journalEntryId` is cleared.
5. Net effect on every account = zero.

---

## Invoice Status Lifecycle

```
  DRAFT ──→ SENT ──→ PARTIALLY_PAID ──→ PAID
    │         │             │
    └─────────┴─────────────┴──→ CANCELLED
```

| Transition           | Financial Effect                          |
|----------------------|-------------------------------------------|
| `DRAFT → SENT`       | Auto-generates invoice journal entry      |
| `SENT → PARTIALLY_PAID` | Updated by payment service             |
| `PARTIALLY_PAID → PAID` | Updated by payment service             |
| `* → CANCELLED`      | Auto-reverses linked journal entry        |

---

## Idempotency & Safety

| Protection                  | Mechanism                                            |
|-----------------------------|------------------------------------------------------|
| Duplicate invoice posting   | Check `referenceType=INVOICE + referenceId` uniqueness → `409 Conflict` |
| Duplicate payment posting   | Check `referenceType=PAYMENT + referenceId` uniqueness → `409 Conflict` |
| Double reversal             | Check `reversals.length > 0` → `409 Conflict`       |
| Cross-tenant access         | `tenantId` enforced on every query                   |
| Unbalanced entries          | `SUM(debit) == SUM(credit)` validated before posting |
| Non-postable accounts       | `account.isPostable` checked before posting          |
| Inactive accounts           | `account.isActive` checked before posting            |
| Atomicity                   | All operations run inside Prisma `$transaction`      |

---

## RBAC Permissions

| Action                         | Allowed Roles                    |
|--------------------------------|----------------------------------|
| View journal entries           | Admin, Manager, Accountant       |
| Post manual journal entry      | Admin, Accountant                |
| Reverse journal entry          | Admin only                       |
| Update invoice status          | Admin, Manager, Accountant       |
| Create payment                 | Admin, Manager, Accountant       |
| View trial balance             | Admin, Manager, Accountant       |
| Validate global equality       | Admin only                       |

---

## API Endpoints

### Journal Entries

| Method | Endpoint                                     | Description                                |
|--------|----------------------------------------------|--------------------------------------------|
| GET    | `/api/v1/journal-entries`                    | List entries (paginated, filterable)       |
| GET    | `/api/v1/journal-entries/:id`                | Get entry with full line details           |
| POST   | `/api/v1/journal-entries`                    | Post a manual journal entry                |
| POST   | `/api/v1/journal-entries/:id/reverse`        | Reverse a posted entry (Admin only)        |
| GET    | `/api/v1/journal-entries/trial-balance`      | Generate trial balance (Redis-cached)      |
| GET    | `/api/v1/journal-entries/validate`           | Validate SUM(debit)==SUM(credit) (Admin)   |

### Invoices (triggers journal automation)

| Method | Endpoint                                     | Description                                |
|--------|----------------------------------------------|--------------------------------------------|
| PATCH  | `/api/v1/invoices/:id/status`                | Update status (auto-posts on SENT, auto-reverses on CANCELLED) |

### Payments (triggers journal automation)

| Method | Endpoint                                     | Description                                |
|--------|----------------------------------------------|--------------------------------------------|
| POST   | `/api/v1/payments`                           | Create payment (auto-posts journal entry)  |

---

## Trial Balance & Validation

### Trial Balance

The trial balance aggregates debits and credits per account from all `POSTED` journal entries. It is:

- **Redis-cached** (5-minute TTL for live queries)
- **Filterable** by `asOfDate` for point-in-time reporting
- **Auto-invalidated** when any new journal entry is posted or reversed

### Global Equality Validation

The `/validate` endpoint checks the system invariant:

```
SUM(all debits across all POSTED entries) == SUM(all credits across all POSTED entries)
```

If this invariant is violated, the system logs a **critical error** — this indicates data corruption.

---

## Database Schema

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   Invoice    │     │  JournalEntry    │     │ JournalEntryLine │
│──────────────│     │──────────────────│     │──────────────────│
│ journalEntryId├───►│ id               │◄────│ journalEntryId   │
│ status       │     │ referenceType    │     │ accountId        │──►┌──────────┐
│ total        │     │ referenceId      │     │ debit            │   │ Account  │
│ subtotal     │     │ status           │     │ credit           │   │──────────│
│ taxAmount    │     │ reversalOf ──────├──┐  │ description      │   │ code     │
└──────────────┘     │ postedAt         │  │  └──────────────────┘   │ name     │
                     │ createdBy        │  │                         │ isPostable│
┌──────────────┐     └──────────────────┘  │                         └──────────┘
│   Payment    │            ▲              │
│──────────────│            │              │
│ journalEntryId├───────────┘              │
│ amount       │     (self-referential     │
│ method       │      for reversals) ◄─────┘
└──────────────┘
```

---

## Files Involved

| File | Role |
|------|------|
| `backend/prisma/schema.prisma` | Database models, enums, relations |
| `backend/src/application/journal/journal.service.ts` | Core accounting engine |
| `backend/src/application/invoices/invoices.service.ts` | Invoice lifecycle + automation triggers |
| `backend/src/application/payments/payments.service.ts` | Payment creation + automation triggers |
| `backend/src/presentation/journal/journal.controller.ts` | REST API for journal entries |
| `backend/src/infrastructure/journal/journal-cache.service.ts` | Redis cache for trial balance |
| `backend/prisma/seed.ts` | Chart of Accounts seed data |
