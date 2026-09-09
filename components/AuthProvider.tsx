'use client';
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { apiUrl } from '../lib/api';
import { AuthSession, clearSession, getSession, saveSession, User } from '../lib/auth';
type AuthContextValue = { user: User | null; loading: boolean; login: (session: AuthSession) => void; logout: () => void };
const AuthContext = createContext<AuthContextValue | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null); const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => { const session = getSession(); if (!session) { setUser(null); setLoading(false); return; } setUser(session.user); try { const response = await fetch(apiUrl('/auth/me'), { headers: { Authorization: `Bearer ${session.accessToken}` } }); if (!response.ok) throw new Error(); const verified = await response.json() as User; saveSession({ ...session, user: verified }); setUser(verified); } catch { clearSession(); setUser(null); } finally { setLoading(false); } }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  return <AuthContext.Provider value={{ user, loading, login: (session) => { saveSession(session); setUser(session.user); }, logout: () => { clearSession(); setUser(null); } }}>{children}</AuthContext.Provider>;
}
export function useAuth() { const value = useContext(AuthContext); if (!value) throw new Error('useAuth must be used inside AuthProvider'); return value; }
