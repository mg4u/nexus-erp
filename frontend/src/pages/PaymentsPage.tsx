import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, CreditCard } from 'lucide-react';
import { paymentsApi, invoicesApi } from '@/api/services';
import toast from 'react-hot-toast';

const PAYMENT_METHODS = ['BANK_TRANSFER', 'CREDIT_CARD', 'CASH', 'PAYPAL', 'STRIPE'];

const methodBadge = (method: string) => {
    const colors: Record<string, string> = {
        BANK_TRANSFER: 'badge-info',
        CREDIT_CARD: 'badge-warning',
        CASH: 'badge-success',
        PAYPAL: 'badge-default',
        STRIPE: 'badge-info',
    };
    return <span className={`badge ${colors[method] ?? 'badge-default'}`}>{method.replace('_', ' ')}</span>;
};

export function PaymentsPage() {
    const qc = useQueryClient();
    const [page, setPage] = useState(1);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ invoiceId: '', amount: '', method: 'BANK_TRANSFER', reference: '', notes: '' });

    const { data, isLoading } = useQuery({
        queryKey: ['payments', { page }],
        queryFn: () => paymentsApi.getAll({ page, limit: 20 }),
    });

    const { data: sentInvoices } = useQuery({
        queryKey: ['invoices-sent'],
        queryFn: () => invoicesApi.getAll({ status: 'SENT', limit: 50 }),
        enabled: showForm,
    });

    const createMutation = useMutation({
        mutationFn: (d: unknown) => paymentsApi.create(d),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['payments'] });
            qc.invalidateQueries({ queryKey: ['invoices'] });
            setShowForm(false);
            setForm({ invoiceId: '', amount: '', method: 'BANK_TRANSFER', reference: '', notes: '' });
            toast.success('Payment recorded! Invoice status updated automatically.');
        },
    });

    return (
        <div>
            <div className="page-header flex items-start justify-between">
                <div>
                    <h1 className="page-title">Payments</h1>
                    <p className="page-subtitle">{data?.total ?? 0} payment records</p>
                </div>
                <button className="btn-primary" onClick={() => setShowForm(true)}>
                    <Plus size={18} /> Record Payment
                </button>
            </div>

            <div className="table-container">
                <table className="table">
                    <thead><tr>
                        <th>Invoice</th><th>Amount</th><th>Method</th><th>Reference</th><th>Date</th>
                    </tr></thead>
                    <tbody>
                        {isLoading ? [...Array(5)].map((_, i) => (
                            <tr key={i}><td colSpan={5}><div className="h-4 bg-slate-800 rounded animate-pulse" /></td></tr>
                        )) : data?.items.map((p: any) => (
                            <tr key={p.id}>
                                <td>
                                    <code className="text-xs text-primary-400 bg-primary-500/10 px-1.5 py-0.5 rounded">
                                        {p.invoice?.invoiceNumber}
                                    </code>
                                </td>
                                <td className="font-bold text-emerald-400 text-base">${Number(p.amount).toFixed(2)}</td>
                                <td>{methodBadge(p.method)}</td>
                                <td className="text-slate-400 text-xs">{p.reference ?? '—'}</td>
                                <td className="text-slate-500 text-xs">{new Date(p.paidAt).toLocaleDateString()}</td>
                            </tr>
                        ))}
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

            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="card w-full max-w-md">
                        <div className="flex items-center gap-3 mb-5">
                            <div className="w-10 h-10 rounded-xl bg-emerald-600/20 flex items-center justify-center">
                                <CreditCard size={20} className="text-emerald-400" />
                            </div>
                            <h2 className="text-lg font-semibold text-slate-200">Record Payment</h2>
                        </div>
                        <form onSubmit={e => { e.preventDefault(); createMutation.mutate({ ...form, amount: Number(form.amount) }); }} className="space-y-3">
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Invoice</label>
                                <select value={form.invoiceId} onChange={e => setForm(f => ({ ...f, invoiceId: e.target.value }))} className="input" required>
                                    <option value="">Select invoice...</option>
                                    {sentInvoices?.items.map((inv: any) => (
                                        <option key={inv.id} value={inv.id}>
                                            {inv.invoiceNumber} — ${Number(inv.total).toFixed(2)} ({inv.order?.customer?.firstName} {inv.order?.customer?.lastName})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">Amount ($)</label>
                                    <input type="number" step="0.01" min="0.01" value={form.amount}
                                        onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className="input" required />
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">Method</label>
                                    <select value={form.method} onChange={e => setForm(f => ({ ...f, method: e.target.value }))} className="input">
                                        {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
                                    </select>
                                </div>
                            </div>
                            <input value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} placeholder="Reference # (optional)" className="input" />
                            <div className="p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/20 text-xs text-emerald-300">
                                ✓ Invoice will be auto-marked as PAID when fully settled.
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" className="btn-secondary flex-1 justify-center" onClick={() => setShowForm(false)}>Cancel</button>
                                <button type="submit" className="btn-primary flex-1 justify-center" disabled={createMutation.isPending}>
                                    {createMutation.isPending ? 'Recording...' : 'Record Payment'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
