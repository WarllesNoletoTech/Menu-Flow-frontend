import type { Role } from '../../lib/auth';
export type DashboardItem = { label: string; href: string; icon: string; external?: boolean };
export const dashboardMenus: Record<Role, DashboardItem[]> = {
  SUPER_ADMIN: [
    { icon: '▣', label: 'Visão geral', href: '/admin' }, { icon: '▦', label: 'Estabelecimentos', href: '/admin/restaurantes' }, { icon: '♙', label: 'Usuários', href: '/admin/usuarios' }, { icon: 'R$', label: 'Cobranças', href: '/admin/cobrancas' }, { icon: '♙', label: 'Minha conta', href: '/admin/conta' }, { icon: '↗', label: 'Portal público', href: '/', external: true },
  ],
  RESTAURANT_ADMIN: [],
  EMPLOYEE: [
    { icon: '▣', label: 'Visão geral', href: '/funcionario' }, { icon: '▤', label: 'Pedidos', href: '/funcionario/pedidos' }, { icon: '♙', label: 'Minha conta', href: '/funcionario/conta' },
  ],
  CUSTOMER: [
    { icon: '▣', label: 'Visão geral', href: '/cliente' }, { icon: '▤', label: 'Meus pedidos', href: '/cliente/pedidos' }, { icon: '⌂', label: 'Meus endereços', href: '/cliente/enderecos' }, { icon: '♙', label: 'Minha conta', href: '/cliente/conta' }, { icon: '↗', label: 'Explorar lojas', href: '/', external: true },
  ],
};
export const panelNames: Record<Role, string> = { SUPER_ADMIN: 'Administração', RESTAURANT_ADMIN: 'Painel da empresa', EMPLOYEE: 'Operação da loja', CUSTOMER: 'Minha conta' };
