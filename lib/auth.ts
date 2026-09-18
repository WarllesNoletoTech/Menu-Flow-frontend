'use client';

export type Role = 'SUPER_ADMIN' | 'RESTAURANT_ADMIN' | 'EMPLOYEE' | 'CUSTOMER';
export type User = { id: string; name: string; email?: string; phone?: string; reportWhatsapp?: string; role: Role; restaurantId?: string; employeePosition?: 'WAITER'|'KITCHEN'|'CASHIER'|'MANAGER'|'OTHER'; permissions?: string[] };
export type AuthSession = { accessToken: string; user: User };
export type AuthScope = 'STAFF' | 'CUSTOMER';

const LEGACY_SESSION_KEY = 'menu-flow.auth-session';
const STAFF_SESSION_KEY = 'menu-flow.auth-session.staff.v1';
const CUSTOMER_SESSION_KEY = 'menu-flow.auth-session.customer.v1';

export const dashboardForRole: Record<Role, string> = {
  SUPER_ADMIN: '/admin',
  RESTAURANT_ADMIN: '/empresa/pedidos',
  EMPLOYEE: '/funcionario',
  CUSTOMER: '/cliente',
};

export const roleLabel: Record<Role, string> = {
  SUPER_ADMIN: 'Administrador',
  RESTAURANT_ADMIN: 'Lojista',
  EMPLOYEE: 'Funcionário',
  CUSTOMER: 'Cliente',
};

function parseSession(value: string | null): AuthSession | null {
  if (!value) return null;
  try {
    const session = JSON.parse(value) as AuthSession;
    if (!session.accessToken || !session.user?.role || !(session.user.role in dashboardForRole)) return null;
    return session;
  } catch {
    return null;
  }
}

function storageGet(key: string) {
  try { return localStorage.getItem(key) || sessionStorage.getItem(key); } catch { return null; }
}

function storageSet(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* Storage pode estar bloqueado pelo navegador. */ }
  try { sessionStorage.setItem(key, value); } catch { /* Mantém compatibilidade quando disponível. */ }
}

function storageRemove(key: string) {
  try { localStorage.removeItem(key); } catch { /* noop */ }
  try { sessionStorage.removeItem(key); } catch { /* noop */ }
}

/**
 * Migra silenciosamente a sessão única usada até a v37 para os dois espaços
 * independentes. Isso preserva quem já estava logado após a atualização.
 */
function migrateLegacySession() {
  const raw = storageGet(LEGACY_SESSION_KEY);
  if (!raw) return;
  const session = parseSession(raw);
  if (session) {
    const target = session.user.role === 'CUSTOMER' ? CUSTOMER_SESSION_KEY : STAFF_SESSION_KEY;
    if (!storageGet(target)) storageSet(target, raw);
  }
  storageRemove(LEGACY_SESSION_KEY);
}

function readScope(scope: AuthScope): AuthSession | null {
  migrateLegacySession();
  const key = scope === 'CUSTOMER' ? CUSTOMER_SESSION_KEY : STAFF_SESSION_KEY;
  const session = parseSession(storageGet(key));
  if (!session) return null;
  if (scope === 'CUSTOMER' && session.user.role !== 'CUSTOMER') return null;
  if (scope === 'STAFF' && session.user.role === 'CUSTOMER') return null;
  return session;
}

function saveScope(session: AuthSession, scope: AuthScope) {
  const key = scope === 'CUSTOMER' ? CUSTOMER_SESSION_KEY : STAFF_SESSION_KEY;
  storageSet(key, JSON.stringify(session));
}

/** Sessão operacional: administrador, lojista ou funcionário. */
export function getSession(): AuthSession | null {
  return readScope('STAFF');
}

/** Sessão exclusiva do cliente do cardápio. */
export function getCustomerSession(): AuthSession | null {
  return readScope('CUSTOMER');
}

/**
 * Mantém compatibilidade com chamadas antigas. A função escolhe o espaço pelo
 * papel do usuário, portanto um login de cliente nunca sobrescreve o lojista.
 */
export function saveSession(session: AuthSession) {
  if (session.user.role === 'CUSTOMER') saveCustomerSession(session);
  else saveScope(session, 'STAFF');
}

export function saveCustomerSession(session: AuthSession) {
  if (session.user.role !== 'CUSTOMER') throw new Error('A sessão informada não pertence a um cliente.');
  saveScope(session, 'CUSTOMER');
}

/** Limpa somente a sessão operacional. */
export function clearSession() {
  storageRemove(STAFF_SESSION_KEY);
}

/** Limpa somente a sessão do cliente, sem afetar lojista/admin/funcionário. */
export function clearCustomerSession() {
  storageRemove(CUSTOMER_SESSION_KEY);
}

export function clearAllSessions() {
  clearSession();
  clearCustomerSession();
  storageRemove(LEGACY_SESSION_KEY);
}

export function safeReturnTo(value: string | null) {
  return value && value.startsWith('/') && !value.startsWith('//') && !value.includes('\\') ? value : '/';
}
