import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, ChevronRight } from 'lucide-react';
import { ordersApi, customersApi, productsApi, Order } from '@/api/services';
import toast from 'react-hot-toast';
import { Can } from '@/components/common/Can';

const STATUS_COLORS: Record<string, string> = {
    PENDING: 'badge-warning',
    CONFIRMED: 'badge-info',
    SHIPPED: 'badge-default',
    DELIVERED: 'badge-success',
    CANCELLED: 'badge-danger',
};

const STATUS_TRANSITIONS: Record<string, string[]> = {
    PENDING: ['CONFIRMED', 'CANCELLED'],
    CONFIRMED: ['SHIPPED', 'CANCELLED'],
    SHIPPED: ['DELIVERED'],
    DELIVERED: [],
    CANCELLED: [],
};

export function OrdersPage() {
    const qc = useQueryClient();
    const [filterStatus, setFilterStatus] = useState('');
    const [page, setPage] = useState(1);
    const [showCreate, setShowCreate] = useState(false);
    const [orderItems, setOrderItems] = useState([{ productId: '', quantity: 1 }]);
    const [customerId, setCustomerId] = useState('');
    const [notes, setNotes] = useState('');
    const [taxPercent, setTaxPercent] = useState(0);

    const { data, isLoading } = useQuery({
        queryKey: ['orders', { filterStatus, page }],
        queryFn: () => ordersApi.getAll({ status: filterStatus || undefined, page, limit: 20 }),
    });

    const { data: customers } = useQuery({
        queryKey: ['customers-list'],
        queryFn: () => customersApi.getAll({ limit: 100 }),
        enabled: showCreate,
    });

    const { data: products } = useQuery({
        queryKey: ['products-list'],
        queryFn: () => productsApi.getAll({ limit: 100 }),
        enabled: showCreate,
    });

    const createMutation = useMutation({
        mutationFn: (d: unknown) => ordersApi.create(d),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['orders'] });
            qc.invalidateQueries({ queryKey: ['products'] });
            setShowCreate(false);
            setOrderItems([{ productId: '', quantity: 1 }]);
            setCustomerId('');
            toast.success('Order created! Stock reduced & draft invoice generated.');
        },
    });

    const updateStatusMutation = useMutation({
        mutationFn: ({ id, status }: { id: string; status: string }) => ordersApi.updateStatus(id, status),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['orders'] }); toast.success('Order status updated'); },
    });

    const addItem = () => setOrderItems(prev => [...prev, { productId: '', quantity: 1 }]);
    const removeItem = (i: number) => setOrderItems(prev => prev.filter((_, idx) => idx !== i));
    const updateItem = (i: number, field: string, value: unknown) =>
        setOrderItems(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: value } : item));

    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault();
        createMutation.mutate({ customerId, items: orderItems, notes, taxPercent });
    };

    return (
        <div>
            <div className="page-header flex items-start justify-between">
                <div>
                    <h1 className="page-title">Orders</h1>
                    <p className="page-subtitle">{data?.total ?? 0} total orders</p>
                </div>
                <Can module="orders" action="create">
                    <button className="btn-primary" onClick={() => setShowCreate(true)}>
                        <Plus size={18} /> New Order
                    </button>
                </Can>
            </div>

            {/* Status filter tabs */}
            <div className="flex gap-2 mb-5 flex-wrap">
                {['', 'PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED'].map(s => (
                    <button key={s} onClick={() => { setFilterStatus(s); setPage(1); }}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filterStatus === s ? 'bg-primary-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200'}`}>
                        {s || 'All'}
                    </button>
                ))}
            </div>

            <div className="table-container">
                <table className="table">
                    <thead><tr>
                        <th>Order #</th><th>Customer</th><th>Status</th><th>Total</th><th>Date</th><th>Actions</th>
                    </tr></thead>
                    <tbody>
                        {isLoading ? [...Array(5)].map((_, i) => (
                            <tr key={i}><td colSpan={6}><div className="h-4 bg-slate-800 rounded animate-pulse" /></td></tr>
                        )) : data?.items.map((o: Order) => (
                            <tr key={o.id}>
                                <td>
                                    <code className="text-xs text-primary-400 bg-primary-500/10 px-1.5 py-0.5 rounded">
                                        {o.orderNumber.substring(0, 20)}
                                    </code>
                                </td>
                                <td className="font-medium text-slate-200">
                                    {(o.customer as any)?.firstName} {(o.customer as any)?.lastName}
                                </td>
                                <td><span className={`badge ${STATUS_COLORS[o.status] ?? 'badge-default'}`}>{o.status}</span></td>
                                <td className="font-bold text-emerald-400">${Number(o.total).toFixed(2)}</td>
                                <td className="text-slate-500 text-xs">{new Date(o.createdAt).toLocaleDateString()}</td>
                                <td>
                                    <div className="flex gap-1">
                                        <Can module="orders" action="update">
                                            {STATUS_TRANSITIONS[o.status]?.map(nextStatus => (
                                                <button key={nextStatus}
                                                    onClick={() => updateStatusMutation.mutate({ id: o.id, status: nextStatus })}
                                                    className="text-xs px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition-colors">
                                                    → {nextStatus}
                                                </button>
                                            ))}
                                        </Can>
                                    </div>
                                </td>
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

            {/* Create Order Modal */}
            {showCreate && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <h2 className="text-lg font-semibold text-slate-200 mb-5">Create New Order</h2>
                        <form onSubmit={handleCreate} className="space-y-4">
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Customer</label>
                                <select value={customerId} onChange={e => setCustomerId(e.target.value)} className="input" required>
                                    <option value="">Select customer...</option>
                                    {customers?.items.map((c: any) => (
                                        <option key={c.id} value={c.id}>{c.firstName} {c.lastName} ({c.email})</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Order Items</label>
                                <div className="space-y-2">
                                    {orderItems.map((item, i) => (
                                        <div key={i} className="flex gap-2">
                                            <select value={item.productId} onChange={e => updateItem(i, 'productId', e.target.value)} className="input flex-1" required>
                                                <option value="">Select product...</option>
                                                {products?.items.map((p: any) => (
                                                    <option key={p.id} value={p.id}>{p.name} — ${Number(p.price).toFixed(2)} (Stock: {p.stockQuantity})</option>
                                                ))}
                                            </select>
                                            <input type="number" min="1" value={item.quantity}
                                                onChange={e => updateItem(i, 'quantity', Number(e.target.value))}
                                                className="input w-20 text-center" required />
                                            {orderItems.length > 1 && (
                                                <button type="button" onClick={() => removeItem(i)}
                                                    className="text-red-400 hover:text-red-300 text-lg px-1">✕</button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                <button type="button" onClick={addItem} className="mt-2 text-sm text-primary-400 hover:text-primary-300 flex items-center gap-1">
                                    <Plus size={14} /> Add item
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">Tax %</label>
                                    <input type="number" min="0" max="100" step="0.1" value={taxPercent}
                                        onChange={e => setTaxPercent(Number(e.target.value))} className="input" />
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">Notes</label>
                                    <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes" className="input" />
                                </div>
                            </div>

                            <div className="p-3 bg-primary-500/10 rounded-lg border border-primary-500/20 text-xs text-primary-300">
                                ℹ️ Stock will be reduced automatically and a draft invoice will be created.
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button type="button" className="btn-secondary flex-1 justify-center" onClick={() => setShowCreate(false)}>Cancel</button>
                                <button type="submit" className="btn-primary flex-1 justify-center" disabled={createMutation.isPending}>
                                    {createMutation.isPending ? 'Creating...' : 'Create Order'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
