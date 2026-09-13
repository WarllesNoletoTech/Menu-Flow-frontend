'use client';
export type Role = 'SUPER_ADMIN' | 'RESTAURANT_ADMIN' | 'EMPLOYEE' | 'CUSTOMER';
export type User = { id: string; name: string; email?: string; phone?: string; reportWhatsapp?: string; role: Role; restaurantId?: string };
export type AuthSession = { accessToken: string; user: User };
const SESSION_KEY = 'menu-flow.auth-session';
export const dashboardForRole: Record<Role, string> = { SUPER_ADMIN: '/admin', RESTAURANT_ADMIN: '/empresa', EMPLOYEE: '/funcionario', CUSTOMER: '/cliente' };
export const roleLabel: Record<Role, string> = { SUPER_ADMIN: 'Administrador', RESTAURANT_ADMIN: 'Lojista', EMPLOYEE: 'Funcionário', CUSTOMER: 'Cliente' };
function readStoredSession() {
  try { return localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY); } catch { return null; }
}
export function saveSession(session: AuthSession) {
  const value = JSON.stringify(session);
  try { localStorage.setItem(SESSION_KEY, value); } catch { /* Storage pode estar bloqueado pelo navegador. */ }
  try { sessionStorage.setItem(SESSION_KEY, value); } catch { /* Mantém compatibilidade quando disponível. */ }
}
export function getSession(): AuthSession | null {
  const value = readStoredSession();
  if (!value) return null;
  try {
    const session = JSON.parse(value) as AuthSession;
    if (!session.accessToken || !(session.user?.role in dashboardForRole)) return null;
    try { localStorage.setItem(SESSION_KEY, value); } catch { /* Migração silenciosa da sessão antiga. */ }
    return session;
  } catch { return null; }
}
export function clearSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch { /* noop */ }
  try { sessionStorage.removeItem(SESSION_KEY); } catch { /* noop */ }
}
export function safeReturnTo(value: string | null) { return value && value.startsWith('/') && !value.startsWith('//') && !value.includes('\\') ? value : '/'; }
