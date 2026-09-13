'use client';
import { createContext, ReactNode, useCallback, useContext } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { Role } from '../../lib/auth';
import { ApiError, authenticatedRequest } from '../../lib/authenticated-request';

type Value = { request: <T>(path: string, init?: RequestInit) => Promise<T> };
const Context = createContext<Value | null>(null);

export function DashboardProvider({ children, role }: { children: ReactNode; role: Role }) {
  const router = useRouter();
  const pathname = usePathname();
  const customer = role === 'CUSTOMER';
  const request = useCallback(async <T,>(path: string, init?: RequestInit) => {
    try {
      return await authenticatedRequest<T>(path, init, customer ? 'CUSTOMER' : 'STAFF');
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        const loginPath = customer ? '/cliente/login' : '/login';
        router.replace(`${loginPath}?returnTo=${encodeURIComponent(pathname)}`);
      }
      throw error;
    }
  }, [customer, pathname, router]);
  return <Context.Provider value={{ request }}>{children}</Context.Provider>;
}

export function useDashboard() {
  const value = useContext(Context);
  if (!value) throw new Error('useDashboard deve ser usado dentro de DashboardProvider');
  return value;
}
