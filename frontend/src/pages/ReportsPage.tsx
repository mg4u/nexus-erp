import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';
import { reportsApi } from '@/api/services';

const PIE_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4'];
const currentYear = new Date().getFullYear();
const YEARS = [currentYear, currentYear - 1, currentYear - 2];
const tooltipStyle = { backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '10px', color: '#f1f5f9' };

const fmt = (v: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);

export function ReportsPage() {
    const [year, setYear] = useState(currentYear);

    const { data: monthly = [], isLoading: loadingMonthly } = useQuery({
        queryKey: ['reports', 'monthly-sales', year],
        queryFn: () => reportsApi.getMonthlySales(year),
    });

    const { data: topProducts = [], isLoading: loadingTop } = useQuery({
        queryKey: ['reports', 'top-products'],
        queryFn: () => reportsApi.getTopProducts(10),
    });

    const { data: catRevenue = [], isLoading: loadingCat } = useQuery({
        queryKey: ['reports', 'revenue-by-category'],
        queryFn: reportsApi.getRevenueByCategory,
    });

    const totalRevenue = monthly.reduce((s: number, m: any) => s + m.revenue, 0);
    const bestMonth = monthly.reduce((best: any, m: any) => (m.revenue > (best?.revenue ?? 0) ? m : best), null);

    return (
        <div>
            <div className="page-header flex items-start justify-between">
                <div>
                    <h1 className="page-title">Reports & Analytics</h1>
                    <p className="page-subtitle">Business performance insights (cached 1 hour)</p>
                </div>
                <div className="flex gap-1">
                    {YEARS.map(y => (
                        <button key={y} onClick={() => setYear(y)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${year === y ? 'bg-primary-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200'}`}>
                            {y}
                        </button>
                    ))}
                </div>
            </div>

            {/* KPI tiles */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                <div className="card-glow">
                    <p className="text-slate-400 text-sm">Total Revenue {year}</p>
                    <p className="text-3xl font-bold text-emerald-400 mt-1">{fmt(totalRevenue)}</p>
                </div>
                <div className="card-glow">
                    <p className="text-slate-400 text-sm">Best Month</p>
                    <p className="text-3xl font-bold text-primary-400 mt-1">{bestMonth?.monthName ?? '—'}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{bestMonth ? fmt(bestMonth.revenue) : ''}</p>
                </div>
                <div className="card-glow col-span-2 lg:col-span-1">
                    <p className="text-slate-400 text-sm">Product Categories</p>
                    <p className="text-3xl font-bold text-violet-400 mt-1">{catRevenue.length}</p>
                    <p className="text-xs text-slate-500 mt-0.5">Active revenue streams</p>
                </div>
            </div>

            {/* Monthly revenue area chart */}
            <div className="card mb-6">
                <h2 className="text-lg font-semibold text-slate-200 mb-6">Monthly Revenue — {year}</h2>
                {loadingMonthly ? (
                    <div className="h-64 bg-slate-800/50 rounded animate-pulse" />
                ) : (
                    <ResponsiveContainer width="100%" height={260}>
                        <AreaChart data={monthly} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                            <defs>
                                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35} />
                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                            <XAxis dataKey="monthName" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false}
                                tickFormatter={(v: string) => v.substring(0, 3)} />
                            <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false}
                                tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} />
                            <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [fmt(v), 'Revenue']} />
                            <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2.5}
                                fill="url(#areaGrad)" dot={{ r: 4, fill: '#3b82f6', strokeWidth: 0 }}
                                activeDot={{ r: 6, fill: '#3b82f6' }} />
                        </AreaChart>
                    </ResponsiveContainer>
                )}
            </div>

            {/* Bottom row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top products bar chart */}
                <div className="card">
                    <h2 className="text-lg font-semibold text-slate-200 mb-6">Top 10 Products by Revenue</h2>
                    {loadingTop ? (
                        <div className="h-64 bg-slate-800/50 rounded animate-pulse" />
                    ) : (
                        <ResponsiveContainer width="100%" height={260}>
                            <BarChart data={topProducts.map((p: any) => ({ name: p.product?.name?.substring(0, 16), revenue: p.totalRevenue }))}
                                layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                                <XAxis type="number" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false}
                                    tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} />
                                <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} width={110} />
                                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [fmt(v), 'Revenue']} />
                                <Bar dataKey="revenue" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>

                {/* Revenue by category donut */}
                <div className="card">
                    <h2 className="text-lg font-semibold text-slate-200 mb-6">Revenue by Category</h2>
                    {loadingCat ? (
                        <div className="h-64 bg-slate-800/50 rounded animate-pulse" />
                    ) : (
                        <>
                            <ResponsiveContainer width="100%" height={200}>
                                <PieChart>
                                    <Pie data={catRevenue} cx="50%" cy="50%" innerRadius={60} outerRadius={90}
                                        dataKey="revenue" nameKey="category" paddingAngle={3}
                                        label={({ name, percent }: { name: string; percent: number }) => `${(percent * 100).toFixed(0)}%`}
                                        labelLine={false}>
                                        {catRevenue.map((_: unknown, index: number) => (
                                            <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [fmt(v), 'Revenue']} />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="grid grid-cols-2 gap-2 mt-3">
                                {catRevenue.map((c: any, i: number) => (
                                    <div key={c.category} className="flex items-center gap-2 text-xs">
                                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                                        <span className="text-slate-400 truncate">{c.category}</span>
                                        <span className="text-slate-300 font-medium ml-auto">{fmt(c.revenue)}</span>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
