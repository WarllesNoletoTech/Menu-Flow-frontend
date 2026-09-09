'use client';
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { AuthSession, clearSession, getSession, saveSession, User } from '../lib/auth';
import { ApiError, authenticatedRequest } from '../lib/authenticated-request';
type AuthContextValue = { user: User | null; loading: boolean; authError: string; retry: () => Promise<void>; login: (session: AuthSession) => void; logout: () => void };
const AuthContext = createContext<AuthContextValue | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null); const [loading, setLoading] = useState(true); const [authError,setAuthError]=useState('');
  const refresh = useCallback(async () => { const session = getSession(); if (!session) { setUser(null); setLoading(false); return; } setUser(session.user); setAuthError(''); try { const verified = await authenticatedRequest<User>('/auth/me'); saveSession({ ...session, user: verified }); setUser(verified); } catch (error) { if (error instanceof ApiError && error.status === 401) setUser(null); else setAuthError(error instanceof Error ? error.message : 'Não foi possível validar a sessão agora.'); } finally { setLoading(false); } }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  return <AuthContext.Provider value={{ user, loading, authError, retry: refresh, login: (session) => { saveSession(session); setAuthError(''); setUser(session.user); }, logout: () => { clearSession(); setUser(null); setAuthError(''); } }}>{children}</AuthContext.Provider>;
}
export function useAuth() { const value = useContext(AuthContext); if (!value) throw new Error('useAuth must be used inside AuthProvider'); return value; }
