'use client';

export type Role = 'SUPER_ADMIN' | 'RESTAURANT_ADMIN' | 'EMPLOYEE' | 'CUSTOMER';

export type AuthSession = {
  accessToken: string;
  user: { id: string; name: string; email?: string; phone?: string; role: Role; restaurantId?: string };
};

const SESSION_KEY = 'menu-flow.auth-session';

export const dashboardForRole: Record<Role, string> = {
  SUPER_ADMIN: '/admin',
  RESTAURANT_ADMIN: '/empresa',
  EMPLOYEE: '/funcionario',
  CUSTOMER: '/cliente',
};

export function saveSession(session: AuthSession) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function getSession(): AuthSession | null {
  const value = sessionStorage.getItem(SESSION_KEY);
  if (!value) return null;
  try {
    const session = JSON.parse(value) as AuthSession;
    return session.accessToken && session.user?.role in dashboardForRole ? session : null;
  } catch {
    return null;
  }
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
}
