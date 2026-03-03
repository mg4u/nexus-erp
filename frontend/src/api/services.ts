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
export const reportsApi = {
    getDashboard: () => apiClient.get('/v1/reports/dashboard').then((r) => r.data.data),
    getMonthlySales: (year?: number) =>
        apiClient.get(`/v1/reports/monthly-sales${year ? `?year=${year}` : ''}`).then((r) => r.data.data),
    getTopProducts: (limit = 10) =>
        apiClient.get(`/v1/reports/top-products?limit=${limit}`).then((r) => r.data.data),
    getRevenueByCategory: () => apiClient.get('/v1/reports/revenue-by-category').then((r) => r.data.data),
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
