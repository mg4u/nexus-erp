import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, UserCheck, Mail, Phone, MapPin, Pencil, Trash2 } from 'lucide-react';
import { customersApi, Customer } from '@/api/services';
import toast from 'react-hot-toast';

export function CustomersPage() {
    const qc = useQueryClient();
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState<Customer | null>(null);
    const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', address: '', city: '', country: '' });

    const { data, isLoading } = useQuery({
        queryKey: ['customers', { search, page }],
        queryFn: () => customersApi.getAll({ search: search || undefined, page, limit: 20 }),
    });

    const saveMutation = useMutation({
        mutationFn: (d: unknown) => editing ? customersApi.update(editing.id, d) : customersApi.create(d),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['customers'] });
            setShowForm(false);
            setEditing(null);
            setForm({ firstName: '', lastName: '', email: '', phone: '', address: '', city: '', country: '' });
            toast.success(editing ? 'Customer updated!' : 'Customer created!');
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => customersApi.remove(id),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['customers'] }); toast.success('Customer removed'); },
    });

    const handleEdit = (c: Customer) => {
        setEditing(c);
        setForm({ firstName: c.firstName, lastName: c.lastName, email: c.email, phone: c.phone ?? '', address: '', city: c.city ?? '', country: c.country ?? '' });
        setShowForm(true);
    };

    return (
        <div>
            <div className="page-header flex items-start justify-between">
                <div>
                    <h1 className="page-title">Customers</h1>
                    <p className="page-subtitle">{data?.total ?? 0} active customers</p>
                </div>
                <button className="btn-primary" onClick={() => { setEditing(null); setForm({ firstName: '', lastName: '', email: '', phone: '', address: '', city: '', country: '' }); setShowForm(true); }}>
                    <Plus size={18} /> New Customer
                </button>
            </div>

            <div className="relative mb-5">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search customers..." className="input pl-9 max-w-sm" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {isLoading ? [...Array(6)].map((_, i) => (
                    <div key={i} className="card h-36 animate-pulse bg-slate-800/50" />
                )) : data?.items.map((c) => (
                    <div key={c.id} className="card hover:border-slate-700 transition-colors group">
                        <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-sm font-bold text-white">
                                    {c.firstName.charAt(0)}{c.lastName.charAt(0)}
                                </div>
                                <div>
                                    <p className="font-semibold text-slate-200">{c.firstName} {c.lastName}</p>
                                    <p className="text-xs text-slate-500">Customer</p>
                                </div>
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => handleEdit(c)} className="p-1.5 text-slate-400 hover:text-primary-400 hover:bg-primary-500/10 rounded-lg transition-colors"><Pencil size={14} /></button>
                                <button onClick={() => deleteMutation.mutate(c.id)} className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"><Trash2 size={14} /></button>
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <div className="flex items-center gap-2 text-xs text-slate-400">
                                <Mail size={12} className="flex-shrink-0" />
                                <span className="truncate">{c.email}</span>
                            </div>
                            {c.phone && (
                                <div className="flex items-center gap-2 text-xs text-slate-400">
                                    <Phone size={12} className="flex-shrink-0" />
                                    <span>{c.phone}</span>
                                </div>
                            )}
                            {(c.city || c.country) && (
                                <div className="flex items-center gap-2 text-xs text-slate-400">
                                    <MapPin size={12} className="flex-shrink-0" />
                                    <span>{[c.city, c.country].filter(Boolean).join(', ')}</span>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {data && data.totalPages > 1 && (
                <div className="flex justify-center gap-2 mt-6">
                    <button className="btn-secondary px-3 py-1.5 text-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Prev</button>
                    <span className="text-slate-400 text-sm self-center">Page {page} of {data.totalPages}</span>
                    <button className="btn-secondary px-3 py-1.5 text-sm" disabled={page === data.totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
                </div>
            )}

            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="card w-full max-w-md">
                        <h2 className="text-lg font-semibold text-slate-200 mb-5">{editing ? 'Edit Customer' : 'New Customer'}</h2>
                        <form onSubmit={e => { e.preventDefault(); saveMutation.mutate(form); }} className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <input value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} placeholder="First name" className="input" required />
                                <input value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} placeholder="Last name" className="input" required />
                            </div>
                            <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="Email address" className="input" required />
                            <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="Phone (optional)" className="input" />
                            <div className="grid grid-cols-2 gap-3">
                                <input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} placeholder="City" className="input" />
                                <input value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} placeholder="Country" className="input" />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" className="btn-secondary flex-1 justify-center" onClick={() => setShowForm(false)}>Cancel</button>
                                <button type="submit" className="btn-primary flex-1 justify-center" disabled={saveMutation.isPending}>
                                    {saveMutation.isPending ? 'Saving...' : (editing ? 'Update' : 'Create')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
