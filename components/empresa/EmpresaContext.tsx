'use client';
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiUrl } from '../../lib/api';
import { clearSession, dashboardForRole, getSession } from '../../lib/auth';
import { useAuth } from '../AuthProvider';
import type { Establishment, Settings } from './types';

type Value = { establishment: Establishment | null; settings: Settings | null; loadingCompany: boolean; request: <T>(path: string, init?: RequestInit) => Promise<T>; refreshCompany: () => Promise<void> };
const Context = createContext<Value | null>(null);
export function EmpresaProvider({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth(); const router = useRouter();
  const [establishment, setEstablishment] = useState<Establishment | null>(null); const [settings, setSettings] = useState<Settings | null>(null); const [loadingCompany, setLoadingCompany] = useState(true);
  const request = useCallback(async <T,>(path: string, init?: RequestInit) => {
    const session = getSession(); if (!session) throw new Error('Sua sessão expirou. Entre novamente.');
    const response = await fetch(apiUrl(path), { ...init, headers: { Authorization: `Bearer ${session.accessToken}`, ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...init?.headers } });
    const result = await response.json().catch(() => null) as T & { message?: string | string[] };
    if (response.status === 401) { clearSession(); router.replace('/login?returnTo=%2Fempresa'); throw new Error('Sua sessão expirou. Entre novamente.'); }
    if (!response.ok) throw new Error(Array.isArray(result?.message) ? result.message[0] : result?.message || 'Não foi possível concluir a operação.');
    return result;
  }, [router]);
  const refreshCompany = useCallback(async () => { const result = await request<{ establishment: Establishment; settings: Settings }>('/restaurants/me'); setEstablishment(result.establishment); setSettings(result.settings); }, [request]);
  useEffect(() => { if (loading) return; if (!user) { router.replace('/login?returnTo=%2Fempresa'); return; } if (user.role !== 'RESTAURANT_ADMIN') { router.replace(dashboardForRole[user.role]); return; } void refreshCompany().catch(() => {}).finally(() => setLoadingCompany(false)); }, [loading, refreshCompany, router, user]);
  if (loading || !user || user.role !== 'RESTAURANT_ADMIN') return <main className="min-h-screen bg-stone-100" aria-label="Carregando painel" />;
  return <Context.Provider value={{ establishment, settings, loadingCompany, request, refreshCompany }}>{children}</Context.Provider>;
}
export function useEmpresa() { const value = useContext(Context); if (!value) throw new Error('useEmpresa deve ser usado dentro de EmpresaProvider'); return value; }
