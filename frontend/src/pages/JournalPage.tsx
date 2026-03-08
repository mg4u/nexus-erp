import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    journalApi,
    accountsApi,
    JournalEntry,
    JournalStatus,
    TrialBalanceLine,
} from '@/api/services';
import { useAuthStore } from '@/store/auth.store';
import toast from 'react-hot-toast';
import {
    BookOpen, Plus, Minus, RefreshCw, CheckCircle, XCircle,
    ChevronDown, ChevronRight, Loader2, ShieldAlert, Scale,
    FileText, TrendingUp, RotateCcw, Filter, AlertTriangle,
    type LucideIcon,
} from 'lucide-react';
import { can } from '@/utils/rbac';
import { Can } from '@/components/common/Can';

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'entries' | 'post' | 'trial-balance';

interface DraftLine {
    accountId: string;
    debit: string;
    credit: string;
    description: string;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const statusColors: Record<JournalStatus, string> = {
    DRAFT: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    POSTED: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    REVERSED: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
};

function StatusBadge({ status }: { status: JournalStatus }) {
    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusColors[status]}`}>
            {status}
        </span>
    );
}

function AccountTypeChip({ type }: { type: string }) {
    const map: Record<string, string> = {
        ASSET: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
        LIABILITY: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
        EQUITY: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
        REVENUE: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
        EXPENSE: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
    };
    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono border ${map[type] ?? 'bg-slate-700 text-slate-300 border-slate-600'}`}>
            {type}
        </span>
    );
}

// ─── Tab: Journal Entries List ────────────────────────────────────────────────

function EntriesTab() {
    const user = useAuthStore((s) => s.user);
    const queryClient = useQueryClient();

    const [page, setPage] = useState(1);
    const [statusFilter, setStatusFilter] = useState<string>('POSTED');
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const { data, isLoading, isFetching } = useQuery({
        queryKey: ['journal-entries', page, statusFilter],
        queryFn: () => journalApi.getAll({ page, limit: 15, status: statusFilter || undefined }),
    });

    const reverseMutation = useMutation({
        mutationFn: (id: string) => journalApi.reverse(id),
        onSuccess: () => {
            toast.success('Entry reversed successfully');
            queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
            queryClient.invalidateQueries({ queryKey: ['trial-balance'] });
        },
        onError: (err: any) => {
            toast.error(err?.response?.data?.message ?? 'Failed to reverse entry');
        },
    });

    const items = data?.items ?? [];

    return (
        <div className="space-y-5">
            {/* Filter bar */}
            <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2 bg-slate-800 rounded-lg px-3 py-2 border border-slate-700">
                    <Filter size={14} className="text-slate-400" />
                    <select
                        value={statusFilter}
                        onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                        className="bg-transparent text-sm text-slate-200 outline-none"
                    >
                        <option value="">All statuses</option>
                        <option value="DRAFT">Draft</option>
                        <option value="POSTED">Posted</option>
                        <option value="REVERSED">Reversed</option>
                    </select>
                </div>
                {isFetching && <Loader2 size={16} className="animate-spin text-slate-400" />}
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 size={32} className="animate-spin text-primary-500" />
                </div>
            ) : items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                    <FileText size={40} className="mb-3 opacity-40" />
                    <p className="text-sm">No journal entries found</p>
                    <p className="text-xs mt-1">Post your first entry using the "Post Entry" tab</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {items.map((entry) => (
                        <div
                            key={entry.id}
                            className="rounded-xl border border-slate-700/60 bg-slate-800/50 overflow-hidden"
                        >
                            {/* Entry header */}
                            <div
                                className="flex items-center gap-4 px-4 py-3 cursor-pointer hover:bg-slate-700/30 transition-colors"
                                onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                            >
                                <div className="flex-shrink-0 text-slate-500">
                                    {expandedId === entry.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-slate-200 truncate">{entry.description}</p>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        {entry.referenceType && (
                                            <span className="mr-2 font-mono uppercase text-slate-600">{entry.referenceType}</span>
                                        )}
                                        {entry.postedAt
                                            ? new Date(entry.postedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                                            : new Date(entry.createdAt).toLocaleDateString()}
                                    </p>
                                </div>
                                <div className="flex items-center gap-3 flex-shrink-0">
                                    <StatusBadge status={entry.status} />
                                    {entry.status === 'POSTED' && (
                                        <Can module="journals" action="update">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (confirm('Reverse this journal entry? A new balancing entry will be created.')) {
                                                        reverseMutation.mutate(entry.id);
                                                    }
                                                }}
                                                disabled={reverseMutation.isPending}
                                                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium
                                                           bg-rose-500/10 text-rose-400 border border-rose-500/30
                                                           hover:bg-rose-500/20 transition-colors disabled:opacity-50"
                                            >
                                                <RotateCcw size={12} />
                                                Reverse
                                            </button>
                                        </Can>
                                    )}
                                </div>
                            </div>

                            {/* Expanded lines */}
                            {expandedId === entry.id && entry.lines.length > 0 && (
                                <div className="border-t border-slate-700/60 px-4 py-3">
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="text-slate-500 text-left">
                                                <th className="pb-2 font-medium">Account</th>
                                                <th className="pb-2 font-medium text-right">Debit</th>
                                                <th className="pb-2 font-medium text-right">Credit</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-700/40">
                                            {entry.lines.map((line) => (
                                                <tr key={line.id} className="text-slate-300">
                                                    <td className="py-1.5">
                                                        <span className="font-mono text-slate-400 mr-2">{line.account?.code}</span>
                                                        <span>{line.account?.name}</span>
                                                        {line.description && (
                                                            <span className="block text-slate-500 text-xs mt-0.5">{line.description}</span>
                                                        )}
                                                    </td>
                                                    <td className={`py-1.5 text-right font-mono ${Number(line.debit) > 0 ? 'text-blue-400' : 'text-slate-600'}`}>
                                                        {Number(line.debit) > 0 ? Number(line.debit).toFixed(2) : '—'}
                                                    </td>
                                                    <td className={`py-1.5 text-right font-mono ${Number(line.credit) > 0 ? 'text-emerald-400' : 'text-slate-600'}`}>
                                                        {Number(line.credit) > 0 ? Number(line.credit).toFixed(2) : '—'}
                                                    </td>
                                                </tr>
                                            ))}
                                            <tr className="text-slate-400 font-semibold border-t border-slate-700">
                                                <td className="pt-2">Total</td>
                                                <td className="pt-2 text-right font-mono text-blue-400">
                                                    {entry.lines.reduce((s, l) => s + Number(l.debit), 0).toFixed(2)}
                                                </td>
                                                <td className="pt-2 text-right font-mono text-emerald-400">
                                                    {entry.lines.reduce((s, l) => s + Number(l.credit), 0).toFixed(2)}
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Pagination */}
            {data && data.totalPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                    <p className="text-xs text-slate-500">{data.total} total entries</p>
                    <div className="flex gap-2">
                        <button
                            disabled={page === 1}
                            onClick={() => setPage((p) => p - 1)}
                            className="px-3 py-1.5 text-xs rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 disabled:opacity-40"
                        >
                            Previous
                        </button>
                        <span className="px-3 py-1.5 text-xs text-slate-400">
                            {page} / {data.totalPages}
                        </span>
                        <button
                            disabled={page >= data.totalPages}
                            onClick={() => setPage((p) => p + 1)}
                            className="px-3 py-1.5 text-xs rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 disabled:opacity-40"
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Tab: Post Entry Form ─────────────────────────────────────────────────────

function PostEntryTab() {
    const queryClient = useQueryClient();
    const [description, setDescription] = useState('');
    const [lines, setLines] = useState<DraftLine[]>([
        { accountId: '', debit: '', credit: '', description: '' },
        { accountId: '', debit: '', credit: '', description: '' },
    ]);

    // Load all postable accounts for the account picker
    const { data: accountsData } = useQuery({
        queryKey: ['accounts', 'postable'],
        queryFn: () => accountsApi.getAll({ activeOnly: true, limit: 500 }),
    });
    const allAccounts = accountsData?.items ?? [];

    const totalDebit = lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
    const totalCredit = lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
    const isBalanced = Math.abs(totalDebit - totalCredit) < 0.0001;
    const hasSufficientLines = lines.length >= 2;
    const hasDescription = description.trim().length > 0;
    const linesValid = lines.every(
        (l) => l.accountId && (parseFloat(l.debit) > 0) !== (parseFloat(l.credit) > 0),
    );
    const canSubmit = isBalanced && hasSufficientLines && hasDescription && linesValid && totalDebit > 0;

    const postMutation = useMutation({
        mutationFn: (payload: Parameters<typeof journalApi.postManual>[0]) => journalApi.postManual(payload),
        onSuccess: () => {
            toast.success('Journal entry posted successfully');
            setDescription('');
            setLines([
                { accountId: '', debit: '', credit: '', description: '' },
                { accountId: '', debit: '', credit: '', description: '' },
            ]);
            queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
            queryClient.invalidateQueries({ queryKey: ['trial-balance'] });
        },
        onError: (err: any) => {
            toast.error(err?.response?.data?.message ?? 'Failed to post journal entry');
        },
    });

    const updateLine = (idx: number, field: keyof DraftLine, value: string) => {
        setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, [field]: value } : l)));
    };

    const addLine = () => setLines((prev) => [...prev, { accountId: '', debit: '', credit: '', description: '' }]);

    const removeLine = (idx: number) => {
        if (lines.length <= 2) return;
        setLines((prev) => prev.filter((_, i) => i !== idx));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        postMutation.mutate({
            description,
            referenceType: 'MANUAL',
            lines: lines.map((l) => ({
                accountId: l.accountId,
                debit: parseFloat(l.debit) || 0,
                credit: parseFloat(l.credit) || 0,
                description: l.description || undefined,
            })),
        });
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
            {/* Description */}
            <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Description *</label>
                <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g. Rent payment for March 2026"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                    required
                />
            </div>

            {/* Lines */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-medium text-slate-300">Journal Lines *</label>
                    <button
                        type="button"
                        onClick={addLine}
                        className="flex items-center gap-1.5 text-xs text-primary-400 hover:text-primary-300"
                    >
                        <Plus size={14} /> Add Line
                    </button>
                </div>

                {/* Column headers */}
                <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 mb-2 px-1">
                    {['Account', 'Debit', 'Credit', ''].map((h, i) => (
                        <p key={i} className="text-xs text-slate-500 font-medium">{h}</p>
                    ))}
                </div>

                <div className="space-y-2">
                    {lines.map((line, idx) => {
                        const hasDebit = parseFloat(line.debit) > 0;
                        const hasCredit = parseFloat(line.credit) > 0;
                        const lineInvalid = line.accountId && hasDebit && hasCredit;
                        return (
                            <div key={idx} className={`grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center p-3 rounded-xl border ${lineInvalid ? 'border-rose-500/50 bg-rose-500/5' : 'border-slate-700/60 bg-slate-800/40'}`}>
                                {/* Account */}
                                <select
                                    value={line.accountId}
                                    onChange={(e) => updateLine(idx, 'accountId', e.target.value)}
                                    className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-primary-500"
                                    required
                                >
                                    <option value="">Select account…</option>
                                    {allAccounts.map((a) => (
                                        <option key={a.id} value={a.id}>
                                            {a.code} — {a.name}
                                        </option>
                                    ))}
                                </select>
                                {/* Debit */}
                                <input
                                    type="number"
                                    step="0.0001"
                                    min="0"
                                    value={line.debit}
                                    onChange={(e) => {
                                        updateLine(idx, 'debit', e.target.value);
                                        if (parseFloat(e.target.value) > 0) updateLine(idx, 'credit', '');
                                    }}
                                    placeholder="0.00"
                                    className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-blue-400 font-mono text-right focus:outline-none focus:border-blue-500"
                                />
                                {/* Credit */}
                                <input
                                    type="number"
                                    step="0.0001"
                                    min="0"
                                    value={line.credit}
                                    onChange={(e) => {
                                        updateLine(idx, 'credit', e.target.value);
                                        if (parseFloat(e.target.value) > 0) updateLine(idx, 'debit', '');
                                    }}
                                    placeholder="0.00"
                                    className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-emerald-400 font-mono text-right focus:outline-none focus:border-emerald-500"
                                />
                                {/* Remove */}
                                <button
                                    type="button"
                                    onClick={() => removeLine(idx)}
                                    disabled={lines.length <= 2}
                                    className="p-1.5 text-slate-600 hover:text-rose-400 transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
                                >
                                    <Minus size={14} />
                                </button>
                            </div>
                        );
                    })}
                </div>

                {/* Balance indicator */}
                <div className={`mt-4 flex items-center gap-3 px-4 py-3 rounded-xl border ${isBalanced && totalDebit > 0 ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-amber-500/30 bg-amber-500/5'}`}>
                    <Scale size={16} className={isBalanced && totalDebit > 0 ? 'text-emerald-400' : 'text-amber-400'} />
                    <div className="flex-1 grid grid-cols-3 gap-4 text-xs">
                        <div>
                            <p className="text-slate-500">Total Debit</p>
                            <p className="font-mono text-blue-400 font-semibold">{totalDebit.toFixed(4)}</p>
                        </div>
                        <div>
                            <p className="text-slate-500">Total Credit</p>
                            <p className="font-mono text-emerald-400 font-semibold">{totalCredit.toFixed(4)}</p>
                        </div>
                        <div>
                            <p className="text-slate-500">Δ</p>
                            <p className={`font-mono font-semibold ${isBalanced ? 'text-emerald-400' : 'text-amber-400'}`}>
                                {Math.abs(totalDebit - totalCredit).toFixed(4)}
                            </p>
                        </div>
                    </div>
                    <div className={`text-xs font-medium ${isBalanced && totalDebit > 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {isBalanced && totalDebit > 0 ? '✓ Balanced' : 'Unbalanced'}
                    </div>
                </div>
            </div>

            <button
                type="submit"
                disabled={!canSubmit || postMutation.isPending}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary-600 text-white text-sm font-medium
                           hover:bg-primary-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {postMutation.isPending ? (
                    <><Loader2 size={16} className="animate-spin" /> Posting…</>
                ) : (
                    <><CheckCircle size={16} /> Post Entry</>
                )}
            </button>
        </form>
    );
}

// ─── Tab: Trial Balance ───────────────────────────────────────────────────────

const ACCOUNT_TYPE_ORDER = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'];

function TrialBalanceTab() {
    const [asOfDate, setAsOfDate] = useState('');
    const queryClient = useQueryClient();

    const { data, isLoading, isFetching, refetch } = useQuery({
        queryKey: ['trial-balance', asOfDate],
        queryFn: () => journalApi.getTrialBalance(asOfDate || undefined),
    });

    const { data: validationData, isLoading: validating, refetch: revalidate } = useQuery({
        queryKey: ['journal-validate'],
        queryFn: () => journalApi.validateEquality(),
    });

    // Group lines by account type
    const grouped = useMemo(() => {
        if (!data?.lines) return {};
        return data.lines.reduce<Record<string, TrialBalanceLine[]>>((acc, l) => {
            if (!acc[l.accountType]) acc[l.accountType] = [];
            acc[l.accountType].push(l);
            return acc;
        }, {});
    }, [data?.lines]);

    return (
        <div className="space-y-5">
            {/* Controls */}
            <div className="flex items-center gap-4 flex-wrap">
                <div>
                    <label className="block text-xs text-slate-500 mb-1">As of Date</label>
                    <input
                        type="date"
                        value={asOfDate}
                        onChange={(e) => setAsOfDate(e.target.value)}
                        className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-primary-500"
                    />
                </div>
                <button
                    onClick={() => refetch()}
                    disabled={isFetching}
                    className="mt-5 flex items-center gap-2 px-4 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-300 hover:bg-slate-700 transition-colors disabled:opacity-50"
                >
                    <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
                    Refresh
                </button>

                {/* System invariant badge */}
                <div className="mt-5 flex items-center gap-2 ml-auto">
                    {validating ? (
                        <Loader2 size={14} className="animate-spin text-slate-400" />
                    ) : validationData ? (
                        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium ${validationData.isBalanced
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                            : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                            }`}>
                            {validationData.isBalanced
                                ? <><CheckCircle size={13} /> System Invariant OK</>
                                : <><ShieldAlert size={13} /> SYSTEM CORRUPTED — Δ {validationData.delta}</>
                            }
                        </div>
                    ) : null}
                    <button
                        onClick={() => revalidate()}
                        className="text-xs text-slate-500 hover:text-slate-300 underline"
                    >Validate</button>
                </div>
            </div>

            {/* Cache notice */}
            {data?.cachedAt && !asOfDate && (
                <p className="text-xs text-slate-500 flex items-center gap-1.5">
                    <RefreshCw size={10} />
                    Cached at {new Date(data.cachedAt).toLocaleTimeString()}. TTL: 5 min.
                </p>
            )}

            {isLoading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 size={32} className="animate-spin text-primary-500" />
                </div>
            ) : !data || data.lines.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                    <TrendingUp size={40} className="mb-3 opacity-40" />
                    <p className="text-sm">No posted journal entries yet</p>
                </div>
            ) : (
                <>
                    {/* Global totals banner */}
                    <div className={`flex items-center gap-6 px-5 py-3 rounded-xl border ${data.isBalanced ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-rose-500/30 bg-rose-500/5'}`}>
                        <div className="flex items-center gap-2">
                            {data.isBalanced
                                ? <CheckCircle size={18} className="text-emerald-400" />
                                : <AlertTriangle size={18} className="text-rose-400" />
                            }
                            <span className="text-sm font-semibold text-slate-200">
                                {data.isBalanced ? 'Trial Balance' : 'Imbalanced!'}
                            </span>
                        </div>
                        <div className="flex-1" />
                        <div className="text-xs text-right">
                            <p className="text-slate-500">Total Debit</p>
                            <p className="font-mono text-blue-400 font-bold text-sm">{Number(data.totalDebit).toFixed(2)}</p>
                        </div>
                        <div className="text-xs text-right">
                            <p className="text-slate-500">Total Credit</p>
                            <p className="font-mono text-emerald-400 font-bold text-sm">{Number(data.totalCredit).toFixed(2)}</p>
                        </div>
                    </div>

                    {/* Grouped table */}
                    {ACCOUNT_TYPE_ORDER.filter((t) => grouped[t]?.length > 0).map((type) => (
                        <div key={type} className="rounded-xl border border-slate-700/60 overflow-hidden">
                            <div className="flex items-center gap-3 px-4 py-2.5 bg-slate-800/80 border-b border-slate-700/60">
                                <AccountTypeChip type={type} />
                                <span className="text-xs text-slate-400 font-medium">{grouped[type].length} accounts</span>
                            </div>
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="border-b border-slate-700/40">
                                        <th className="text-left px-4 py-2 text-slate-500 font-medium">Account</th>
                                        <th className="text-right px-4 py-2 text-slate-500 font-medium">Debit</th>
                                        <th className="text-right px-4 py-2 text-slate-500 font-medium">Credit</th>
                                        <th className="text-right px-4 py-2 text-slate-500 font-medium">Balance</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700/30">
                                    {grouped[type].map((line) => (
                                        <tr key={line.accountId} className="hover:bg-slate-800/40 transition-colors">
                                            <td className="px-4 py-2.5">
                                                <span className="font-mono text-slate-500 mr-2">{line.accountCode}</span>
                                                <span className="text-slate-300">{line.accountName}</span>
                                            </td>
                                            <td className="px-4 py-2.5 text-right font-mono text-blue-400">
                                                {Number(line.totalDebit) > 0 ? Number(line.totalDebit).toFixed(2) : '—'}
                                            </td>
                                            <td className="px-4 py-2.5 text-right font-mono text-emerald-400">
                                                {Number(line.totalCredit) > 0 ? Number(line.totalCredit).toFixed(2) : '—'}
                                            </td>
                                            <td className={`px-4 py-2.5 text-right font-mono font-semibold ${Number(line.balance) >= 0 ? 'text-slate-200' : 'text-rose-400'}`}>
                                                {Number(line.balance).toFixed(2)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ))}
                </>
            )}
        </div>
    );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

const tabConfig: { id: Tab; label: string; icon: LucideIcon }[] = [
    { id: 'entries', label: 'Journal Entries', icon: FileText },
    { id: 'post', label: 'Post Entry', icon: Plus },
    { id: 'trial-balance', label: 'Trial Balance', icon: TrendingUp },
];

export function JournalPage() {
    const [activeTab, setActiveTab] = useState<Tab>('entries');
    const user = useAuthStore((s) => s.user);

    const hasPostPermission = can(user?.role, 'journals', 'create');
    const visibleTabs = hasPostPermission ? tabConfig : tabConfig.filter((t) => t.id !== 'post');

    return (
        <div className="flex flex-col gap-6">
            {/* Page header */}
            <div className="flex items-start justify-between">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
                            <BookOpen size={18} className="text-white" />
                        </div>
                        <h1 className="text-xl font-bold text-slate-100">Journal Entries</h1>
                    </div>
                    <p className="text-sm text-slate-500 ml-12">Double-entry accounting engine — immutable POSTED ledger</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 p-1 bg-slate-800/60 rounded-xl w-fit border border-slate-700/50">
                {visibleTabs.map(({ id, label, icon: Icon }) => (
                    <button
                        key={id}
                        onClick={() => setActiveTab(id)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === id
                            ? 'bg-slate-700 text-slate-100 shadow-sm'
                            : 'text-slate-400 hover:text-slate-200'
                            }`}
                    >
                        <Icon size={15} />
                        {label}
                    </button>
                ))}
            </div>

            {/* Tab content */}
            <div>
                {activeTab === 'entries' && <EntriesTab />}
                {activeTab === 'post' && hasPostPermission && <PostEntryTab />}
                {activeTab === 'trial-balance' && <TrialBalanceTab />}
            </div>
        </div>
    );
}
