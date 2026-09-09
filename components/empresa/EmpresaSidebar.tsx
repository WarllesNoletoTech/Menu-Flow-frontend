'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '../AuthProvider';
import { useEmpresa } from './EmpresaContext';
import { BrandLogo } from '../BrandLogo';

const links = [
  ['▦', 'Visão geral', '/empresa'], ['▤', 'Pedidos', '/empresa/pedidos'], ['▧', 'Cardápio / Produtos', '/empresa/cardapio'],
  ['▦', 'Categorias', '/empresa/categorias'], ['♙', 'Funcionários', '/empresa/funcionarios'], ['R$', 'Faturamento', '/empresa/faturamento'], ['▣', 'Dados da empresa', '/empresa/dados'], ['⚙', 'Configurações', '/empresa/configuracoes'],
  ['♙', 'Minha conta', '/empresa/conta'],
] as const;
export function EmpresaSidebar({ open, close }: { open: boolean; close: () => void }) {
  const pathname = usePathname(); const router = useRouter(); const { logout } = useAuth(); const { establishment } = useEmpresa();
  useEffect(() => { const key = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); }; document.addEventListener('keydown', key); return () => document.removeEventListener('keydown', key); }, [close]);
  const active = (href: string) => href === '/empresa' ? pathname === href : pathname.startsWith(href);
  return <><button aria-label="Fechar menu" className={`fixed inset-0 z-40 bg-black/50 lg:hidden ${open ? 'block' : 'hidden'}`} onClick={close}/><aside aria-label="Navegação da empresa" className={`fixed inset-y-0 left-0 z-50 flex w-[270px] max-w-[85vw] flex-col overflow-y-auto bg-sidebar px-4 py-5 text-white shadow-2xl transition-transform lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
    <div className="px-3"><Link href="/empresa" onClick={close} aria-label="Menu Flow — início do painel"><BrandLogo priority className="w-44 rounded-xl" /></Link><p className="mt-5 truncate text-sm font-bold text-stone-300">{establishment?.tradeName || establishment?.name || 'Meu estabelecimento'}</p></div>
    <nav className="mt-6 flex-1 space-y-1 border-t border-white/10 pt-5">{links.map(([icon,label,href]) => <Link key={href} href={href} onClick={close} aria-current={active(href) ? 'page' : undefined} className={`relative flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold transition ${active(href) ? 'bg-sidebar-hover text-white before:absolute before:inset-y-2 before:left-0 before:w-1 before:rounded-full before:bg-accent' : 'text-stone-200 hover:bg-sidebar-hover hover:text-white'}`}><span aria-hidden className="w-5 text-center">{icon}</span>{label}</Link>)}
      {establishment?.slug && <Link href={`/${establishment.slug}`} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold text-stone-200 hover:bg-sidebar-hover"><span className="w-5 text-center" aria-hidden>↗</span>Ver loja pública</Link>}
    </nav><button onClick={() => { logout(); router.replace('/'); }} className="flex items-center gap-3 border-t border-white/10 px-3 pt-5 text-sm font-bold text-stone-200 hover:text-lime"><span aria-hidden>⇥</span>Sair</button>
  </aside></>;
}
