'use client';
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { dashboardForRole } from '../../lib/auth';
import { ApiError, authenticatedRequest } from '../../lib/authenticated-request';
import { useAuth } from '../AuthProvider';
import type { Establishment, Settings } from './types';

type Value = { establishment: Establishment | null; settings: Settings | null; loadingCompany: boolean; companyError: string; request: <T>(path: string, init?: RequestInit) => Promise<T>; refreshCompany: () => Promise<void> };
const Context = createContext<Value | null>(null);
export function EmpresaProvider({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth(); const router = useRouter(); const pathname=usePathname();
  const [establishment, setEstablishment] = useState<Establishment | null>(null); const [settings, setSettings] = useState<Settings | null>(null); const [loadingCompany, setLoadingCompany] = useState(true); const [companyError,setCompanyError]=useState('');
  const request = useCallback(async <T,>(path: string, init?: RequestInit) => {
    try{return await authenticatedRequest<T>(path,init)}catch(error){if(error instanceof ApiError&&error.status===401)router.replace(`/login?returnTo=${encodeURIComponent(pathname)}`);throw error}
  }, [pathname,router]);
  const refreshCompany = useCallback(async () => { setLoadingCompany(true);setCompanyError('');try{const result = await request<{ establishment: Establishment; settings: Settings }>('/restaurants/me'); setEstablishment(result.establishment); setSettings(result.settings);}catch(error){setCompanyError(error instanceof Error?error.message:'Não foi possível carregar os dados do estabelecimento.');throw error}finally{setLoadingCompany(false)} }, [request]);
  useEffect(() => { if (loading) return; if (!user) { router.replace(`/login?returnTo=${encodeURIComponent(pathname)}`); return; } if (user.role !== 'RESTAURANT_ADMIN') { router.replace(dashboardForRole[user.role]); return; } void refreshCompany().catch(()=>undefined); }, [loading, pathname, refreshCompany, router, user]);
  if (loading || !user || user.role !== 'RESTAURANT_ADMIN') return <main className="min-h-screen bg-background" aria-label="Carregando painel" />;
  return <Context.Provider value={{ establishment, settings, loadingCompany, companyError, request, refreshCompany }}>{children}</Context.Provider>;
}
export function useEmpresa() { const value = useContext(Context); if (!value) throw new Error('useEmpresa deve ser usado dentro de EmpresaProvider'); return value; }
