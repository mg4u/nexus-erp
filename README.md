# 🚀 SaaS ERP Platform

A **production-grade, multi-tenant SaaS ERP platform** built with enterprise architecture principles. Scale from a single startup to thousands of tenants.

[![NestJS](https://img.shields.io/badge/NestJS-10-red?logo=nestjs)](https://nestjs.com)
[![React](https://img.shields.io/badge/React-18-blue?logo=react)](https://react.dev)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue?logo=postgresql)](https://postgresql.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://typescriptlang.org)
[![Docker](https://img.shields.io/badge/Docker-ready-blue?logo=docker)](https://docker.com)

---

## ✨ Features

| Module | Description |
|---|---|
| 🏢 **Multi-Tenancy** | Row-level isolation, tenant middleware, per-tenant caching |
| 🔐 **Auth** | JWT access/refresh tokens, bcrypt, RBAC (Admin/Manager/Accountant/Employee) |
| 📦 **Products** | CRUD, stock management, low-stock alerts |
| 👥 **Customers** | CRM with purchase history |
| 🛒 **Orders** | Stock validation, auto-reduction, draft invoice generation |
| 🧾 **Invoices** | Full lifecycle: Draft → Sent → Partially Paid → Paid → Cancelled |
| 💳 **Payments** | DB transactions, overpayment protection, auto-mark paid |
| 📒 **Chart of Accounts** | Hierarchical tree, account types (Asset/Liability/Equity/Revenue/Expense), postable leaf nodes |
| 📔 **Journal Entries** | Automated double-entry bookkeeping, trial balance, reversal support |
| 📊 **Reports** | Redis-cached analytics, revenue, top products, category breakdown |
| 🤖 **AI Assistant** | Natural language business queries (OpenAI GPT-4 or Stub mode) |

---

## 🏗️ Architecture

```
saas-erp/
├── backend/                   # NestJS Clean Architecture
│   ├── src/
│   │   ├── domain/            # Entities, interfaces (AI port)
│   │   ├── application/       # Services, DTOs, use cases
│   │   ├── infrastructure/    # Prisma, Redis, AI providers
│   │   └── presentation/      # Controllers, guards, modules
│   ├── prisma/
│   │   ├── schema.prisma      # Full ERP schema
│   │   └── seed.ts            # 2 tenants, sample data
│   └── Dockerfile
├── frontend/                  # React + Vite
│   ├── src/
│   │   ├── api/               # Axios client + API services
│   │   ├── store/             # Zustand auth store
│   │   ├── pages/             # All ERP pages
│   │   └── components/        # Shared components
│   └── Dockerfile
├── docker-compose.yml
└── .env.example
```

---

## 🚀 Quick Start

### Option A — Docker (Recommended)

```bash
# 1. Clone and configure
git clone git@github.com:mg4u/nexus-erp.git saas-erp
cd saas-erp
cp .env.example .env

# 2. Generate secure JWT secrets
openssl rand -base64 64  # → JWT_ACCESS_SECRET
openssl rand -base64 64  # → JWT_REFRESH_SECRET

# 3. Run database migrations + seed
docker compose --profile migrate up migrate

# 4. Launch all services
docker compose up --build -d

# 5. Visit the app
open http://localhost:80
```

Services started:
| Service | URL |
|---|---|
| Frontend | http://localhost:80 |
| Backend API | http://localhost:3000/api |
| Swagger Docs | http://localhost:3000/api/docs |

---

### Option B — Local Development

#### Prerequisites
- Node.js 20+
- PostgreSQL 16
- Redis 7

#### Backend

```bash
cd backend

# Install dependencies
npm install

# Configure environment
cp ../.env.example .env
# Edit .env with your local DB credentials

# Run Prisma migrations
npx prisma migrate dev --name init

# Seed the database
npm run prisma:seed

# Start in dev mode (with hot reload)
npm run start:dev
```

#### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start Vite dev server
npm run dev
```

Visit: **http://localhost:5173**

---

## 🔑 Demo Credentials

After seeding, use these credentials:

| Tenant | Email | Password | Role |
|---|---|---|---|
| Acme Corp | admin@acme.com | Secret123! | ADMIN |
| Acme Corp | manager@acme.com | Secret123! | MANAGER |
| Acme Corp | accountant@acme.com | Secret123! | ACCOUNTANT |
| Demo Startup | admin@demo.com | Secret123! | ADMIN |

> **X-Tenant-ID header**: Include the tenant UUID in all API requests (after login, it's attached automatically by the frontend interceptor).

---

## 📡 API Reference

All endpoints are versioned under `/api/v1/`. Full interactive docs at `/api/docs` (Swagger UI).

### Authentication
```
POST /api/v1/auth/register   — Create tenant + admin (no header needed)
POST /api/v1/auth/login      — Get access + refresh tokens (no header needed)
POST /api/v1/auth/refresh    — Rotate refresh token
POST /api/v1/auth/logout     — Invalidate refresh token
```

### Core Resources
```
GET|POST         /api/v1/users
GET|PATCH|DELETE /api/v1/users/:id

GET|POST         /api/v1/products
GET|PATCH|DELETE /api/v1/products/:id
POST             /api/v1/products/:id/adjust-stock

GET|POST         /api/v1/customers
GET|PATCH|DELETE /api/v1/customers/:id

GET|POST         /api/v1/orders
PATCH            /api/v1/orders/:id/status

GET              /api/v1/invoices
PATCH            /api/v1/invoices/:id/status
GET              /api/v1/invoices/overdue

GET|POST         /api/v1/payments

GET|POST         /api/v1/chart-of-accounts
GET|PATCH|DELETE /api/v1/chart-of-accounts/:id
PATCH            /api/v1/chart-of-accounts/:id/toggle-postable

GET|POST         /api/v1/journal-entries
GET              /api/v1/journal-entries/:id
POST             /api/v1/journal-entries/:id/reverse
GET              /api/v1/journal-entries/trial-balance
GET              /api/v1/journal-entries/validate
```

### Reports (Redis-cached)
```
GET /api/v1/reports/dashboard
GET /api/v1/reports/monthly-sales?year=2025
GET /api/v1/reports/top-products?limit=10
GET /api/v1/reports/revenue-by-category
```

### AI Assistant
```
POST /api/v1/ai/query
Body: { "query": "What is my revenue this month?" }
```

---

## 🔒 RBAC Permissions

| Endpoint | ADMIN | MANAGER | ACCOUNTANT | EMPLOYEE |
|---|:---:|:---:|:---:|:---:|
| User management | ✅ | 👁️ | ❌ | ❌ |
| Products CRUD | ✅ | ✅ | ❌ | 👁️ |
| Orders | ✅ | ✅ | ✅ | ✅ |
| Invoices | ✅ | ✅ | ✅ | 👁️ |
| Payments | ✅ | ✅ | ✅ | ❌ |
| Reports | ✅ | ✅ | ✅ | ❌ |
| AI Assistant | ✅ | ✅ | ✅ | ✅ |

---

## 🌱 Environment Variables

| Variable | Required | Description |
|---|:---:|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `JWT_ACCESS_SECRET` | ✅ | Min 32 chars — use `openssl rand -base64 64` |
| `JWT_REFRESH_SECRET` | ✅ | Min 32 chars — different from access secret |
| `REDIS_HOST` | — | Default: `localhost` |
| `REDIS_PASSWORD` | — | Redis auth password |
| `OPENAI_API_KEY` | — | Leave empty to use Stub AI provider |
| `BCRYPT_ROUNDS` | — | Default: `12` |
| `CORS_ORIGINS` | — | Comma-separated allowed origins |

---

## 🧪 Running Tests

```bash
# Backend unit tests
cd backend && npm test

# Backend end-to-end tests
cd backend && npm run test:e2e

# Frontend tests
cd frontend && npm test
```

---

## 🤖 AI Assistant

The AI module uses an **abstracted provider pattern**. It auto-selects:

- **OpenAI GPT-4o** — when `OPENAI_API_KEY` is set in `.env`
- **Stub Provider** — keyword-based responses (no API key needed, great for dev/demo)

**Example queries:**
- *"What is my revenue this month?"*
- *"Which products are running low on stock?"*
- *"How many overdue invoices do I have?"*
- *"Who are my top customers?"*

---

## 🏗️ Tech Stack

### Backend
- **NestJS 10** — Enterprise Node.js framework
- **TypeScript 5** — Full type safety
- **Prisma 6** — Type-safe ORM with migrations
- **PostgreSQL 16** — Row-level multi-tenancy
- **Redis 7** — Report caching (1hr TTL)
- **BullMQ** — Background job queues
- **Passport JWT** — Access + refresh token auth
- **bcrypt** — Password hashing (12 rounds)
- **Winston** — Structured logging with daily rotation
- **Swagger** — Auto-generated API docs

### Frontend
- **React 18 + Vite** — Fast HMR development
- **TypeScript 5** — End-to-end type safety
- **TailwindCSS 3** — Utility-first dark UI
- **React Query v5** — Data fetching + caching
- **Zustand v5** — Lightweight global state
- **Recharts** — AreaChart, BarChart, PieChart
- **React Hook Form** — Form validation
- **Axios** — Auto token refresh interceptor

---

## 📝 License

This project is **Source Available** under a custom non-commercial license. See [LICENSE.md](LICENSE.md) for full terms.

- ✅ Free for personal, educational, and non-commercial use
- ✅ Contributions welcome — must be submitted to this repository
- ❌ Commercial use requires a separate license

**For commercial licensing inquiries, contact:** [mahmoud.dev.gamal@gmail.com](mailto:mahmoud.dev.gamal@gmail.com)

© 2025–2026 Mahmoud Hassan. All rights reserved.
