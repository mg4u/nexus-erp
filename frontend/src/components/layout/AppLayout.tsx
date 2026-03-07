import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
    LayoutDashboard, Users, Package, UserCheck, ShoppingCart,
    FileText, CreditCard, BarChart3, Bot, LogOut, Building2, Menu, X, BookOpen, Scroll, TrendingUp
} from 'lucide-react';
import { useState } from 'react';
import { useAuthStore } from '@/store/auth.store';
import { authApi } from '@/api/services';
import toast from 'react-hot-toast';

const navLinks = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/users', icon: Users, label: 'Users' },
    { to: '/products', icon: Package, label: 'Products' },
    { to: '/customers', icon: UserCheck, label: 'Customers' },
    { to: '/orders', icon: ShoppingCart, label: 'Orders' },
    { to: '/invoices', icon: FileText, label: 'Invoices' },
    { to: '/payments', icon: CreditCard, label: 'Payments' },
    { to: '/accounts', icon: BookOpen, label: 'Chart of Accounts' },
    { to: '/journal', icon: Scroll, label: 'Journal Entries' },
    { to: '/reports', icon: BarChart3, label: 'Reports' },
    { to: '/profit-loss', icon: TrendingUp, label: 'Profit & Loss' },
    { to: '/ai-assistant', icon: Bot, label: 'AI Assistant' },
];

export function AppLayout() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const { user, tenant, logout } = useAuthStore();
    const navigate = useNavigate();

    const handleLogout = async () => {
        try {
            await authApi.logout();
        } catch { /* ignore */ }
        logout();
        navigate('/login');
        toast.success('Logged out successfully');
    };

    return (
        <div className="flex h-screen overflow-hidden bg-slate-950">
            {/* Mobile overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 z-20 bg-black/60 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside
                className={`fixed lg:static inset-y-0 left-0 z-30 flex flex-col w-64 bg-slate-900 border-r border-slate-800 
          transition-transform duration-300 lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
            >
                {/* Logo */}
                <div className="flex items-center gap-3 px-4 py-5 border-b border-slate-800">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-blue-600 flex items-center justify-center flex-shrink-0">
                        <Building2 size={18} className="text-white" />
                    </div>
                    <div className="min-w-0">
                        <h1 className="font-bold text-sm text-slate-100 truncate">{tenant?.name ?? 'SaaS ERP'}</h1>
                        <p className="text-xs text-slate-500 truncate">{tenant?.plan ?? 'starter'} plan</p>
                    </div>
                </div>

                {/* Nav */}
                <nav className="flex-1 overflow-y-auto p-3 space-y-1">
                    {navLinks.map(({ to, icon: Icon, label }) => (
                        <NavLink
                            key={to}
                            to={to}
                            className={({ isActive }) =>
                                `sidebar-link ${isActive ? 'active' : ''}`
                            }
                            onClick={() => setSidebarOpen(false)}
                        >
                            <Icon size={18} />
                            {label}
                        </NavLink>
                    ))}
                </nav>

                {/* User footer */}
                <div className="p-3 border-t border-slate-800">
                    <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-blue-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                            {user?.firstName?.charAt(0)?.toUpperCase() ?? 'U'}
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-slate-200 truncate">
                                {user?.firstName} {user?.lastName}
                            </p>
                            <p className="text-xs text-slate-500 truncate">{user?.role}</p>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="sidebar-link w-full text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    >
                        <LogOut size={18} />
                        Logout
                    </button>
                </div>
            </aside>

            {/* Main content */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Top bar */}
                <header className="flex items-center gap-4 px-4 lg:px-6 py-4 border-b border-slate-800 bg-slate-900/50 flex-shrink-0">
                    <button
                        className="lg:hidden text-slate-400 hover:text-slate-100"
                        onClick={() => setSidebarOpen(true)}
                    >
                        <Menu size={22} />
                    </button>
                    <div className="flex-1" />
                    <span className="text-xs bg-primary-600/20 text-primary-400 border border-primary-500/20 px-2.5 py-1 rounded-full font-medium">
                        {user?.role}
                    </span>
                </header>

                {/* Page content */}
                <main className="flex-1 overflow-y-auto p-4 lg:p-6">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
