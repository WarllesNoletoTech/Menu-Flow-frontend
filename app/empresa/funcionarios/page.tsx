'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useEmpresa } from '../../../components/empresa/EmpresaContext';
import type { Employee } from '../../../components/empresa/types';

type Form = { name: string; email: string; phone: string; password: string; confirmPassword: string; active: boolean };
const blank: Form = { name: '', email: '', phone: '', password: '', confirmPassword: '', active: true };

export default function Page() {
  const { request } = useEmpresa();
  const [items, setItems] = useState<Employee[]>([]);
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState<string>();
  const [message, setMessage] = useState('');
  const load = useCallback(() => request<Employee[]>('/restaurants/me/users').then(setItems).catch((error) => setMessage(error.message)), [request]);
  useEffect(() => { void load(); }, [load]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (form.password !== form.confirmPassword) { setMessage('As senhas não coincidem.'); return; }
    try {
      const body = editing
        ? { name: form.name, email: form.email, phone: form.phone, active: form.active, ...(form.password ? { password: form.password } : {}) }
        : { name: form.name, email: form.email, phone: form.phone, password: form.password };
      await request(`/restaurants/me/users${editing ? `/${editing}` : ''}`, { method: editing ? 'PATCH' : 'POST', body: JSON.stringify(body) });
      setForm(blank); setEditing(undefined); setMessage('Funcionário salvo com sucesso.'); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível salvar.'); }
  }

  function edit(item: Employee) { setEditing(item.id); setForm({ name: item.name, email: item.email, phone: item.phone || '', password: '', confirmPassword: '', active: item.active }); }
  async function remove(item: Employee) {
    if (!window.confirm(`Excluir ${item.name}? O histórico será preservado.`)) return;
    try { await request(`/restaurants/me/users/${item.id}`, { method: 'DELETE' }); setMessage('Funcionário excluído com sucesso.'); if (editing === item.id) { setEditing(undefined); setForm(blank); } await load(); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível excluir.'); }
  }

  return <section className="mx-auto max-w-6xl"><h2 className="text-2xl font-black">Funcionários</h2><p className="mt-1 text-stone-500">Funcionários são opcionais. Gerencie somente a equipe vinculada ao seu estabelecimento.</p><form onSubmit={save} className="mt-6 rounded-2xl bg-white p-5 shadow-sm"><h3 className="font-black">{editing ? 'Editar funcionário' : 'ADICIONAR FUNCIONÁRIO'}</h3><div className="mt-3 grid gap-3 sm:grid-cols-2">{([['name', 'Nome', 'text'], ['email', 'E-mail', 'email'], ['phone', 'Telefone', 'tel'], ['password', editing ? 'Nova senha (opcional)' : 'Senha', 'password'], ['confirmPassword', editing ? 'Confirmar nova senha' : 'Confirmar senha', 'password']] as const).map(([key, label, type]) => <label key={key} className="font-bold">{label}<input required={key !== 'phone' && (!editing || (key !== 'password' && key !== 'confirmPassword'))} minLength={key === 'password' || key === 'confirmPassword' ? 8 : undefined} type={type} className="field" value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })}/></label>)}{editing && <label className="font-bold">Status<select className="field" value={String(form.active)} onChange={(event) => setForm({ ...form, active: event.target.value === 'true' })}><option value="true">Ativo</option><option value="false">Bloqueado</option></select></label>}</div><div className="mt-4 flex gap-2"><button className="rounded-xl bg-ink px-5 py-3 font-bold text-white">Salvar</button>{editing && <button type="button" onClick={() => { setEditing(undefined); setForm(blank); }} className="rounded-xl border px-5 font-bold">Cancelar</button>}</div></form>{message && <p aria-live="polite" className="mt-4 rounded-xl bg-white p-3">{message}</p>}<div className="mt-5 overflow-hidden rounded-2xl bg-white shadow-sm">{items.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 border-b p-4 last:border-0"><div><strong>{item.name}</strong><p className="text-sm text-stone-500">{item.email}{item.phone && ` · ${item.phone}`}</p></div><div className="flex items-center gap-4"><span className={`rounded-full px-3 py-1 text-xs font-bold ${item.active ? 'bg-lime' : 'bg-stone-200'}`}>{item.active ? 'Ativo' : 'Bloqueado'}</span><button type="button" onClick={() => edit(item)} className="font-bold underline">Editar</button><button type="button" onClick={() => void remove(item)} className="font-bold text-red-700 underline">Excluir</button></div></div>)}{!items.length && <p className="p-8 text-center text-stone-500">Nenhum funcionário cadastrado.</p>}</div></section>;
}
