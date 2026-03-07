import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { reportsApi, ProfitLossResult, ProfitLossLine, ProfitLossEntriesResult, ProfitLossEntryRow } from '@/api/services';
import { TrendingUp, TrendingDown, DollarSign, Calendar, List, ChevronLeft, ChevronRight } from 'lucide-react';

const tooltipStyle = { backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '10px', color: '#f1f5f9' };

const fmt = (v: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(v);

function getDefaultDateRange() {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const to = now.toISOString().slice(0, 10);
    return { from, to };
}

const PRESETS = [
    { label: 'This Month', getRange: () => getDefaultDateRange() },
    {
        label: 'Last Month', getRange: () => {
            const now = new Date();
            const from = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
            const to = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);
            return { from, to };
        }
    },
    {
        label: 'This Quarter', getRange: () => {
            const now = new Date();
            const q = Math.floor(now.getMonth() / 3);
            const from = new Date(now.getFullYear(), q * 3, 1).toISOString().slice(0, 10);
            const to = now.toISOString().slice(0, 10);
            return { from, to };
        }
    },
    {
        label: 'This Year', getRange: () => {
            const now = new Date();
            const from = new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);
            const to = now.toISOString().slice(0, 10);
            return { from, to };
        }
    },
];

const ENTRIES_PER_PAGE = 20;

export function ProfitLossPage() {
    const defaults = getDefaultDateRange();
    const [dateFrom, setDateFrom] = useState(defaults.from);
    const [dateTo, setDateTo] = useState(defaults.to);
    const [activePreset, setActivePreset] = useState(0);

    // Drill-down state
    const [showLedger, setShowLedger] = useState(false);
    const [ledgerPage, setLedgerPage] = useState(1);

    const { data, isLoading, error } = useQuery<ProfitLossResult>({
        queryKey: ['reports', 'profit-loss', dateFrom, dateTo],
        queryFn: () => reportsApi.getProfitLoss(dateFrom, dateTo),
    });

    const { data: entriesData, isLoading: entriesLoading } = useQuery<ProfitLossEntriesResult>({
        queryKey: ['reports', 'profit-loss-entries', dateFrom, dateTo, ledgerPage],
        queryFn: () => reportsApi.getProfitLossEntries(dateFrom, dateTo, ledgerPage, ENTRIES_PER_PAGE),
        enabled: showLedger,
    });

    const totalRevenue = Number(data?.totalRevenue ?? 0);
    const totalExpenses = Number(data?.totalExpenses ?? 0);
    const netProfit = Number(data?.netProfit ?? 0);
    const isProfit = data?.isProfit ?? true;

    const chartData = [
        { name: 'Revenue', value: totalRevenue, fill: '#10b981' },
        { name: 'Expenses', value: totalExpenses, fill: '#ef4444' },
        { name: isProfit ? 'Net Profit' : 'Net Loss', value: Math.abs(netProfit), fill: isProfit ? '#3b82f6' : '#f59e0b' },
    ];

    function applyPreset(index: number) {
        setActivePreset(index);
        const range = PRESETS[index].getRange();
        setDateFrom(range.from);
        setDateTo(range.to);
        setLedgerPage(1);
    }

    function toggleLedger() {
        setShowLedger((v) => !v);
        setLedgerPage(1);
    }

    const queryClient = useQueryClient();
    const cacheMutation = useMutation({
        mutationFn: () => reportsApi.invalidateCache(),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['reports'] });
        },
    });

    function refreshCache() {
        cacheMutation.mutate();
    }

    return (
        <div>
            <div className="page-header flex items-start justify-between flex-wrap gap-4">
                <div>
                    <h1 className="page-title">Profit & Loss Report
                        <button
                            key={'refresh-cache'}
                            onClick={() => refreshCache()}
                            className={`px-3 py-1.5 mx-2 rounded-lg text-sm font-medium transition-colors bg-slate-800 text-slate-400 hover:text-slate-200`}
                        >
                            Refresh Cache
                        </button>
                    </h1>
                    <p className="page-subtitle">Financial performance from the accounting ledger {cacheMutation.isPending ? '...' : '(cached 1 hour)'}</p>
                </div>

                {/* Presets */}
                <div className="flex gap-1">
                    {PRESETS.map((p, i) => (
                        <button
                            key={p.label}
                            onClick={() => applyPreset(i)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${activePreset === i
                                ? 'bg-primary-600 text-white'
                                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                                }`}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Date range inputs */}
            <div className="flex items-center gap-3 mb-6">
                <Calendar size={16} className="text-slate-400" />
                <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => { setDateFrom(e.target.value); setActivePreset(-1); setLedgerPage(1); }}
                    className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <span className="text-slate-500 text-sm">to</span>
                <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => { setDateTo(e.target.value); setActivePreset(-1); setLedgerPage(1); }}
                    className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
            </div>

            {/* Error state */}
            {error && (
                <div className="card mb-6 border-red-500/30 text-red-400">
                    <p>Failed to load report. Please try again.</p>
                </div>
            )}

            {/* KPI tiles */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div className="card-glow">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                            <TrendingUp size={16} className="text-emerald-400" />
                        </div>
                        <p className="text-slate-400 text-sm">Total Revenue (<small> <i>Total Credits - Total Debits</i></small>)</p>
                    </div>
                    {isLoading ? (
                        <div className="h-9 bg-slate-800/50 rounded animate-pulse w-32" />
                    ) : (
                        <p className="text-3xl font-bold text-emerald-400">{fmt(totalRevenue)}</p>
                    )}
                </div>

                <div className="card-glow">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-lg bg-red-500/15 flex items-center justify-center">
                            <TrendingDown size={16} className="text-red-400" />
                        </div>
                        <p className="text-slate-400 text-sm">Total Expenses <small><i>(Total Debits - Total Credits)</i></small> </p>
                    </div>
                    {isLoading ? (
                        <div className="h-9 bg-slate-800/50 rounded animate-pulse w-32" />
                    ) : (
                        <p className="text-3xl font-bold text-red-400">{fmt(totalExpenses)}</p>
                    )}
                </div>

                <div className="card-glow">
                    <div className="flex items-center gap-2 mb-2">
                        <div className={`w-8 h-8 rounded-lg ${isProfit ? 'bg-blue-500/15' : 'bg-amber-500/15'} flex items-center justify-center`}>
                            <DollarSign size={16} className={isProfit ? 'text-blue-400' : 'text-amber-400'} />
                        </div>
                        <p className="text-slate-400 text-sm">{isProfit ? 'Net Profit' : 'Net Loss'}</p>
                    </div>
                    {isLoading ? (
                        <div className="h-9 bg-slate-800/50 rounded animate-pulse w-32" />
                    ) : (
                        <p className={`text-3xl font-bold ${isProfit ? 'text-blue-400' : 'text-amber-400'}`}>
                            {isProfit ? '' : '-'}{fmt(Math.abs(netProfit))}
                        </p>
                    )}
                </div>
            </div>

            {/* Bar chart */}
            <div className="card mb-6">
                <h2 className="text-lg font-semibold text-slate-200 mb-6">Revenue vs Expenses</h2>
                {isLoading ? (
                    <div className="h-64 bg-slate-800/50 rounded animate-pulse" />
                ) : (
                    <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                            <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} tickLine={false} axisLine={false} />
                            <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false}
                                tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} />
                            <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [fmt(v), 'Amount']} />
                            <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={80}>
                                {chartData.map((entry, idx) => (
                                    <Cell key={idx} fill={entry.fill} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                )}
            </div>

            {/* Account breakdown tables */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Revenue accounts */}
                <div className="card">
                    <h2 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
                        <TrendingUp size={18} className="text-emerald-400" />
                        Revenue Accounts
                    </h2>
                    {isLoading ? (
                        <div className="space-y-3">
                            {[1, 2, 3].map(i => <div key={i} className="h-10 bg-slate-800/50 rounded animate-pulse" />)}
                        </div>
                    ) : data?.revenueLines.length === 0 ? (
                        <p className="text-slate-500 text-sm py-4">No revenue entries in this period.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-slate-800">
                                        <th className="text-left py-2 px-3 text-slate-400 font-medium">Code</th>
                                        <th className="text-left py-2 px-3 text-slate-400 font-medium">Account</th>
                                        <th className="text-right py-2 px-3 text-slate-400 font-medium">Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data?.revenueLines.map((line: ProfitLossLine) => (
                                        <tr key={line.accountId} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                                            <td className="py-2.5 px-3 font-mono text-slate-300">{line.accountCode}</td>
                                            <td className="py-2.5 px-3 text-slate-200">{line.accountName}</td>
                                            <td className="py-2.5 px-3 text-right text-emerald-400 font-medium">{fmt(Number(line.amount))}</td>
                                        </tr>
                                    ))}
                                    <tr className="border-t-2 border-slate-700">
                                        <td colSpan={2} className="py-2.5 px-3 text-slate-200 font-semibold">Total Revenue</td>
                                        <td className="py-2.5 px-3 text-right text-emerald-400 font-bold">{fmt(totalRevenue)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Expense accounts */}
                <div className="card">
                    <h2 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
                        <TrendingDown size={18} className="text-red-400" />
                        Expense Accounts
                    </h2>
                    {isLoading ? (
                        <div className="space-y-3">
                            {[1, 2, 3].map(i => <div key={i} className="h-10 bg-slate-800/50 rounded animate-pulse" />)}
                        </div>
                    ) : data?.expenseLines.length === 0 ? (
                        <p className="text-slate-500 text-sm py-4">No expense entries in this period.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-slate-800">
                                        <th className="text-left py-2 px-3 text-slate-400 font-medium">Code</th>
                                        <th className="text-left py-2 px-3 text-slate-400 font-medium">Account</th>
                                        <th className="text-right py-2 px-3 text-slate-400 font-medium">Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data?.expenseLines.map((line: ProfitLossLine) => (
                                        <tr key={line.accountId} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                                            <td className="py-2.5 px-3 font-mono text-slate-300">{line.accountCode}</td>
                                            <td className="py-2.5 px-3 text-slate-200">{line.accountName}</td>
                                            <td className="py-2.5 px-3 text-right text-red-400 font-medium">{fmt(Number(line.amount))}</td>
                                        </tr>
                                    ))}
                                    <tr className="border-t-2 border-slate-700">
                                        <td colSpan={2} className="py-2.5 px-3 text-slate-200 font-semibold">Total Expenses</td>
                                        <td className="py-2.5 px-3 text-right text-red-400 font-bold">{fmt(totalExpenses)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Net result summary + drill-down button */}
            <div className={`card mt-6 border ${isProfit ? 'border-blue-500/30' : 'border-amber-500/30'}`}>
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-slate-400 text-sm">Net Result</p>
                        <p className="text-sm text-slate-500 mt-0.5">
                            Net Profit = Total Revenue − Total Expenses
                        </p>
                    </div>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={toggleLedger}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${showLedger
                                ? 'bg-primary-600 text-white'
                                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-slate-100'
                                }`}
                        >
                            <List size={16} />
                            {showLedger ? 'Hide Detailed Ledger' : 'View Detailed Ledger'}
                        </button>
                        <div className="text-right">
                            {isLoading ? (
                                <div className="h-9 bg-slate-800/50 rounded animate-pulse w-32" />
                            ) : (
                                <>
                                    <p className={`text-2xl font-bold ${isProfit ? 'text-blue-400' : 'text-amber-400'}`}>
                                        {isProfit ? '' : '-'}{fmt(Math.abs(netProfit))}
                                    </p>
                                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${isProfit
                                        ? 'bg-blue-500/15 text-blue-400'
                                        : 'bg-amber-500/15 text-amber-400'
                                        }`}>
                                        {isProfit ? 'PROFIT' : 'LOSS'}
                                    </span>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Detailed Ledger Drill-Down ────────────────────────────────── */}
            {showLedger && (
                <div className="card mt-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
                            <List size={18} className="text-primary-400" />
                            Detailed Ledger Entries
                        </h2>
                        {entriesData && (
                            <span className="text-xs text-slate-500">
                                {entriesData.total} entries total
                            </span>
                        )}
                    </div>

                    {entriesLoading ? (
                        <div className="space-y-3">
                            {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-10 bg-slate-800/50 rounded animate-pulse" />)}
                        </div>
                    ) : !entriesData || entriesData.rows.length === 0 ? (
                        <p className="text-slate-500 text-sm py-6 text-center">No journal entry lines found for this period.</p>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-slate-800">
                                            <th className="text-left py-2 px-3 text-slate-400 font-medium">Date</th>
                                            <th className="text-left py-2 px-3 text-slate-400 font-medium">Journal</th>
                                            <th className="text-left py-2 px-3 text-slate-400 font-medium">Account Code</th>
                                            <th className="text-left py-2 px-3 text-slate-400 font-medium">Account Name</th>
                                            <th className="text-left py-2 px-3 text-slate-400 font-medium">Description</th>
                                            <th className="text-right py-2 px-3 text-slate-400 font-medium">Debit</th>
                                            <th className="text-right py-2 px-3 text-slate-400 font-medium">Credit</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {entriesData.rows.map((row: ProfitLossEntryRow, idx: number) => (
                                            <tr key={idx} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                                                <td className="py-2.5 px-3 text-slate-300 whitespace-nowrap">{row.date}</td>
                                                <td className="py-2.5 px-3 text-slate-400 font-mono text-xs">{row.journalReference}</td>
                                                <td className="py-2.5 px-3 font-mono text-slate-300">{row.accountCode}</td>
                                                <td className="py-2.5 px-3 text-slate-200">{row.accountName}</td>
                                                <td className="py-2.5 px-3 text-slate-400 max-w-[200px] truncate">{row.description}</td>
                                                <td className="py-2.5 px-3 text-right font-medium text-slate-200">
                                                    {Number(row.debit) > 0 ? fmt(Number(row.debit)) : '—'}
                                                </td>
                                                <td className="py-2.5 px-3 text-right font-medium text-slate-200">
                                                    {Number(row.credit) > 0 ? fmt(Number(row.credit)) : '—'}
                                                </td>
                                            </tr>
                                        ))}
                                        {/* Page totals */}
                                        <tr className="border-t-2 border-slate-700 bg-slate-800/30">
                                            <td colSpan={5} className="py-2.5 px-3 text-slate-300 font-semibold">
                                                Page Totals
                                            </td>
                                            <td className="py-2.5 px-3 text-right font-bold text-slate-200">
                                                {fmt(entriesData.rows.reduce((s: number, r: ProfitLossEntryRow) => s + Number(r.debit), 0))}
                                            </td>
                                            <td className="py-2.5 px-3 text-right font-bold text-slate-200">
                                                {fmt(entriesData.rows.reduce((s: number, r: ProfitLossEntryRow) => s + Number(r.credit), 0))}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination controls */}
                            {entriesData.totalPages > 1 && (
                                <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-800">
                                    <button
                                        onClick={() => setLedgerPage((p) => Math.max(1, p - 1))}
                                        disabled={ledgerPage <= 1}
                                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                    >
                                        <ChevronLeft size={14} />
                                        Previous
                                    </button>
                                    <span className="text-sm text-slate-400">
                                        Page {entriesData.page} of {entriesData.totalPages}
                                    </span>
                                    <button
                                        onClick={() => setLedgerPage((p) => Math.min(entriesData.totalPages, p + 1))}
                                        disabled={ledgerPage >= entriesData.totalPages}
                                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                    >
                                        Next
                                        <ChevronRight size={14} />
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
