import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Building2, Mail, Lock, User, Briefcase, Loader2 } from 'lucide-react';
import { authApi } from '@/api/services';
import { useAuthStore } from '@/store/auth.store';
import toast from 'react-hot-toast';

interface RegisterForm {
    companyName: string;
    companySlug: string;
    firstName: string;
    lastName: string;
    email: string;
    password: string;
}

export function RegisterPage() {
    const [isLoading, setIsLoading] = useState(false);
    const { setAuth } = useAuthStore();
    const navigate = useNavigate();

    const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<RegisterForm>();

    const onSubmit = async (data: RegisterForm) => {
        setIsLoading(true);
        try {
            const result = await authApi.register(data);
            setAuth(result);
            toast.success(`Welcome to SaaS ERP, ${result.user.firstName}!`);
            navigate('/dashboard');
        } catch {
            // Handled by axios interceptor
        } finally {
            setIsLoading(false);
        }
    };

    const handleCompanyNameChange = (name: string) => {
        setValue('companyName', name);
        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        setValue('companySlug', slug);
    };

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 -left-64 w-96 h-96 bg-primary-600/20 rounded-full blur-3xl" />
                <div className="absolute bottom-1/4 -right-64 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl" />
            </div>

            <div className="w-full max-w-md relative">
                <div className="text-center mb-8">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-blue-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary-500/30">
                        <Building2 size={30} className="text-white" />
                    </div>
                    <h1 className="text-3xl font-bold text-slate-100 mb-1">Create your workspace</h1>
                    <p className="text-slate-400">Start your ERP journey today</p>
                </div>

                <div className="card-glow">
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1.5">Company Name</label>
                            <div className="relative">
                                <Briefcase size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                                <input
                                    {...register('companyName', { required: 'Company name is required' })}
                                    placeholder="Acme Corporation"
                                    className="input pl-9"
                                    onChange={(e) => handleCompanyNameChange(e.target.value)}
                                />
                            </div>
                            {errors.companyName && <p className="text-red-400 text-xs mt-1">{errors.companyName.message}</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1.5">Company Slug</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">@</span>
                                <input
                                    {...register('companySlug', {
                                        required: 'Slug is required',
                                        pattern: { value: /^[a-z0-9-]+$/, message: 'Lowercase, numbers, hyphens only' }
                                    })}
                                    placeholder="acme-corp"
                                    className="input pl-9"
                                />
                            </div>
                            {errors.companySlug && <p className="text-red-400 text-xs mt-1">{errors.companySlug.message}</p>}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1.5">First Name</label>
                                <input
                                    {...register('firstName', { required: 'Required' })}
                                    placeholder="John"
                                    className="input"
                                />
                                {errors.firstName && <p className="text-red-400 text-xs mt-1">{errors.firstName.message}</p>}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1.5">Last Name</label>
                                <input
                                    {...register('lastName', { required: 'Required' })}
                                    placeholder="Doe"
                                    className="input"
                                />
                                {errors.lastName && <p className="text-red-400 text-xs mt-1">{errors.lastName.message}</p>}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
                            <div className="relative">
                                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                                <input
                                    {...register('email', { required: 'Email is required', pattern: { value: /\S+@\S+\.\S+/, message: 'Invalid email' } })}
                                    type="email"
                                    placeholder="admin@acme.com"
                                    className="input pl-9"
                                />
                            </div>
                            {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1.5">Password</label>
                            <div className="relative">
                                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                                <input
                                    {...register('password', {
                                        required: 'Password is required',
                                        minLength: { value: 8, message: 'At least 8 characters' },
                                        pattern: {
                                            value: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/,
                                            message: 'Must include uppercase, lowercase, number & special char'
                                        }
                                    })}
                                    type="password"
                                    placeholder="••••••••"
                                    className="input pl-9"
                                />
                            </div>
                            {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>}
                        </div>

                        <button type="submit" disabled={isLoading} className="btn-primary w-full justify-center mt-2">
                            {isLoading && <Loader2 size={18} className="animate-spin" />}
                            {isLoading ? 'Creating workspace...' : 'Create workspace'}
                        </button>
                    </form>

                    <p className="text-center text-slate-500 text-sm mt-5">
                        Already have an account?{' '}
                        <Link to="/login" className="text-primary-400 hover:text-primary-300 font-medium">
                            Sign in
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
