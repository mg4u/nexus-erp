import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, Clock, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { invoicesApi, Invoice } from '@/api/services';
import toast from 'react-hot-toast';
import { Can } from '@/components/common/Can';

const STATUS_CONFIG: Record<string, { badge: string; icon: React.ElementType; next: string[] }> = {
    DRAFT: { badge: 'badge-default', icon: FileText, next: ['SENT', 'CANCELLED'] },
    SENT: { badge: 'badge-warning', icon: Clock, next: ['PAID', 'CANCELLED'] },
    PAID: { badge: 'badge-success', icon: CheckCircle, next: [] },
    CANCELLED: { badge: 'badge-danger', icon: XCircle, next: [] },
};

export function InvoicesPage() {
    const qc = useQueryClient();
    const [filterStatus, setFilterStatus] = useState('');
    const [page, setPage] = useState(1);

    const { data, isLoading } = useQuery({
        queryKey: ['invoices', { filterStatus, page }],
        queryFn: () => invoicesApi.getAll({ status: filterStatus || undefined, page, limit: 20 }),
    });

    const { data: overdue } = useQuery({
        queryKey: ['invoices-overdue'],
        queryFn: invoicesApi.getOverdue,
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, status }: { id: string; status: string }) => invoicesApi.updateStatus(id, status),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }); toast.success('Invoice status updated'); },
    });

    const isOverdue = (inv: Invoice) =>
        inv.status === 'SENT' && new Date(inv.dueDate) < new Date();

    return (
        <div>
            <div className="page-header">
                <h1 className="page-title">Invoices</h1>
                <p className="page-subtitle">{data?.total ?? 0} invoices total</p>
            </div>

            {/* Overdue banner */}
            {(overdue?.count ?? 0) > 0 && (
                <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl mb-6">
                    <AlertTriangle size={20} className="text-red-400 flex-shrink-0" />
                    <div>
                        <p className="text-sm font-semibold text-red-300">{overdue.count} Overdue Invoice{overdue.count > 1 ? 's' : ''}</p>
                        <p className="text-xs text-slate-400">Total outstanding: ${Number(overdue.totalAmount).toFixed(2)}</p>
                    </div>
                </div>
            )}

            {/* Status tabs */}
            <div className="flex gap-2 mb-5 flex-wrap">
                {['', 'DRAFT', 'SENT', 'PAID', 'CANCELLED'].map(s => (
                    <button key={s} onClick={() => { setFilterStatus(s); setPage(1); }}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filterStatus === s ? 'bg-primary-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200'}`}>
                        {s || 'All'}
                    </button>
                ))}
            </div>

            <div className="table-container">
                <table className="table">
                    <thead><tr>
                        <th>Invoice #</th><th>Customer</th><th>Status</th><th>Total</th><th>Due Date</th><th>Actions</th>
                    </tr></thead>
                    <tbody>
                        {isLoading ? [...Array(5)].map((_, i) => (
                            <tr key={i}><td colSpan={6}><div className="h-4 bg-slate-800 rounded animate-pulse" /></td></tr>
                        )) : data?.items.map((inv: Invoice) => {
                            const cfg = STATUS_CONFIG[inv.status] ?? STATUS_CONFIG.DRAFT;
                            const Icon = cfg.icon;
                            const overdueBadge = isOverdue(inv);
                            return (
                                <tr key={inv.id}>
                                    <td>
                                        <code className="text-xs text-primary-400 bg-primary-500/10 px-1.5 py-0.5 rounded">
                                            {inv.invoiceNumber}
                                        </code>
                                    </td>
                                    <td className="font-medium text-slate-200">
                                        {(inv.order?.customer as any)?.firstName} {(inv.order?.customer as any)?.lastName}
                                    </td>
                                    <td>
                                        <div className="flex items-center gap-1.5">
                                            <span className={`badge ${cfg.badge} flex items-center gap-1`}>
                                                <Icon size={11} /> {inv.status}
                                            </span>
                                            {overdueBadge && <span className="badge-danger text-xs">OVERDUE</span>}
                                        </div>
                                    </td>
                                    <td className="font-bold text-emerald-400">${Number(inv.total).toFixed(2)}</td>
                                    <td className={`text-xs ${overdueBadge ? 'text-red-400 font-medium' : 'text-slate-500'}`}>
                                        {new Date(inv.dueDate).toLocaleDateString()}
                                    </td>
                                    <td>
                                        <div className="flex gap-1 flex-wrap">
                                            <Can module="invoices" action="update">
                                                <>
                                                    {cfg.next.map(nextStatus => (
                                                        <button key={nextStatus}
                                                            onClick={() => updateMutation.mutate({ id: inv.id, status: nextStatus })}
                                                            className="text-xs px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition-colors">
                                                            → {nextStatus}
                                                        </button>
                                                    ))}
                                                </>
                                            </Can>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {data && data.totalPages > 1 && (
                <div className="flex justify-center gap-2 mt-4">
                    <button className="btn-secondary px-3 py-1.5 text-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Prev</button>
                    <span className="text-slate-400 text-sm self-center">Page {page} of {data.totalPages}</span>
                    <button className="btn-secondary px-3 py-1.5 text-sm" disabled={page === data.totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
                </div>
            )}
        </div>
    );
}
