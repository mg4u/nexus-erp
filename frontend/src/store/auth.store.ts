import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type UserRole = 'ADMIN' | 'MANAGER' | 'ACCOUNTANT' | 'EMPLOYEE';

export interface AuthUser {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: UserRole;
    tenantId: string;
}

export interface AuthTenant {
    id: string;
    name: string;
    slug: string;
    plan?: string;
}

interface AuthState {
    accessToken: string | null;
    refreshToken: string | null;
    user: AuthUser | null;
    tenant: AuthTenant | null;
    isAuthenticated: boolean;

    setAuth: (data: {
        accessToken: string;
        refreshToken: string;
        user: AuthUser;
        tenant: AuthTenant;
    }) => void;
    setAccessToken: (token: string) => void;
    logout: () => void;
    hasRole: (roles: UserRole[]) => boolean;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            accessToken: null,
            refreshToken: null,
            user: null,
            tenant: null,
            isAuthenticated: false,

            setAuth: ({ accessToken, refreshToken, user, tenant }) =>
                set({ accessToken, refreshToken, user, tenant, isAuthenticated: true }),

            setAccessToken: (token) => set({ accessToken: token }),

            logout: () =>
                set({ accessToken: null, refreshToken: null, user: null, tenant: null, isAuthenticated: false }),

            hasRole: (roles: UserRole[]) => {
                const { user } = get();
                return user ? roles.includes(user.role) : false;
            },
        }),
        {
            name: 'saas-erp-auth',
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({
                accessToken: state.accessToken,
                refreshToken: state.refreshToken,
                user: state.user,
                tenant: state.tenant,
                isAuthenticated: state.isAuthenticated,
            }),
        },
    ),
);
