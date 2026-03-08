import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Plus, Search, ChevronRight, ChevronDown, GitBranch,
    Pencil, Trash2, EyeOff, Zap, RefreshCw, ToggleLeft, ToggleRight
} from 'lucide-react';
import {
    accountsApi, Account, AccountTreeNode, AccountType,
    CreateAccountPayload, UpdateAccountPayload
} from '@/api/services';
import toast from 'react-hot-toast';
import { Can } from '@/components/common/Can';

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCOUNT_TYPES: AccountType[] = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'];

const TYPE_COLORS: Record<AccountType, string> = {
    ASSET: 'bg-blue-500/15 text-blue-400 border border-blue-500/25',
    LIABILITY: 'bg-red-500/15 text-red-400 border border-red-500/25',
    EQUITY: 'bg-purple-500/15 text-purple-400 border border-purple-500/25',
    REVENUE: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25',
    EXPENSE: 'bg-amber-500/15 text-amber-400 border border-amber-500/25',
};

const EMPTY_FORM = { code: '', name: '', type: 'ASSET' as AccountType, parentId: '' };

// ─── Tree node component ──────────────────────────────────────────────────────

interface TreeNodeProps {
    node: AccountTreeNode;
    depth: number;
    onEdit: (a: Account) => void;
    onDisable: (a: Account) => void;
    onDelete: (a: Account) => void;
    onTogglePostable: (a: Account) => void;
}

function TreeNode({ node, depth, onEdit, onDisable, onDelete, onTogglePostable }: TreeNodeProps) {
    const [expanded, setExpanded] = useState(depth < 2);
    const hasChildren = node.children.length > 0;

    return (
        <div>
            <div
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg group transition-colors hover:bg-slate-800/50 ${!node.isActive ? 'opacity-40' : ''}`}
                style={{ paddingLeft: `${12 + depth * 20}px` }}
            >
                {/* Expand/collapse toggle */}
                <button
                    onClick={() => setExpanded((e) => !e)}
                    className={`w-5 h-5 flex items-center justify-center flex-shrink-0 transition-colors ${hasChildren ? 'text-slate-400 hover:text-slate-200' : 'text-slate-700 cursor-default'}`}
                    disabled={!hasChildren}
                >
                    {hasChildren
                        ? (expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />)
                        : <span className="w-3.5 h-px bg-slate-700 block" />}
                </button>

                {/* Code */}
                <code className="text-primary-400 text-xs bg-primary-500/10 px-1.5 py-0.5 rounded font-mono w-16 text-center flex-shrink-0">
                    {node.code}
                </code>

                {/* Name + postable badge */}
                <span className={`flex-1 text-sm font-medium ${depth === 0 ? 'text-slate-100' : 'text-slate-300'} flex items-center gap-2`}>
                    {node.name}
                    {node.isSystem && (
                        <span className="text-[10px] text-slate-500 font-normal">system</span>
                    )}
                    {/* isPostable badge — always visible so state is obvious */}
                    {!hasChildren && (
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${node.isPostable
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                            : 'bg-slate-700/50 text-slate-500 border border-slate-700'
                            }`}>
                            {node.isPostable ? 'Postable' : 'Not Postable'}
                        </span>
                    )}
                </span>

                {/* Type badge */}
                <span className={`hidden sm:inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full ${TYPE_COLORS[node.type]}`}>
                    {node.type}
                </span>

                {/* Level badge */}
                <span className="hidden md:inline text-[10px] text-slate-600 font-mono">L{node.level}</span>

                {/* Actions */}
                <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Can module="chart_of_accounts" action="update">
                        <button
                            onClick={() => onEdit(node)}
                            className="text-slate-500 hover:text-primary-400 transition-colors p-1 rounded"
                            title="Edit account"
                        >
                            <Pencil size={13} />
                        </button>
                    </Can>
                    {/* Toggle postable (leaf accounts only) */}
                    {!hasChildren && (
                        <Can module="chart_of_accounts" action="update">
                            <button
                                onClick={() => onTogglePostable(node)}
                                className={`transition-colors p-1 rounded ${node.isPostable
                                    ? 'text-emerald-500 hover:text-slate-400'
                                    : 'text-slate-500 hover:text-emerald-400'
                                    }`}
                                title={node.isPostable ? 'Disable posting on this account' : 'Enable posting on this account'}
                            >
                                {node.isPostable ? <ToggleRight size={15} /> : <ToggleLeft size={15} />}
                            </button>
                        </Can>
                    )}
                    {!node.isSystem && node.isActive && (
                        <Can module="chart_of_accounts" action="update">
                            <button
                                onClick={() => onDisable(node)}
                                className="text-slate-500 hover:text-amber-400 transition-colors p-1 rounded"
                                title="Disable account"
                            >
                                <EyeOff size={13} />
                            </button>
                        </Can>
                    )}
                    {!node.isSystem && (
                        <Can module="chart_of_accounts" action="delete">
                            <button
                                onClick={() => onDelete(node)}
                                className="text-slate-500 hover:text-red-400 transition-colors p-1 rounded"
                                title="Delete account"
                            >
                                <Trash2 size={13} />
                            </button>
                        </Can>
                    )}
                </div>
            </div>

            {/* Recursive children */}
            {expanded && hasChildren && (
                <div>
                    {node.children.map((child) => (
                        <TreeNode
                            key={child.id}
                            node={child}
                            depth={depth + 1}
                            onEdit={onEdit}
                            onDisable={onDisable}
                            onDelete={onDelete}
                            onTogglePostable={onTogglePostable}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Type summary card ────────────────────────────────────────────────────────

function TypeSummaryCard({ type, count, label }: { type: AccountType; count: number; label: string }) {
    return (
        <div className="card p-4 flex items-center gap-3">
            <div className={`w-2 h-10 rounded-full ${TYPE_COLORS[type].split(' ')[0].replace('bg-', 'bg-').replace('/15', '')}`} />
            <div>
                <p className="text-sm font-semibold text-slate-200">{label}</p>
                <p className="text-xs text-slate-500">{count} accounts</p>
            </div>
        </div>
    );
}

// ─── Search highlight helper ──────────────────────────────────────────────────

function filterTree(nodes: AccountTreeNode[], query: string): AccountTreeNode[] {
    if (!query) return nodes;
    const q = query.toLowerCase();
    function matches(n: AccountTreeNode): boolean {
        return n.code.toLowerCase().includes(q) || n.name.toLowerCase().includes(q);
    }
    function filter(nodes: AccountTreeNode[]): AccountTreeNode[] {
        return nodes.reduce<AccountTreeNode[]>((acc, node) => {
            const filteredChildren = filter(node.children);
            if (matches(node) || filteredChildren.length > 0) {
                acc.push({ ...node, children: filteredChildren });
            }
            return acc;
        }, []);
    }
    return filter(nodes);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function ChartOfAccountsPage() {
    const qc = useQueryClient();
    const [search, setSearch] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState<Account | null>(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [confirmDelete, setConfirmDelete] = useState<Account | null>(null);
    const [viewMode, setViewMode] = useState<'tree' | 'flat'>('tree');

    // ── Queries ───────────────────────────────────────────────────────────────

    const { data: tree, isLoading: treeLoading } = useQuery({
        queryKey: ['accounts', 'tree'],
        queryFn: () => accountsApi.getTree(),
        enabled: viewMode === 'tree',
    });

    const { data: flatData, isLoading: flatLoading } = useQuery({
        queryKey: ['accounts', 'flat', { search }],
        queryFn: () => accountsApi.getAll({ search: search || undefined, limit: 100, activeOnly: false }),
        enabled: viewMode === 'flat',
    });

    const { data: allAccounts } = useQuery({
        queryKey: ['accounts', 'all-for-selector'],
        queryFn: () => accountsApi.getAll({ limit: 500, activeOnly: false }),
        staleTime: 30_000,
    });

    // ── Mutations ─────────────────────────────────────────────────────────────

    const saveMutation = useMutation({
        mutationFn: (payload: CreateAccountPayload | (UpdateAccountPayload & { id: string })) => {
            if (editing) {
                const { id, ...data } = payload as UpdateAccountPayload & { id: string };
                return accountsApi.update(id, data);
            }
            return accountsApi.create(payload as CreateAccountPayload);
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['accounts'] });
            toast.success(editing ? 'Account updated!' : 'Account created!');
            closeForm();
        },
    });

    const disableMutation = useMutation({
        mutationFn: (id: string) => accountsApi.disable(id),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['accounts'] });
            toast.success('Account disabled');
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => accountsApi.delete(id),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['accounts'] });
            setConfirmDelete(null);
            toast.success('Account deleted');
        },
    });

    const seedMutation = useMutation({
        mutationFn: () => accountsApi.seedDefaultCoA(),
        onSuccess: (result) => {
            qc.invalidateQueries({ queryKey: ['accounts'] });
            toast.success(`Default CoA seeded: ${result.seeded} accounts created, ${result.skipped} already existed`);
        },
    });

    const togglePostableMutation = useMutation({
        mutationFn: (id: string) => accountsApi.togglePostable(id),
        onSuccess: (result) => {
            qc.invalidateQueries({ queryKey: ['accounts'] });
            toast.success(result.isPostable ? 'Account marked as Postable ✓' : 'Account marked as Not Postable');
        },
        onError: (err: any) => {
            toast.error(err?.response?.data?.message ?? 'Failed to toggle postable');
        },
    });

    // ── Helpers ───────────────────────────────────────────────────────────────

    const openCreate = (parentAccount?: Account) => {
        setEditing(null);
        setForm({
            ...EMPTY_FORM,
            type: parentAccount?.type ?? 'ASSET',
            parentId: parentAccount?.id ?? '',
        });
        setShowForm(true);
    };

    const openEdit = (account: Account) => {
        setEditing(account);
        setForm({
            code: account.code,
            name: account.name,
            type: account.type,
            parentId: account.parentId ?? '',
        });
        setShowForm(true);
    };

    const closeForm = () => {
        setShowForm(false);
        setEditing(null);
        setForm(EMPTY_FORM);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const payload = {
            code: form.code,
            name: form.name,
            type: form.type,
            parentId: form.parentId || undefined,
            ...(editing ? { id: editing.id } : {}),
        };
        saveMutation.mutate(payload as any);
    };

    // ── Type summary counts ───────────────────────────────────────────────────

    const typeCounts = (allAccounts?.items ?? []).reduce<Record<string, number>>((acc, a) => {
        acc[a.type] = (acc[a.type] ?? 0) + 1;
        return acc;
    }, {});

    const totalAccounts = allAccounts?.total ?? 0;

    // ── Filtered tree ─────────────────────────────────────────────────────────

    const displayedTree = filterTree(tree ?? [], search);

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h1 className="page-title">Chart of Accounts</h1>
                    <p className="page-subtitle">{totalAccounts} accounts · hierarchical accounting tree</p>
                </div>
                <div className="flex items-center gap-2">
                    <Can module="chart_of_accounts" action="create">
                        <>
                            <button
                                onClick={() => seedMutation.mutate()}
                                disabled={seedMutation.isPending}
                                className="btn-secondary gap-2"
                                title="Seed default accounts for this tenant"
                            >
                                <Zap size={15} />
                                {seedMutation.isPending ? 'Seeding...' : 'Seed Defaults'}
                            </button>
                            <button className="btn-primary" onClick={() => openCreate()}>
                                <Plus size={18} /> New Account
                            </button>
                        </>
                    </Can>
                </div>
            </div>

            {/* Type summary strip */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {ACCOUNT_TYPES.map((t) => (
                    <TypeSummaryCard
                        key={t}
                        type={t}
                        count={typeCounts[t] ?? 0}
                        label={t.charAt(0) + t.slice(1).toLowerCase() + 's'}
                    />
                ))}
            </div>

            {/* Controls bar */}
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                {/* Search */}
                <div className="relative flex-1 max-w-sm">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search code or name..."
                        className="input pl-9"
                    />
                </div>

                {/* View toggle */}
                <div className="flex rounded-lg overflow-hidden border border-slate-700">
                    <button
                        onClick={() => setViewMode('tree')}
                        className={`px-3 py-1.5 text-sm flex items-center gap-1.5 transition-colors ${viewMode === 'tree' ? 'bg-primary-600 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}
                    >
                        <GitBranch size={14} /> Tree
                    </button>
                    <button
                        onClick={() => setViewMode('flat')}
                        className={`px-3 py-1.5 text-sm flex items-center gap-1.5 transition-colors ${viewMode === 'flat' ? 'bg-primary-600 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}
                    >
                        <RefreshCw size={14} /> Flat
                    </button>
                </div>
            </div>

            {/* ── TREE VIEW ─────────────────────────────────────────────────── */}
            {viewMode === 'tree' && (
                <div className="card p-2">
                    {treeLoading ? (
                        <div className="space-y-2 p-3">
                            {[...Array(8)].map((_, i) => (
                                <div key={i} className="h-8 bg-slate-800 rounded-lg animate-pulse" style={{ width: `${70 + (i % 3) * 10}%` }} />
                            ))}
                        </div>
                    ) : displayedTree.length === 0 ? (
                        <div className="text-center py-16 text-slate-500">
                            <GitBranch size={40} className="mx-auto mb-3 opacity-30" />
                            <p className="font-medium">{search ? 'No accounts match your search' : 'No accounts yet'}</p>
                            <p className="text-sm mt-1">
                                {!search && (
                                    <button onClick={() => seedMutation.mutate()} className="text-primary-400 hover:text-primary-300 underline">
                                        Seed default accounts
                                    </button>
                                )}
                            </p>
                        </div>
                    ) : (
                        <div className="py-1">
                            {displayedTree.map((node) => (
                                <TreeNode
                                    key={node.id}
                                    node={node}
                                    depth={0}
                                    onEdit={openEdit}
                                    onDisable={(a) => disableMutation.mutate(a.id)}
                                    onDelete={setConfirmDelete}
                                    onTogglePostable={(a) => togglePostableMutation.mutate(a.id)}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ── FLAT VIEW ─────────────────────────────────────────────────── */}
            {viewMode === 'flat' && (
                <div className="table-container">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Code</th>
                                <th>Name</th>
                                <th>Type</th>
                                <th>Level</th>
                                <th>Postable</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {flatLoading ? (
                                [...Array(6)].map((_, i) => (
                                    <tr key={i}>
                                        <td colSpan={6}><div className="h-4 bg-slate-800 rounded animate-pulse" /></td>
                                    </tr>
                                ))
                            ) : flatData?.items.map((a) => (
                                <tr key={a.id} className={!a.isActive ? 'opacity-40' : ''}>
                                    <td>
                                        <code className="text-primary-400 text-xs bg-primary-500/10 px-1.5 py-0.5 rounded font-mono">
                                            {a.code}
                                        </code>
                                    </td>
                                    <td className="font-medium text-slate-200">
                                        {a.name}
                                        {a.isSystem && <span className="ml-1.5 text-[10px] text-slate-500">sys</span>}
                                    </td>
                                    <td>
                                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${TYPE_COLORS[a.type]}`}>
                                            {a.type}
                                        </span>
                                    </td>
                                    <td className="text-slate-400 text-sm font-mono">L{a.level}</td>
                                    {/* Postable toggle */}
                                    <td>
                                        <Can module="chart_of_accounts" action="update">
                                            <button
                                                onClick={() => togglePostableMutation.mutate(a.id)}
                                                className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${a.isPostable
                                                    ? 'text-emerald-400 hover:text-slate-400'
                                                    : 'text-slate-500 hover:text-emerald-400'
                                                    }`}
                                                title={a.isPostable ? 'Click to disable posting' : 'Click to enable posting'}
                                            >
                                                {a.isPostable
                                                    ? <><ToggleRight size={16} /> Postable</>
                                                    : <><ToggleLeft size={16} /> Not Postable</>}
                                            </button>
                                        </Can>
                                    </td>
                                    <td>
                                        <span className={`badge-${a.isActive ? 'success' : 'default'}`}>
                                            {a.isActive ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td>
                                        <div className="flex gap-2">
                                            <Can module="chart_of_accounts" action="update">
                                                <button onClick={() => openEdit(a)} className="text-slate-400 hover:text-primary-400 transition-colors"><Pencil size={14} /></button>
                                            </Can>
                                            {!a.isSystem && a.isActive && (
                                                <Can module="chart_of_accounts" action="update">
                                                    <button onClick={() => disableMutation.mutate(a.id)} className="text-slate-400 hover:text-amber-400 transition-colors"><EyeOff size={14} /></button>
                                                </Can>
                                            )}
                                            {!a.isSystem && (
                                                <Can module="chart_of_accounts" action="delete">
                                                    <button onClick={() => setConfirmDelete(a)} className="text-slate-400 hover:text-red-400 transition-colors"><Trash2 size={14} /></button>
                                                </Can>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* ── CREATE / EDIT MODAL ───────────────────────────────────────── */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="card w-full max-w-md">
                        <h2 className="text-lg font-semibold text-slate-200 mb-5">
                            {editing ? 'Edit Account' : 'New Account'}
                        </h2>
                        <form onSubmit={handleSubmit} className="space-y-3">
                            {/* Code */}
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Account Code *</label>
                                <input
                                    value={form.code}
                                    onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                                    placeholder="e.g. 1110"
                                    className="input font-mono"
                                    required
                                    pattern="[A-Za-z0-9][A-Za-z0-9.\-]*"
                                    title="Alphanumeric, dots and dashes allowed"
                                />
                            </div>

                            {/* Name */}
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Account Name *</label>
                                <input
                                    value={form.name}
                                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                                    placeholder="e.g. Cash and Cash Equivalents"
                                    className="input"
                                    required
                                />
                            </div>

                            {/* Type */}
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Account Type *</label>
                                <select
                                    value={form.type}
                                    onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as AccountType }))}
                                    className="input"
                                    required
                                >
                                    {ACCOUNT_TYPES.map((t) => (
                                        <option key={t} value={t}>{t}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Parent */}
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Parent Account (optional)</label>
                                <select
                                    value={form.parentId}
                                    onChange={(e) => setForm((f) => ({ ...f, parentId: e.target.value }))}
                                    className="input"
                                >
                                    <option value="">— No parent (root account) —</option>
                                    {(allAccounts?.items ?? [])
                                        .filter((a) => a.isActive && a.id !== editing?.id)
                                        .sort((a, b) => a.code.localeCompare(b.code))
                                        .map((a) => (
                                            <option key={a.id} value={a.id}>
                                                {a.code} — {a.name}
                                            </option>
                                        ))}
                                </select>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button type="button" className="btn-secondary flex-1 justify-center" onClick={closeForm}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn-primary flex-1 justify-center" disabled={saveMutation.isPending}>
                                    {saveMutation.isPending ? 'Saving...' : (editing ? 'Update' : 'Create')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── DELETE CONFIRM MODAL ──────────────────────────────────────── */}
            {confirmDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="card w-full max-w-sm">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-red-500/15 flex items-center justify-center flex-shrink-0">
                                <Trash2 size={18} className="text-red-400" />
                            </div>
                            <div>
                                <h2 className="text-base font-semibold text-slate-200">Delete Account</h2>
                                <p className="text-sm text-slate-400">This action cannot be undone</p>
                            </div>
                        </div>
                        <p className="text-sm text-slate-300 mb-5">
                            Are you sure you want to delete{' '}
                            <code className="text-primary-400 bg-primary-500/10 px-1 rounded">{confirmDelete.code}</code>{' '}
                            — <strong>{confirmDelete.name}</strong>?
                        </p>
                        <div className="flex gap-3">
                            <button className="btn-secondary flex-1 justify-center" onClick={() => setConfirmDelete(null)}>
                                Cancel
                            </button>
                            <button
                                className="flex-1 justify-center px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                                disabled={deleteMutation.isPending}
                                onClick={() => deleteMutation.mutate(confirmDelete.id)}
                            >
                                {deleteMutation.isPending ? 'Deleting...' : 'Delete Account'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
