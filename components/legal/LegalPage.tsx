import type { ReactNode } from 'react';
import Link from 'next/link';
import { BrandLogo } from '../BrandLogo';

const legalLinks = [
  { href: '/politica-de-privacidade', label: 'Política de Privacidade' },
  { href: '/termos-de-uso', label: 'Termos de Uso' },
  { href: '/exclusao-de-dados', label: 'Exclusão de Dados' }
] as const;

export const LEGAL_CONTACT_EMAIL = 'menuflow09@gmail.com';

export function ContactEmail() {
  return (
    <a className="font-semibold text-primary underline underline-offset-4 hover:text-primary-hover" href={`mailto:${LEGAL_CONTACT_EMAIL}`}>
      {LEGAL_CONTACT_EMAIL}
    </a>
  );
}

export function LegalPage({
  title,
  summary,
  children
}: {
  title: string;
  summary: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-background text-stone-800">
      <header className="border-b border-border bg-surface/95">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6">
          <Link href="/" aria-label="Voltar ao início do Menu Flow" className="flex items-center gap-3">
            <BrandLogo variant="wordmark" className="w-40 sm:w-48" />
          </Link>
          <Link href="/" className="rounded-xl border border-border bg-white px-4 py-2 text-sm font-bold text-primary hover:border-primary/40 hover:bg-primary/5">
            Voltar ao Menu Flow
          </Link>
        </div>
      </header>

      <div className="mx-auto w-full max-w-5xl px-4 pb-16 pt-8 sm:px-6 sm:pt-12">
        <div className="rounded-[28px] border border-border bg-white p-6 shadow-soft sm:p-10">
          <p className="text-xs font-black uppercase tracking-[.2em] text-accent">Transparência e proteção de dados</p>
          <h1 className="mt-3 text-3xl font-black leading-tight tracking-tight text-stone-900 sm:text-4xl">{title}</h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-stone-600">{summary}</p>
          <p className="mt-3 text-xs text-stone-500">Última atualização: <time dateTime="2026-11-08">8 de novembro de 2026</time>.</p>
          <div className="my-7 h-px bg-border" />
          <article className="space-y-8 text-[15px] leading-7 text-stone-700 sm:text-base">
            {children}
          </article>
        </div>
      </div>

      <footer className="border-t border-border bg-surface px-4 py-8 text-center text-sm text-stone-600">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-4">
          <p><strong className="text-primary">MENU FLOW</strong> · Informações legais e contato</p>
          <nav aria-label="Documentos legais" className="flex flex-wrap items-center justify-center gap-x-5 gap-y-3">
            {legalLinks.map((link) => (
              <Link key={link.href} href={link.href} className="font-semibold underline-offset-4 hover:text-primary hover:underline">
                {link.label}
              </Link>
            ))}
          </nav>
          <p>Contato: <ContactEmail /></p>
        </div>
      </footer>
    </main>
  );
}
