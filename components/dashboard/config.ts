import type { Role } from '../../lib/auth';
export type DashboardItem = {
  label: string;
  href: string;
  icon: string;
  external?: boolean;
  /** Position (and optional contextual label) in the account menu shown outside dashboards. */
  userMenu?: { order: number; label?: string };
};
export const dashboardMenus: Record<Role, DashboardItem[]> = {
  SUPER_ADMIN: [
    { icon: '▣', label: 'Visão geral', href: '/admin', userMenu: { order: 1, label: 'Painel administrativo' } }, { icon: '▦', label: 'Estabelecimentos', href: '/admin/restaurantes', userMenu: { order: 2 } }, { icon: '♙', label: 'Usuários', href: '/admin/usuarios', userMenu: { order: 3 } }, { icon: '⚙', label: 'Tipos de estabelecimento', href: '/admin/tipos-estabelecimento', userMenu: { order: 4 } }, { icon: 'R$', label: 'Cobranças', href: '/admin/cobrancas', userMenu: { order: 4 } }, { icon: '♙', label: 'Minha conta', href: '/admin/conta', userMenu: { order: 0 } }, { icon: '↗', label: 'Portal público', href: '/' },
  ],
  RESTAURANT_ADMIN: [{icon:'▣',label:'Visão geral',href:'/empresa',userMenu:{order:1,label:'Painel da loja'}},{icon:'▤',label:'Pedidos',href:'/empresa/pedidos',userMenu:{order:2}},{icon:'☷',label:'Cardápio',href:'/empresa/cardapio',userMenu:{order:3}},{icon:'◷',label:'Horários de funcionamento',href:'/empresa/horarios'},{icon:'♙',label:'Funcionários',href:'/empresa/funcionarios',userMenu:{order:4}},{icon:'R$',label:'Faturamento',href:'/empresa/faturamento'},{icon:'⌂',label:'Dados da empresa',href:'/empresa/dados'},{icon:'⚙',label:'Configurações',href:'/empresa/configuracoes',userMenu:{order:5}},{icon:'♙',label:'Minha conta',href:'/empresa/conta',userMenu:{order:0}}],
  EMPLOYEE: [
    { icon: '▣', label: 'Visão geral', href: '/funcionario', userMenu: { order: 1, label: 'Painel do funcionário' } }, { icon: '▤', label: 'Pedidos', href: '/funcionario/pedidos', userMenu: { order: 2 } }, { icon: '♙', label: 'Minha conta', href: '/funcionario/conta', userMenu: { order: 0 } },
  ],
  CUSTOMER: [
    { icon: '▣', label: 'Visão geral', href: '/cliente' }, { icon: '▤', label: 'Meus pedidos', href: '/cliente/pedidos', userMenu: { order: 1 } }, { icon: '⌂', label: 'Meus endereços', href: '/cliente/enderecos', userMenu: { order: 2 } }, { icon: '♙', label: 'Minha conta', href: '/cliente/conta', userMenu: { order: 0 } }, { icon: '↗', label: 'Explorar lojas', href: '/' },
  ],
};
export const userMenuItems = (role: Role) => dashboardMenus[role]
  .filter((item) => item.userMenu)
  .sort((left, right) => left.userMenu!.order - right.userMenu!.order)
  .map((item) => ({ label: item.userMenu!.label ?? item.label, href: item.href }));
export const panelNames: Record<Role, string> = { SUPER_ADMIN: 'Administração', RESTAURANT_ADMIN: 'Painel da empresa', EMPLOYEE: 'Operação da loja', CUSTOMER: 'Minha conta' };
