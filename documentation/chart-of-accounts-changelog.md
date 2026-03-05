# Financial Chart of Accounts Feature — Change Log
**Date:** 2026-03-04  
**Author:** AI Engineering Assistant  
**Ticket / Feature:** `financial-chart-of-accounts`

---

## Summary

Implemented a production-grade, multi-tenant, hierarchical Chart of Accounts (CoA) feature across the full stack — Prisma schema, backend domain/application/infrastructure/presentation layers, Redis caching, Swagger docs, unit tests, frontend UI, and docker-compose migration workflow.

---

## Files Changed

### Backend

| File | Change |
|------|--------|
| `backend/prisma/schema.prisma` | Added `AccountType` enum (ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE), `Account` model with self-referencing hierarchy, and `accounts` relation on `Tenant` |
| `backend/prisma/seed.ts` | Added `seedChartOfAccounts()` helper seeding 28 default accounts (5 types, 3 levels deep) for `acmeTenant` |
| `backend/src/domain/accounts/account.entity.ts` | **[NEW]** Pure domain entity with code validation, deletion guard, and tenant boundary check |
| `backend/src/application/accounts/dto/accounts.dto.ts` | **[NEW]** `CreateAccountDto`, `UpdateAccountDto`, `AccountsQueryDto` with full class-validator and Swagger decorators |
| `backend/src/application/accounts/accounts.service.ts` | **[NEW]** Full application service: create, update, disable, delete, findAll, findOne, getTree (Redis-cached), seedDefaultCoA — with circular reference prevention, tenant isolation, and `$transaction` usage |
| `backend/src/application/accounts/accounts.service.spec.ts` | **[NEW]** 17 Jest unit tests: create (happy path, duplicate, missing parent, level calculation), getTree (cache hit, miss, tree build), disable (children guard, not found), delete (system guard, children guard, not found), domain code validation |
| `backend/src/infrastructure/accounts/account-cache.service.ts` | **[NEW]** Redis cache wrapper for the CoA tree: `getTree`, `setTree` (TTL 300s), `invalidate` — with graceful degradation on Redis failures |
| `backend/src/presentation/accounts/accounts.controller.ts` | **[NEW]** 8 REST endpoints with Swagger decorators and full RBAC (Admin/Accountant/Manager/Employee) |
| `backend/src/presentation/accounts/accounts.module.ts` | **[NEW]** NestJS module wiring AccountsController, AccountsService, AccountCacheService |
| `backend/src/app.module.ts` | Registered `AccountsModule` |

### Frontend

| File | Change |
|------|--------|
| `frontend/src/api/services.ts` | Added `Account`, `AccountTreeNode`, `CreateAccountPayload`, `UpdateAccountPayload` types and `accountsApi` object (getAll, getOne, getTree, create, update, disable, delete, seedDefaultCoA) |
| `frontend/src/pages/ChartOfAccountsPage.tsx` | **[NEW]** Full feature page: collapsible tree view with depth indentation, flat list toggle, 5-type summary strip with color coding, search/filter, create/edit modal with parent selector, soft-disable, delete confirmation modal, one-click seed defaults |
| `frontend/src/App.tsx` | Added `ChartOfAccountsPage` import and `/accounts` route |
| `frontend/src/components/layout/AppLayout.tsx` | Added "Chart of Accounts" entry in sidebar nav with `BookOpen` icon |

### Infrastructure / DevOps

| File | Change |
|------|--------|
| `docker-compose.yml` | Updated `migrate` service: changed from `prisma db push` (schema sync) to `prisma migrate deploy` (proper migration files) + seed, so the new `add_chart_of_accounts` migration runs correctly in all environments |

---

## API Endpoints (v1)

| Method | Path | Description | Roles |
|--------|------|-------------|-------|
| `GET` | `/v1/accounts` | Paginated flat list (filterable by type, search, activeOnly) | Admin, Accountant, Manager |
| `GET` | `/v1/accounts/tree` | Full hierarchical tree (Redis-cached, TTL 5min) | Admin, Accountant, Manager |
| `GET` | `/v1/accounts/:id` | Single account with direct children | Admin, Accountant, Manager |
| `POST` | `/v1/accounts` | Create account (unique code, parent validation, circular-ref check) | Admin, Accountant |
| `POST` | `/v1/accounts/seed` | Seed 28 default accounts for tenant (idempotent) | Admin |
| `PATCH` | `/v1/accounts/:id` | Update name, code, type, or parent | Admin, Accountant |
| `PATCH` | `/v1/accounts/:id/disable` | Soft-disable account (guards: active children) | Admin, Accountant |
| `DELETE` | `/v1/accounts/:id` | Delete account (guards: system, children) | Admin |

All endpoints require `Authorization: Bearer <JWT>` and `X-Tenant-ID` headers.

---

## Database Schema Changes

```prisma
enum AccountType {
  ASSET | LIABILITY | EQUITY | REVENUE | EXPENSE
}

model Account {
  id, tenantId, code, name, type, parentId (nullable),
  level, isSystem, isActive, createdAt, updatedAt

  Unique: (tenantId, code)
  Indexes: (tenantId, parentId), (tenantId, type),
           (tenantId, isActive), (tenantId, createdAt)
  Self-relation: parent / children via "AccountHierarchy"
}
```

---

## Domain Business Rules Enforced

- Account code must be unique per tenant
- Parent account must belong to the same tenant
- Circular parent references are detected and rejected
- System accounts (`isSystem=true`) cannot be deleted
- Accounts with active children cannot be disabled
- Accounts with children cannot be deleted
- Employee role has no access to any `/accounts` endpoint
- All mutations invalidate the Redis tree cache for that tenant

---

## Caching Strategy

- Key: `coa:tree:{tenantId}`
- TTL: 300 seconds (5 minutes)
- Invalidated on: create, update, disable, delete, seed
- Graceful degradation: Redis errors fall through to DB without crashing

---

## How to Run (Docker Compose)

```bash
# 1. Start infrastructure (postgres + redis)
docker compose up postgres redis -d

# 2. Run migrations + seed (one-shot)
docker compose --profile migrate up migrate

# 3. Start backend + frontend
docker compose up backend frontend -d

# After startup, access:
#   API Swagger: http://localhost:3000/docs
#   Frontend:    http://localhost:80
#   CoA Page:    http://localhost:80/accounts
```

### Seed Default CoA via API
```bash
# Login first to get JWT
curl -X POST http://localhost:3000/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@acme.com","password":"Secret123!"}'

# Then seed (replace <JWT> and <TENANT_ID>)
curl -X POST http://localhost:3000/v1/accounts/seed \
  -H "Authorization: Bearer <JWT>" \
  -H "X-Tenant-ID: <TENANT_ID>"
```

---

## Test Coverage

| Test Case | Module | Assertion |
|-----------|--------|-----------|
| Create — happy path | AccountsService | Account created, cache invalidated |
| Create — duplicate code | AccountsService | Throws ConflictException |
| Create — missing parent | AccountsService | Throws NotFoundException |
| Create — level from parent | AccountsService | level = parent.level + 1 |
| getTree — cache hit | AccountsService | DB not queried |
| getTree — cache miss | AccountsService | DB queried, tree cached |
| getTree — tree structure | AccountsService | Correct parent/child nesting |
| disable — happy path | AccountsService | isActive set to false |
| disable — active children | AccountsService | Throws ConflictException |
| disable — not found | AccountsService | Throws NotFoundException |
| delete — happy path | AccountsService | Record deleted from DB |
| delete — system account | AccountsService | Throws ForbiddenException |
| delete — has children | AccountsService | Throws ConflictException |
| delete — not found | AccountsService | Throws NotFoundException |
| Code validation | AccountEntity | Valid/invalid codes correctly identified |
