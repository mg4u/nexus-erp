import { apiClient, unwrap } from './client';

export interface PaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

// ─── Auth ────────────────────────────────────────────────────────
export const authApi = {
    register: (data: { companyName: string; companySlug: string; firstName: string; lastName: string; email: string; password: string }) =>
        apiClient.post('/v1/auth/register', data).then((r) => r.data.data),

    login: (data: { email: string; password: string }) =>
        apiClient.post('/v1/auth/login', data).then((r) => r.data.data),

    logout: () => apiClient.post('/v1/auth/logout').then((r) => r.data.data),
};

// ─── Dashboard ───────────────────────────────────────────────────

export interface ProfitLossLine {
    accountId: string;
    accountCode: string;
    accountName: string;
    amount: string;
}

export interface ProfitLossResult {
    dateFrom: string;
    dateTo: string;
    revenueLines: ProfitLossLine[];
    expenseLines: ProfitLossLine[];
    totalRevenue: string;
    totalExpenses: string;
    netProfit: string;
    isProfit: boolean;
    cachedAt?: string;
}

export interface ProfitLossEntryRow {
    date: string;
    journalReference: string;
    accountCode: string;
    accountName: string;
    description: string;
    debit: string;
    credit: string;
}

export interface ProfitLossEntriesResult {
    rows: ProfitLossEntryRow[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export const reportsApi = {
    getDashboard: () => apiClient.get('/v1/reports/dashboard').then((r) => r.data.data),
    getMonthlySales: (year?: number) =>
        apiClient.get(`/v1/reports/monthly-sales${year ? `?year=${year}` : ''}`).then((r) => r.data.data),
    getTopProducts: (limit = 10) =>
        apiClient.get(`/v1/reports/top-products?limit=${limit}`).then((r) => r.data.data),
    getRevenueByCategory: () => apiClient.get('/v1/reports/revenue-by-category').then((r) => r.data.data),
    getProfitLoss: (dateFrom?: string, dateTo?: string) =>
        apiClient.get('/v1/reports/profit-loss', {
            params: { ...(dateFrom && { dateFrom }), ...(dateTo && { dateTo }) },
        }).then((r) => r.data.data as ProfitLossResult),
    getProfitLossEntries: (dateFrom?: string, dateTo?: string, page = 1, limit = 20) =>
        apiClient.get('/v1/reports/profit-loss/entries', {
            params: { ...(dateFrom && { dateFrom }), ...(dateTo && { dateTo }), page, limit },
        }).then((r) => r.data.data as ProfitLossEntriesResult),
    invalidateCache: () =>
        apiClient.post('/v1/reports/cache/invalidate').then((r) => r.data),
};

// ─── Users ───────────────────────────────────────────────────────
export interface User { id: string; email: string; firstName: string; lastName: string; role: string; isActive: boolean; lastLoginAt?: string; createdAt: string; }
export const usersApi = {
    getAll: (params?: Record<string, unknown>) =>
        apiClient.get('/v1/users', { params }).then((r) => r.data.data as PaginatedResponse<User>),
    getOne: (id: string) => apiClient.get(`/v1/users/${id}`).then((r) => r.data.data as User),
    create: (data: unknown) => apiClient.post('/v1/users', data).then((r) => r.data.data),
    update: (id: string, data: unknown) => apiClient.patch(`/v1/users/${id}`, data).then((r) => r.data.data),
    deactivate: (id: string) => apiClient.delete(`/v1/users/${id}`).then((r) => r.data.data),
};

// ─── Products ────────────────────────────────────────────────────
export interface Product { id: string; name: string; sku: string; price: number; stockQuantity: number; category?: string; isActive: boolean; description?: string; }
export const productsApi = {
    getAll: (params?: Record<string, unknown>) =>
        apiClient.get('/v1/products', { params }).then((r) => r.data.data as PaginatedResponse<Product>),
    getOne: (id: string) => apiClient.get(`/v1/products/${id}`).then((r) => r.data.data as Product),
    create: (data: unknown) => apiClient.post('/v1/products', data).then((r) => r.data.data),
    update: (id: string, data: unknown) => apiClient.patch(`/v1/products/${id}`, data).then((r) => r.data.data),
    adjustStock: (id: string, data: { quantity: number; reason?: string }) =>
        apiClient.post(`/v1/products/${id}/adjust-stock`, data).then((r) => r.data.data),
    remove: (id: string) => apiClient.delete(`/v1/products/${id}`).then((r) => r.data.data),
    getLowStock: () => apiClient.get('/v1/products/low-stock').then((r) => r.data.data as Product[]),
};

// ─── Customers ───────────────────────────────────────────────────
export interface Customer { id: string; firstName: string; lastName: string; email: string; phone?: string; city?: string; country?: string; createdAt: string; }
export const customersApi = {
    getAll: (params?: Record<string, unknown>) =>
        apiClient.get('/v1/customers', { params }).then((r) => r.data.data as PaginatedResponse<Customer>),
    getOne: (id: string) => apiClient.get(`/v1/customers/${id}`).then((r) => r.data.data),
    create: (data: unknown) => apiClient.post('/v1/customers', data).then((r) => r.data.data),
    update: (id: string, data: unknown) => apiClient.patch(`/v1/customers/${id}`, data).then((r) => r.data.data),
    remove: (id: string) => apiClient.delete(`/v1/customers/${id}`).then((r) => r.data.data),
};

// ─── Orders ──────────────────────────────────────────────────────
export interface Order { id: string; orderNumber: string; status: string; total: number; customer: Partial<Customer>; createdAt: string; items?: unknown[]; }
export const ordersApi = {
    getAll: (params?: Record<string, unknown>) =>
        apiClient.get('/v1/orders', { params }).then((r) => r.data.data as PaginatedResponse<Order>),
    getOne: (id: string) => apiClient.get(`/v1/orders/${id}`).then((r) => r.data.data),
    create: (data: unknown) => apiClient.post('/v1/orders', data).then((r) => r.data.data),
    updateStatus: (id: string, status: string) =>
        apiClient.patch(`/v1/orders/${id}/status`, { status }).then((r) => r.data.data),
};

// ─── Invoices ────────────────────────────────────────────────────
export interface Invoice { id: string; invoiceNumber: string; status: string; total: number; dueDate: string; order: { customer: Partial<Customer> }; createdAt: string; }
export const invoicesApi = {
    getAll: (params?: Record<string, unknown>) =>
        apiClient.get('/v1/invoices', { params }).then((r) => r.data.data as PaginatedResponse<Invoice>),
    getOne: (id: string) => apiClient.get(`/v1/invoices/${id}`).then((r) => r.data.data),
    updateStatus: (id: string, status: string) =>
        apiClient.patch(`/v1/invoices/${id}/status`, { status }).then((r) => r.data.data),
    getOverdue: () => apiClient.get('/v1/invoices/overdue').then((r) => r.data.data),
};

// ─── Payments ────────────────────────────────────────────────────
export interface Payment { id: string; amount: number; method: string; reference?: string; paidAt: string; invoice: { invoiceNumber: string; total: number }; }
export const paymentsApi = {
    getAll: (params?: Record<string, unknown>) =>
        apiClient.get('/v1/payments', { params }).then((r) => r.data.data as PaginatedResponse<Payment>),
    create: (data: unknown) => apiClient.post('/v1/payments', data).then((r) => r.data.data),
};

// ─── AI ──────────────────────────────────────────────────────────
export const aiApi = {
    query: (query: string) => apiClient.post('/v1/ai/query', { query }).then((r) => r.data.data),
};

// ─── Chart of Accounts ───────────────────────────────────────────

export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';

export interface Account {
    id: string;
    tenantId: string;
    code: string;
    name: string;
    type: AccountType;
    parentId: string | null;
    level: number;
    isSystem: boolean;
    isActive: boolean;
    isPostable: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface AccountTreeNode extends Account {
    children: AccountTreeNode[];
}

export interface CreateAccountPayload {
    code: string;
    name: string;
    type: AccountType;
    parentId?: string;
    isSystem?: boolean;
}

export interface UpdateAccountPayload {
    code?: string;
    name?: string;
    type?: AccountType;
    parentId?: string | null;
}

export const accountsApi = {
    getAll: (params?: Record<string, unknown>) =>
        apiClient.get('/v1/accounts', { params }).then((r) => r.data.data as PaginatedResponse<Account>),

    getOne: (id: string) =>
        apiClient.get(`/v1/accounts/${id}`).then((r) => r.data.data as Account),

    getTree: () =>
        apiClient.get('/v1/accounts/tree').then((r) => r.data.data as AccountTreeNode[]),

    create: (data: CreateAccountPayload) =>
        apiClient.post('/v1/accounts', data).then((r) => r.data.data as Account),

    update: (id: string, data: UpdateAccountPayload) =>
        apiClient.patch(`/v1/accounts/${id}`, data).then((r) => r.data.data as Account),

    disable: (id: string) =>
        apiClient.patch(`/v1/accounts/${id}/disable`).then((r) => r.data.data as Account),

    togglePostable: (id: string) =>
        apiClient.patch(`/v1/accounts/${id}/postable`).then((r) => r.data.data as { id: string; isPostable: boolean }),

    delete: (id: string) =>
        apiClient.delete(`/v1/accounts/${id}`),

    seedDefaultCoA: () =>
        apiClient.post('/v1/accounts/seed').then((r) => r.data.data as { seeded: number; skipped: number }),
};

// ─── Journal Entries ──────────────────────────────────────────────────────────

export type JournalStatus = 'DRAFT' | 'POSTED' | 'REVERSED';

export interface JournalEntryLine {
    id: string;
    accountId: string;
    account: { code: string; name: string; type: string };
    debit: string;
    credit: string;
    description: string | null;
}

export interface JournalEntry {
    id: string;
    tenantId: string;
    referenceType: string | null;
    referenceId: string | null;
    description: string;
    status: JournalStatus;
    postedAt: string | null;
    reversalOf: string | null;
    createdBy: string;
    createdAt: string;
    lines: JournalEntryLine[];
}

export interface TrialBalanceLine {
    accountId: string;
    accountCode: string;
    accountName: string;
    accountType: string;
    totalDebit: string;
    totalCredit: string;
    balance: string;
}

export interface TrialBalanceResult {
    lines: TrialBalanceLine[];
    totalDebit: string;
    totalCredit: string;
    isBalanced: boolean;
    asOfDate: string;
    cachedAt?: string;
}

export interface CreateJournalLinePayload {
    accountId: string;
    debit: number;
    credit: number;
    description?: string;
}

export interface CreateJournalEntryPayload {
    description: string;
    referenceType?: string;
    referenceId?: string;
    lines: CreateJournalLinePayload[];
}

export interface GlobalEqualityResult {
    isBalanced: boolean;
    totalDebit: string;
    totalCredit: string;
    delta: string;
}

export const journalApi = {
    getAll: (params?: Record<string, unknown>) =>
        apiClient.get('/v1/journal-entries', { params }).then((r) => r.data.data as PaginatedResponse<JournalEntry>),

    getOne: (id: string) =>
        apiClient.get(`/v1/journal-entries/${id}`).then((r) => r.data.data as JournalEntry),

    postManual: (data: CreateJournalEntryPayload) =>
        apiClient.post('/v1/journal-entries', data).then((r) => r.data.data as JournalEntry),

    reverse: (id: string) =>
        apiClient.post(`/v1/journal-entries/${id}/reverse`).then((r) => r.data.data as JournalEntry),

    getTrialBalance: (asOfDate?: string) =>
        apiClient.get('/v1/journal-entries/trial-balance', { params: asOfDate ? { asOfDate } : {} }).then((r) => r.data.data as TrialBalanceResult),

    validateEquality: () =>
        apiClient.get('/v1/journal-entries/validate').then((r) => r.data.data as GlobalEqualityResult),
};
