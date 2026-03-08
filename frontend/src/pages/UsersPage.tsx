import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import { usersApi, User } from '@/api/services';
import toast from 'react-hot-toast';
import { Can } from '@/components/common/Can';

const ROLES = ['ADMIN', 'MANAGER', 'ACCOUNTANT', 'EMPLOYEE'];

const roleBadge = (role: string) => {
    const map: Record<string, string> = {
        ADMIN: 'badge-danger',
        MANAGER: 'badge-info',
        ACCOUNTANT: 'badge-warning',
        EMPLOYEE: 'badge-default',
    };
    return <span className={`badge ${map[role] ?? 'badge-default'}`}>{role}</span>;
};

export function UsersPage() {
    const qc = useQueryClient();
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ firstName: '', lastName: '', email: '', role: 'EMPLOYEE', password: '', action: 'create', id: '' });

    const { data, isLoading } = useQuery({
        queryKey: ['users', { search, page }],
        queryFn: () => usersApi.getAll({ search: search || undefined, page, limit: 20 }),
    });

    const createMutation = useMutation({
        mutationFn: (d: any) => {
            const { firstName, lastName, email, role, password } = d
            return usersApi.create({ firstName, lastName, email, role, password })
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['users'] });
            cancelForm();
            toast.success('User created!');
        },
    });
    const editUser = (user: User) => {
        setForm({
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            role: user.role,
            password: '',
            action: 'update',
            id: user.id,
        });
        setShowForm(true);
    };
    const cancelForm = () => {
        setForm({ firstName: '', lastName: '', email: '', role: 'EMPLOYEE', password: '', action: 'create', id: '' });
        setShowForm(false);
    };
    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) => {
            const { firstName, lastName, email, role, password } = data
            console.log(data);
            return usersApi.update(id, { firstName, lastName, email, role, password })
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['users'] });
            cancelForm();
            toast.success('User updated!');
        },
    });

    const deactivateMutation = useMutation({
        mutationFn: (id: string) => usersApi.deactivate(id),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success('User deactivated'); },
    });

    return (
        <div>
            <div className="page-header flex items-start justify-between">
                <div>
                    <h1 className="page-title">Users</h1>
                    <p className="page-subtitle">{data?.total ?? 0} team members</p>
                </div>
                <Can module="users" action="create">
                    <button className="btn-primary" onClick={() => setShowForm(true)}>
                        <Plus size={18} /> Invite User
                    </button>
                </Can>
            </div>

            <div className="relative mb-5">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search users..." className="input pl-9 max-w-sm" />
            </div>

            <div className="table-container">
                <table className="table">
                    <thead><tr>
                        <th>User</th><th>Email</th><th>Role</th><th>Status</th><th>Last Login</th><th>Actions</th>
                    </tr></thead>
                    <tbody>
                        {isLoading ? [...Array(5)].map((_, i) => (
                            <tr key={i}><td colSpan={6}><div className="h-4 bg-slate-800 rounded animate-pulse" /></td></tr>
                        )) : data?.items.map((u: User) => (
                            <tr key={u.id}>
                                <td>
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-blue-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                                            {u.firstName.charAt(0)}{u.lastName.charAt(0)}
                                        </div>
                                        <span className="font-medium text-slate-200">{u.firstName} {u.lastName}</span>
                                    </div>
                                </td>
                                <td className="text-slate-400">{u.email}</td>
                                <td>{roleBadge(u.role)}</td>
                                <td>
                                    <span className={u.isActive ? 'badge-success' : 'badge-danger'}>
                                        {u.isActive ? 'Active' : 'Inactive'}
                                    </span>
                                </td>
                                <td className="text-slate-500 text-xs">
                                    {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : 'Never'}
                                </td>
                                <td>
                                    <Can module="users" action="update">
                                        <button onClick={() => editUser(u)}
                                            className="text-xs text-blue-400 hover:text-blue-300 transition-colors mx-2">
                                            Edit
                                        </button>
                                    </Can>
                                    {u.isActive && (
                                        <Can module="users" action="delete">
                                            <button onClick={() => deactivateMutation.mutate(u.id)}
                                                className="text-xs text-red-400 hover:text-red-300 transition-colors">
                                                Deactivate
                                            </button>
                                        </Can>
                                    )}
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

            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="card w-full max-w-md">
                        <h2 className="text-lg font-semibold text-slate-200 mb-5">Invite Team Member</h2>
                        <form onSubmit={e => { e.preventDefault(); form.action === 'create' ? createMutation.mutate(form) : updateMutation.mutate({ id: form.id, data: form }); }} className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <input value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} placeholder="First name" className="input" required />
                                <input value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} placeholder="Last name" className="input" required />
                            </div>
                            <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="Email address" className="input" required />
                            <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} className="input">
                                {ROLES.map(r => <option key={r} selected={form.role === r}value={r}>{r}</option>)}
                            </select>
                            <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Temporary password" className="input" required />
                            <div className="flex gap-3 pt-2">
                                <button type="button" className="btn-secondary flex-1 justify-center" onClick={() => cancelForm()}>Cancel</button>
                                <button type="submit" className="btn-primary flex-1 justify-center" disabled={form.action === 'create' ? createMutation.isPending : updateMutation.isPending}>
                                    {form.action === 'create' ? 'Create User' : 'Update User'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
