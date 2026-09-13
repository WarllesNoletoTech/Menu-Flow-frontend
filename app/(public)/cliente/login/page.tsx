'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../../components/AuthProvider';
import { safeReturnTo } from '../../../../lib/auth';
import { apiUrl } from '../../../../lib/api';
import { PasswordField } from '../../../../components/auth/PasswordField';
import { BrandLogo } from '../../../../components/BrandLogo';

function customerReturnTo(value: string | null) {
  const destination = safeReturnTo(value);
  // Evita loop de /cliente/login -> /cliente/login, inclusive quando uma versão
  // antiga do layout protegido gravou a própria tela de login como returnTo.
  if (destination === '/cliente/login' || destination.startsWith('/cliente/login?')) return '/';
  return destination;
}

export default function CustomerLoginPage() {
  const router = useRouter();
  const { loginCustomer: login } = useAuth();
  const [register, setRegister] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setLoading(true);
    setError('');
    const endpoint = register ? '/auth/customer/register' : '/auth/login';
    const payload = Object.fromEntries(form);

    try {
      const response = await fetch(apiUrl(endpoint), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => null) as {
        accessToken?: string;
        user?: { id: string; name: string; email: string; phone?: string; role: 'CUSTOMER' };
        message?: string | string[];
      } | null;

      const message = Array.isArray(data?.message) ? data?.message[0] : data?.message;
      if (!response.ok) throw new Error(message ?? 'Não foi possível continuar.');
      if (!data?.accessToken || data.user?.role !== 'CUSTOMER') {
        throw new Error('Esta conta não é uma conta de cliente.');
      }

      login({ accessToken: data.accessToken, user: data.user });
      const requestedReturn = new URLSearchParams(window.location.search).get('returnTo');
      router.replace(requestedReturn ? customerReturnTo(requestedReturn) : '/cliente');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Erro inesperado.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-background p-5">
      <form onSubmit={submit} className="w-full max-w-md rounded-3xl border border-border bg-surface p-7 shadow-soft">
        <BrandLogo priority className="mx-auto w-[clamp(11rem,58vw,15rem)] rounded-2xl shadow-soft" />
        <h1 className="mt-3 text-3xl font-black">{register ? 'Crie sua conta' : 'Minha conta'}</h1>
        <p className="mt-2 text-sm text-stone-500">A conta de cliente é independente do login do lojista neste aparelho.</p>
        {register && (
          <>
            <input className="field" required name="name" placeholder="Seu nome" />
            <input className="field" required name="phone" placeholder="Telefone" />
          </>
        )}
        <input className="field" required name="email" type="email" autoComplete="email" placeholder="E-mail" />
        <PasswordField required name="password" autoComplete={register ? 'new-password' : 'current-password'} minLength={8} placeholder="Senha (mínimo 8 caracteres)" />
        {error && <p className="mt-4 text-sm font-bold text-danger" role="alert">{error}</p>}
        <button disabled={loading} className="mt-6 w-full rounded-xl bg-ink py-4 font-black text-white disabled:opacity-50">
          {loading ? 'AGUARDE…' : register ? 'CRIAR CONTA' : 'ENTRAR'}
        </button>
        <button type="button" onClick={() => { setRegister(!register); setError(''); }} className="mt-4 w-full text-sm font-bold underline">
          {register ? 'Já tenho uma conta' : 'Ainda não tenho uma conta'}
        </button>
        <button type="button" onClick={() => router.replace('/')} className="mt-4 w-full text-sm font-bold text-stone-500">
          Voltar para o início
        </button>
      </form>
    </main>
  );
}
