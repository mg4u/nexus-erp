import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Package, AlertTriangle, Pencil, Trash2 } from 'lucide-react';
import { productsApi, Product } from '@/api/services';
import toast from 'react-hot-toast';

export function ProductsPage() {
    const qc = useQueryClient();
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState<Product | null>(null);
    const [form, setForm] = useState({ name: '', sku: '', price: '', stockQuantity: '', category: '', description: '' });

    const { data, isLoading } = useQuery({
        queryKey: ['products', { search, page }],
        queryFn: () => productsApi.getAll({ search: search || undefined, page, limit: 20 }),
    });

    const createMutation = useMutation({
        mutationFn: (d: unknown) => editing ? productsApi.update(editing.id, d) : productsApi.create(d),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['products'] });
            setShowForm(false);
            setEditing(null);
            setForm({ name: '', sku: '', price: '', stockQuantity: '', category: '', description: '' });
            toast.success(editing ? 'Product updated!' : 'Product created!');
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => productsApi.remove(id),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['products'] }); toast.success('Product removed'); },
    });

    const handleEdit = (p: Product) => {
        setEditing(p);
        setForm({ name: p.name, sku: p.sku, price: String(p.price), stockQuantity: String(p.stockQuantity), category: p.category ?? '', description: p.description ?? '' });
        setShowForm(true);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        createMutation.mutate({ ...form, price: Number(form.price), stockQuantity: Number(form.stockQuantity) });
    };

    const statusBadge = (qty: number) => qty <= 10
        ? <span className="badge-warning flex items-center gap-1"><AlertTriangle size={11} />{qty} — low</span>
        : <span className="badge-success">{qty} in stock</span>;

    return (
        <div>
            <div className="page-header flex items-start justify-between">
                <div>
                    <h1 className="page-title">Products</h1>
                    <p className="page-subtitle">{data?.total ?? 0} products in catalog</p>
                </div>
                <button className="btn-primary" onClick={() => { setEditing(null); setForm({ name: '', sku: '', price: '', stockQuantity: '', category: '', description: '' }); setShowForm(true); }}>
                    <Plus size={18} /> New Product
                </button>
            </div>

            {/* Search */}
            <div className="relative mb-5">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                    placeholder="Search products..." className="input pl-9 max-w-sm" />
            </div>

            {/* Table */}
            <div className="table-container">
                <table className="table">
                    <thead><tr>
                        <th>Name</th><th>SKU</th><th>Price</th><th>Stock</th><th>Category</th><th>Actions</th>
                    </tr></thead>
                    <tbody>
                        {isLoading ? (
                            [...Array(5)].map((_, i) => (
                                <tr key={i}><td colSpan={6}><div className="h-4 bg-slate-800 rounded animate-pulse" /></td></tr>
                            ))
                        ) : data?.items.map((p) => (
                            <tr key={p.id}>
                                <td className="font-medium text-slate-200">{p.name}</td>
                                <td><code className="text-primary-400 text-xs bg-primary-500/10 px-1.5 py-0.5 rounded">{p.sku}</code></td>
                                <td className="font-medium">${Number(p.price).toFixed(2)}</td>
                                <td>{statusBadge(p.stockQuantity)}</td>
                                <td><span className="badge-default">{p.category ?? '—'}</span></td>
                                <td>
                                    <div className="flex gap-2">
                                        <button onClick={() => handleEdit(p)} className="text-slate-400 hover:text-primary-400 transition-colors"><Pencil size={15} /></button>
                                        <button onClick={() => deleteMutation.mutate(p.id)} className="text-slate-400 hover:text-red-400 transition-colors"><Trash2 size={15} /></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {data && data.totalPages > 1 && (
                <div className="flex justify-center gap-2 mt-4">
                    <button className="btn-secondary px-3 py-1.5 text-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Prev</button>
                    <span className="text-slate-400 text-sm self-center">Page {page} of {data.totalPages}</span>
                    <button className="btn-secondary px-3 py-1.5 text-sm" disabled={page === data.totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
                </div>
            )}

            {/* Form modal */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="card w-full max-w-md">
                        <h2 className="text-lg font-semibold text-slate-200 mb-5">{editing ? 'Edit Product' : 'New Product'}</h2>
                        <form onSubmit={handleSubmit} className="space-y-3">
                            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Product name" className="input" required />
                            <div className="grid grid-cols-2 gap-3">
                                <input value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))} placeholder="SKU" className="input" required />
                                <input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="Category" className="input" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <input type="number" step="0.01" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="Price" className="input" required />
                                <input type="number" value={form.stockQuantity} onChange={e => setForm(f => ({ ...f, stockQuantity: e.target.value }))} placeholder="Stock qty" className="input" required />
                            </div>
                            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Description (optional)" className="input h-20 resize-none" />
                            <div className="flex gap-3 pt-2">
                                <button type="button" className="btn-secondary flex-1 justify-center" onClick={() => setShowForm(false)}>Cancel</button>
                                <button type="submit" className="btn-primary flex-1 justify-center" disabled={createMutation.isPending}>
                                    {createMutation.isPending ? 'Saving...' : (editing ? 'Update' : 'Create')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
