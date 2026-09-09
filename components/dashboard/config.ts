import type { Role } from '../../lib/auth';
export type DashboardItem = { label: string; href: string; icon: string; external?: boolean };
export const dashboardMenus: Record<Role, DashboardItem[]> = {
  SUPER_ADMIN: [
    { icon: '▣', label: 'Visão geral', href: '/admin' }, { icon: '▦', label: 'Estabelecimentos', href: '/admin/restaurantes' }, { icon: '♙', label: 'Usuários', href: '/admin/usuarios' }, { icon: 'R$', label: 'Cobranças', href: '/admin/cobrancas' }, { icon: '♙', label: 'Minha conta', href: '/admin/conta' }, { icon: '↗', label: 'Portal público', href: '/' },
  ],
  RESTAURANT_ADMIN: [{icon:'▣',label:'Visão geral',href:'/empresa'},{icon:'▤',label:'Pedidos',href:'/empresa/pedidos'},{icon:'☷',label:'Cardápio',href:'/empresa/cardapio'},{icon:'♙',label:'Funcionários',href:'/empresa/funcionarios'},{icon:'R$',label:'Faturamento',href:'/empresa/faturamento'},{icon:'⌂',label:'Dados da empresa',href:'/empresa/dados'},{icon:'⚙',label:'Configurações',href:'/empresa/configuracoes'},{icon:'♙',label:'Minha conta',href:'/empresa/conta'}],
  EMPLOYEE: [
    { icon: '▣', label: 'Visão geral', href: '/funcionario' }, { icon: '▤', label: 'Pedidos', href: '/funcionario/pedidos' }, { icon: '♙', label: 'Minha conta', href: '/funcionario/conta' },
  ],
  CUSTOMER: [
    { icon: '▣', label: 'Visão geral', href: '/cliente' }, { icon: '▤', label: 'Meus pedidos', href: '/cliente/pedidos' }, { icon: '⌂', label: 'Meus endereços', href: '/cliente/enderecos' }, { icon: '♙', label: 'Minha conta', href: '/cliente/conta' }, { icon: '↗', label: 'Explorar lojas', href: '/' },
  ],
};
export const panelNames: Record<Role, string> = { SUPER_ADMIN: 'Administração', RESTAURANT_ADMIN: 'Painel da empresa', EMPLOYEE: 'Operação da loja', CUSTOMER: 'Minha conta' };
