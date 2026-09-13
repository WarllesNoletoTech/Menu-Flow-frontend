'use client';

import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import {
  AuthSession,
  clearCustomerSession,
  clearSession,
  getCustomerSession,
  getSession,
  saveCustomerSession,
  saveSession,
  User,
} from '../lib/auth';
import { ApiError, authenticatedRequest } from '../lib/authenticated-request';
import { detachPushSubscriptionOnLogout } from '../lib/notifications';

type AuthContextValue = {
  /** Usuário operacional: admin, lojista ou funcionário. */
  user: User | null;
  loading: boolean;
  authError: string;
  retry: () => Promise<void>;
  login: (session: AuthSession) => void;
  logout: () => void;

  /** Cliente do cardápio, mantido em sessão independente. */
  customerUser: User | null;
  customerLoading: boolean;
  customerAuthError: string;
  retryCustomer: () => Promise<void>;
  loginCustomer: (session: AuthSession) => void;
  logoutCustomer: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState('');

  const [customerUser, setCustomerUser] = useState<User | null>(null);
  const [customerLoading, setCustomerLoading] = useState(true);
  const [customerAuthError, setCustomerAuthError] = useState('');

  const refresh = useCallback(async () => {
    const session = getSession();
    if (!session) {
      setUser(null);
      setLoading(false);
      return;
    }
    setUser(session.user);
    setAuthError('');
    try {
      const verified = await authenticatedRequest<User>('/auth/me', undefined, 'STAFF');
      if (verified.role === 'CUSTOMER') throw new ApiError('Sessão operacional inválida.', 401);
      saveSession({ ...session, user: verified });
      setUser(verified);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        clearSession();
        setUser(null);
      } else {
        setAuthError(error instanceof Error ? error.message : 'Não foi possível validar a sessão agora.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshCustomer = useCallback(async () => {
    const session = getCustomerSession();
    if (!session) {
      setCustomerUser(null);
      setCustomerLoading(false);
      return;
    }
    setCustomerUser(session.user);
    setCustomerAuthError('');
    try {
      const verified = await authenticatedRequest<User>('/auth/me', undefined, 'CUSTOMER');
      if (verified.role !== 'CUSTOMER') throw new ApiError('Sessão de cliente inválida.', 401);
      saveCustomerSession({ ...session, user: verified });
      setCustomerUser(verified);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        clearCustomerSession();
        setCustomerUser(null);
      } else {
        setCustomerAuthError(error instanceof Error ? error.message : 'Não foi possível validar a sessão do cliente agora.');
      }
    } finally {
      setCustomerLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    void refreshCustomer();
  }, [refresh, refreshCustomer]);

  const loginCustomer = useCallback((session: AuthSession) => {
    if (session.user.role !== 'CUSTOMER') return;
    saveCustomerSession(session);
    setCustomerAuthError('');
    setCustomerUser(session.user);
  }, []);

  const login = useCallback((session: AuthSession) => {
    // Compatibilidade: caso o login genérico receba uma conta de cliente,
    // armazena no espaço de cliente sem tocar na sessão do lojista/admin.
    if (session.user.role === 'CUSTOMER') {
      loginCustomer(session);
      return;
    }
    saveSession(session);
    setAuthError('');
    setUser(session.user);
  }, [loginCustomer]);

  const logout = useCallback(() => {
    const session = getSession();
    if (session?.accessToken) void detachPushSubscriptionOnLogout(session.accessToken);
    clearSession();
    setUser(null);
    setAuthError('');
  }, []);

  const logoutCustomer = useCallback(() => {
    // Importante: não desinscreve Push, pois a assinatura pode pertencer ao
    // lojista/admin logado no mesmo aparelho.
    clearCustomerSession();
    setCustomerUser(null);
    setCustomerAuthError('');
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      authError,
      retry: refresh,
      login,
      logout,
      customerUser,
      customerLoading,
      customerAuthError,
      retryCustomer: refreshCustomer,
      loginCustomer,
      logoutCustomer,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
