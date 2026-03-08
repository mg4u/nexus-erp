import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth.store';
import { AppLayout } from '@/components/layout/AppLayout';
import { LoginPage } from '@/pages/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { UsersPage } from '@/pages/UsersPage';
import { ProductsPage } from '@/pages/ProductsPage';
import { CustomersPage } from '@/pages/CustomersPage';
import { OrdersPage } from '@/pages/OrdersPage';
import { InvoicesPage } from '@/pages/InvoicesPage';
import { PaymentsPage } from '@/pages/PaymentsPage';
import { ReportsPage } from '@/pages/ReportsPage';
import { AiAssistantPage } from '@/pages/AiAssistantPage';
import { ChartOfAccountsPage } from '@/pages/ChartOfAccountsPage';
import { JournalPage } from '@/pages/JournalPage';
import { ProfitLossPage } from '@/pages/ProfitLossPage';
import { can, RbacModule } from '@/utils/rbac';

function RoleRoute({ module, children }: { module: RbacModule, children: React.ReactNode }) {
    const user = useAuthStore((s) => s.user);
    if (!can(user?.role, module, 'read')) {
        return <Navigate to="/dashboard" replace />;
    }
    return <>{children}</>;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
    return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
    return !isAuthenticated ? <>{children}</> : <Navigate to="/dashboard" replace />;
}

export default function App() {
    return (
        <BrowserRouter>
            <Routes>
                {/* Public routes */}
                <Route
                    path="/login"
                    element={<PublicRoute><LoginPage /></PublicRoute>}
                />
                <Route
                    path="/register"
                    element={<PublicRoute><RegisterPage /></PublicRoute>}
                />

                {/* Protected routes */}
                <Route
                    path="/"
                    element={<ProtectedRoute><AppLayout /></ProtectedRoute>}
                >
                    <Route index element={<Navigate to="/dashboard" replace />} />
                    <Route path="dashboard" element={<DashboardPage />} />
                    <Route path="users" element={<RoleRoute module="users"><UsersPage /></RoleRoute>} />
                    <Route path="products" element={<RoleRoute module="products"><ProductsPage /></RoleRoute>} />
                    <Route path="customers" element={<RoleRoute module="customers"><CustomersPage /></RoleRoute>} />
                    <Route path="orders" element={<RoleRoute module="orders"><OrdersPage /></RoleRoute>} />
                    <Route path="invoices" element={<RoleRoute module="invoices"><InvoicesPage /></RoleRoute>} />
                    <Route path="payments" element={<RoleRoute module="payments"><PaymentsPage /></RoleRoute>} />
                    <Route path="reports" element={<RoleRoute module="reports"><ReportsPage /></RoleRoute>} />
                    <Route path="ai-assistant" element={<AiAssistantPage />} />
                    <Route path="accounts" element={<RoleRoute module="chart_of_accounts"><ChartOfAccountsPage /></RoleRoute>} />
                    <Route path="journal" element={<RoleRoute module="journals"><JournalPage /></RoleRoute>} />
                    <Route path="profit-loss" element={<RoleRoute module="profit_loss_report"><ProfitLossPage /></RoleRoute>} />
                </Route>

                {/* Fallback */}
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
        </BrowserRouter>
    );
}
