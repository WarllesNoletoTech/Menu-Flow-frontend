'use client';

import type { Role } from '../../lib/auth';

/**
 * O Menu Flow usa somente Push real do OneSignal para alertas de pedidos.
 * Não exibimos toast/aviso próprio dentro do painel para não dar a impressão
 * de que a notificação funciona apenas enquanto o app está aberto.
 */
export function DashboardNotifications({ role: _role }: { role: Role }) {
  return null;
}
