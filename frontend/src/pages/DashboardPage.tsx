import { useQuery } from '@tanstack/react-query';
import {
    AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { TrendingUp, Users, Package, ShoppingCart, FileText, DollarSign, AlertTriangle } from 'lucide-react';
import { reportsApi } from '@/api/services';
import { useAuthStore } from '@/store/auth.store';

const PIE_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4'];

function StatCard({ title, value, sub, icon: Icon, iconBg }: {
    title: string; value: string | number; sub?: string; icon: React.ElementType; iconBg: string;
}) {
    return (
        <div className="stat-card">
            <div className={`stat-icon ${iconBg}`}>
                <Icon size={22} className="text-white" />
            </div>
            <div>
                <p className="text-slate-400 text-sm">{title}</p>
                <p className="text-2xl font-bold text-slate-100 mt-0.5">{value}</p>
                {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
            </div>
        </div>
    );
}

const customTooltipStyle = {
    backgroundColor: '#1e293b',
    border: '1px solid #334155',
    borderRadius: '10px',
    color: '#f1f5f9',
};

export function DashboardPage() {
    const user = useAuthStore((s) => s.user);
    const { data: summary, isLoading: loadingSummary } = useQuery({
        queryKey: ['reports', 'dashboard'],
        queryFn: reportsApi.getDashboard,
        staleTime: 60_000,
    });

    const { data: monthlySales = [] } = useQuery({
        queryKey: ['reports', 'monthly-sales'],
        queryFn: () => reportsApi.getMonthlySales(new Date().getFullYear()),
        staleTime: 60_000,
    });

    const { data: topProducts = [] } = useQuery({
        queryKey: ['reports', 'top-products'],
        queryFn: () => reportsApi.getTopProducts(6),
        staleTime: 60_000,
    });

    const { data: catRevenue = [] } = useQuery({
        queryKey: ['reports', 'revenue-by-category'],
        queryFn: reportsApi.getRevenueByCategory,
        staleTime: 60_000,
    });

    const formatMoney = (v: number) =>
        new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);

    return (
        <div>
            <div className="page-header flex items-start justify-between">
                <div>
                    <h1 className="page-title">
                        Good morning, <span className="text-gradient">{user?.firstName}</span> 👋
                    </h1>
                    <p className="page-subtitle">Here's what's happening with your business today.</p>
                </div>
            </div>

            {/* Stats */}
            {loadingSummary ? (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8 animate-pulse">
                    {[...Array(6)].map((_, i) => (
                        <div key={i} className="card h-24 bg-slate-800/50" />
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
                    <StatCard title="Total Revenue" value={formatMoney(summary?.revenue?.total ?? 0)} sub="All time" icon={DollarSign} iconBg="bg-emerald-600" />
                    <StatCard title="This Month" value={formatMoney(summary?.revenue?.thisMonth ?? 0)} sub="Revenue" icon={TrendingUp} iconBg="bg-primary-600" />
                    <StatCard title="Customers" value={summary?.customers?.total ?? 0} sub="Active" icon={Users} iconBg="bg-violet-600" />
                    <StatCard title="Products" value={summary?.products?.total ?? 0} sub={`${summary?.products?.lowStock ?? 0} low stock`} icon={Package} iconBg="bg-amber-600" />
                    <StatCard title="Orders" value={summary?.orders?.total ?? 0} sub={`${summary?.orders?.thisMonth ?? 0} this month`} icon={ShoppingCart} iconBg="bg-blue-600" />
                    <StatCard title="Pending Invoices" value={summary?.invoices?.pending ?? 0} sub="Awaiting payment" icon={FileText} iconBg="bg-red-600" />
                </div>
            )}

            {/* Charts Row 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                {/* Area chart — monthly revenue */}
                <div className="card lg:col-span-2">
                    <h2 className="text-lg font-semibold text-slate-200 mb-6">Monthly Revenue {new Date().getFullYear()}</h2>
                    <ResponsiveContainer width="100%" height={220}>
                        <AreaChart data={monthlySales} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                            <defs>
                                <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                            <XAxis dataKey="monthName" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false}
                                tickFormatter={(v) => v.substring(0, 3)} />
                            <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false}
                                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                            <Tooltip contentStyle={customTooltipStyle}
                                formatter={(v: number) => [formatMoney(v), 'Revenue']} />
                            <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2}
                                fill="url(#revenueGrad)" dot={false} activeDot={{ r: 5, fill: '#3b82f6' }} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                {/* Pie chart — revenue by category */}
                <div className="card">
                    <h2 className="text-lg font-semibold text-slate-200 mb-6">Revenue by Category</h2>
                    <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                            <Pie data={catRevenue} cx="50%" cy="50%" innerRadius={55} outerRadius={85}
                                dataKey="revenue" nameKey="category" paddingAngle={3}>
                                {catRevenue.map((_: unknown, index: number) => (
                                    <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip contentStyle={customTooltipStyle}
                                formatter={(v: number) => [formatMoney(v), 'Revenue']} />
                            <Legend iconType="circle" iconSize={8}
                                formatter={(v) => <span className="text-slate-400 text-xs">{v}</span>} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Charts Row 2 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Bar chart — top products */}
                <div className="card">
                    <h2 className="text-lg font-semibold text-slate-200 mb-6">Top Products by Revenue</h2>
                    <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={topProducts.map((p: { product: { name: string }; totalRevenue: number }) => ({
                            name: p.product?.name?.substring(0, 15),
                            revenue: p.totalRevenue,
                        }))} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                            <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} />
                            <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false}
                                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                            <Tooltip contentStyle={customTooltipStyle}
                                formatter={(v: number) => [formatMoney(v), 'Revenue']} />
                            <Bar dataKey="revenue" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Low stock & alerts */}
                <div className="card">
                    <h2 className="text-lg font-semibold text-slate-200 mb-4">Quick Insights</h2>
                    <div className="space-y-3">
                        <div className="flex items-center gap-3 p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
                            <AlertTriangle size={18} className="text-amber-400 flex-shrink-0" />
                            <div>
                                <p className="text-sm font-medium text-amber-300">{summary?.products?.lowStock ?? 0} Products Low on Stock</p>
                                <p className="text-xs text-slate-500">Review and reorder items soon</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 p-3 bg-red-500/10 rounded-lg border border-red-500/20">
                            <FileText size={18} className="text-red-400 flex-shrink-0" />
                            <div>
                                <p className="text-sm font-medium text-red-300">{summary?.invoices?.pending ?? 0} Invoices Awaiting Payment</p>
                                <p className="text-xs text-slate-500">Follow up on outstanding invoices</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                            <TrendingUp size={18} className="text-emerald-400 flex-shrink-0" />
                            <div>
                                <p className="text-sm font-medium text-emerald-300">{summary?.invoices?.paid ?? 0} Invoices Paid</p>
                                <p className="text-xs text-slate-500">Total revenue collected to date</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
