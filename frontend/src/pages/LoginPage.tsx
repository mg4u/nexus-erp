import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Building2, Mail, Lock, Loader2, Eye, EyeOff } from 'lucide-react';
import { authApi } from '@/api/services';
import { useAuthStore } from '@/store/auth.store';
import toast from 'react-hot-toast';

interface LoginForm {
    email: string;
    password: string;
}

export function LoginPage() {
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const { setAuth } = useAuthStore();
    const navigate = useNavigate();

    const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>();

    const onSubmit = async (data: LoginForm) => {
        setIsLoading(true);
        try {
            const result = await authApi.login(data);
            setAuth(result);
            toast.success(`Welcome back, ${result.user.firstName}!`);
            navigate('/dashboard');
        } catch {
            // Error toast handled by axios interceptor
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
            {/* Background gradient */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 -left-64 w-96 h-96 bg-primary-600/20 rounded-full blur-3xl" />
                <div className="absolute bottom-1/4 -right-64 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl" />
            </div>

            <div className="w-full max-w-md relative">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-blue-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary-500/30">
                        <Building2 size={30} className="text-white" />
                    </div>
                    <h1 className="text-3xl font-bold text-slate-100 mb-1">Welcome back</h1>
                    <p className="text-slate-400">Sign in to your ERP workspace</p>
                </div>

                {/* Card */}
                <div className="card-glow">
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                        {/* Email */}
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1.5">Email address</label>
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

                        {/* Password */}
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1.5">Password</label>
                            <div className="relative">
                                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                                <input
                                    {...register('password', { required: 'Password is required' })}
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="••••••••"
                                    className="input pl-9 pr-10"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                                >
                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                            {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>}
                        </div>

                        <button type="submit" disabled={isLoading} className="btn-primary w-full justify-center">
                            {isLoading ? <Loader2 size={18} className="animate-spin" /> : null}
                            {isLoading ? 'Signing in...' : 'Sign in'}
                        </button>
                    </form>

                    <p className="text-center text-slate-500 text-sm mt-6">
                        Don't have an account?{' '}
                        <Link to="/register" className="text-primary-400 hover:text-primary-300 font-medium">
                            Register your company
                        </Link>
                    </p>

                    {/* Demo credentials */}
                    <div className="mt-4 p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
                        <p className="text-xs text-slate-500 font-medium mb-1">Demo credentials:</p>
                        <p className="text-xs text-slate-400">admin@acme.com / Secret123!</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
