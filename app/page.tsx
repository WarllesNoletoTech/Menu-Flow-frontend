'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { dashboardForRole, Role, saveSession } from '../lib/auth';

const profiles: Array<{ role: Role; title: string; description: string }> = [
  { role: 'SUPER_ADMIN', title: 'Entrar como Administrador', description: 'Administração da plataforma Menu Flow.' },
  { role: 'RESTAURANT_ADMIN', title: 'Entrar como Empresa', description: 'Gestão do seu restaurante e cardápio.' },
  { role: 'EMPLOYEE', title: 'Entrar como Funcionário', description: 'Operação e acompanhamento de pedidos.' },
];

export default function HomePage() {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const profile = profiles.find((item) => item.role === selectedRole);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim() || !password) { setError('Informe seu e-mail e senha para entrar.'); return; }
    setLoading(true); setError('');
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email.trim(), password }),
      });
      const body = await response.json().catch(() => null) as { accessToken?: string; user?: { id: string; name: string; role: Role; restaurantId?: string }; message?: string | string[] } | null;
      if (!response.ok || !body?.accessToken || !body.user || !(body.user.role in dashboardForRole)) {
        setError(response.status === 401 ? 'E-mail ou senha inválidos. Verifique seus dados e tente novamente.' : Array.isArray(body?.message) ? body.message[0] : body?.message ?? 'Não foi possível entrar. Tente novamente.');
        return;
      }
      saveSession({ accessToken: body.accessToken, user: body.user });
      router.replace(dashboardForRole[body.user.role]);
    } catch { setError('Não foi possível conectar ao servidor. Tente novamente em instantes.'); }
    finally { setLoading(false); }
  }

  return <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_right,_#dff5a7,_transparent_35%),linear-gradient(135deg,_#f7f8f5,_#eef1eb)] p-5"><section className="grid w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-soft lg:grid-cols-[.9fr_1.1fr]"><aside className="bg-ink p-8 text-white sm:p-12"><p className="text-sm font-black tracking-[0.24em] text-lime">MENU FLOW</p><h1 className="mt-6 text-4xl font-black leading-tight">Bem-vindo ao Menu Flow</h1><p className="mt-5 max-w-sm leading-7 text-stone-300">Escolha seu tipo de acesso para entrar com segurança e administrar o que importa.</p><div className="mt-10 hidden rounded-2xl border border-white/15 p-5 text-sm leading-6 text-stone-300 lg:block">O cardápio do seu restaurante continua público pelo link exclusivo da loja.</div></aside><div className="p-6 sm:p-10"><p className="text-sm font-bold text-stone-500">ACESSO SEGURO</p>{!selectedRole ? <><h2 className="mt-2 text-3xl font-black text-ink">Como deseja entrar?</h2><p className="mt-3 text-stone-600">Selecione o perfil associado à sua conta.</p><div className="mt-7 grid gap-3">{profiles.map((item) => <button key={item.role} type="button" onClick={() => { setSelectedRole(item.role); setError(''); }} className="rounded-2xl border border-stone-200 p-5 text-left transition hover:border-lime hover:bg-lime/10"><span className="block font-black text-ink">{item.title}</span><span className="mt-1 block text-sm text-stone-600">{item.description}</span></button>)}</div></> : <><button type="button" onClick={() => { setSelectedRole(null); setError(''); }} className="text-sm font-bold text-stone-600 hover:text-ink">← Escolher outro tipo de acesso</button><h2 className="mt-5 text-3xl font-black text-ink">{profile?.title}</h2><p className="mt-2 text-stone-600">Use as credenciais cadastradas para sua conta.</p><form className="mt-7" onSubmit={login}><label className="font-bold" htmlFor="email">E-mail</label><input className="field" id="email" name="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="voce@empresa.com" required /><label className="mt-5 block font-bold" htmlFor="password">Senha</label><input className="field" id="password" name="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />{error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700" role="alert">{error}</p>}<button disabled={loading} className="mt-6 w-full rounded-xl bg-ink py-4 font-black text-white transition hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-60" type="submit">{loading ? 'ENTRANDO…' : 'ENTRAR'}</button><p className="mt-4 text-center text-xs leading-5 text-stone-500">Seu perfil é confirmado pela sua conta. A opção escolhida não altera suas permissões.</p></form></>}</div></section></main>;
}
