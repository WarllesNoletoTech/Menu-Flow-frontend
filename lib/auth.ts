'use client';
export type Role = 'SUPER_ADMIN' | 'RESTAURANT_ADMIN' | 'EMPLOYEE' | 'CUSTOMER';
export type User = { id: string; name: string; email?: string; phone?: string; reportWhatsapp?: string; role: Role; restaurantId?: string };
export type AuthSession = { accessToken: string; user: User };
const SESSION_KEY = 'menu-flow.auth-session';
export const dashboardForRole: Record<Role, string> = { SUPER_ADMIN: '/admin', RESTAURANT_ADMIN: '/empresa', EMPLOYEE: '/funcionario', CUSTOMER: '/cliente' };
export const roleLabel: Record<Role, string> = { SUPER_ADMIN: 'Administrador', RESTAURANT_ADMIN: 'Lojista', EMPLOYEE: 'Funcionário', CUSTOMER: 'Cliente' };
export function saveSession(session: AuthSession) { sessionStorage.setItem(SESSION_KEY, JSON.stringify(session)); }
export function getSession(): AuthSession | null { const value = sessionStorage.getItem(SESSION_KEY); if (!value) return null; try { const session = JSON.parse(value) as AuthSession; return session.accessToken && session.user?.role in dashboardForRole ? session : null; } catch { return null; } }
export function clearSession() { sessionStorage.removeItem(SESSION_KEY); }
export function safeReturnTo(value: string | null) { return value && value.startsWith('/') && !value.startsWith('//') && !value.includes('\\') ? value : '/'; }
