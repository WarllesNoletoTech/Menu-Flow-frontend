'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useEmpresa } from '../../../components/empresa/EmpresaContext';
import type { Employee } from '../../../components/empresa/types';

type Position = 'WAITER'|'KITCHEN'|'BAR'|'CASHIER'|'MANAGER'|'OTHER';
type Form = { name: string; email: string; phone: string; password: string; confirmPassword: string; active: boolean; employeePosition: Position; permissions: string[] };
const TABLE_PERMISSIONS = [
  ['TABLES_VIEW','Visualizar mesas'],
  ['TABLES_OPEN','Abrir mesa'],
  ['TABLES_ORDER','Adicionar pedidos'],
  ['TABLES_KITCHEN','Operar cozinha / marcar pronto'],
  ['TABLES_DELIVER','Entregar pedido na mesa'],
  ['TABLES_CANCEL','Cancelar pedido de mesa'],
  ['TABLES_TRANSFER','Transferir/juntar mesas e trocar garçom'],
  ['TABLES_REQUEST_BILL','Solicitar conta'],
  ['TABLES_PAYMENT','Registrar pagamentos'],
  ['TABLES_PRINT','Imprimir pedidos e contas'],
  ['TABLES_DISCOUNT','Aplicar desconto'],
  ['TABLES_CLOSE','Fechar mesa'],
] as const;
const PRESETS: Record<Position,string[]> = {
  WAITER: ['TABLES_VIEW','TABLES_OPEN','TABLES_ORDER','TABLES_DELIVER','TABLES_TRANSFER','TABLES_REQUEST_BILL'],
  KITCHEN: ['TABLES_VIEW','TABLES_KITCHEN','TABLES_PRINT'],
  BAR: ['TABLES_VIEW','TABLES_KITCHEN','TABLES_PRINT'],
  CASHIER: ['TABLES_VIEW','TABLES_PAYMENT','TABLES_PRINT','TABLES_DISCOUNT','TABLES_CLOSE'],
  MANAGER: TABLE_PERMISSIONS.map(([value])=>value),
  OTHER: [],
};
const POSITION_LABEL: Record<Position,string> = { WAITER:'Garçom', KITCHEN:'Cozinha', BAR:'Bar', CASHIER:'Caixa', MANAGER:'Gerente', OTHER:'Outro' };
const blank: Form = { name: '', email: '', phone: '', password: '', confirmPassword: '', active: true, employeePosition: 'OTHER', permissions: [] };

export default function Page() {
  const { request, settings } = useEmpresa();
  const [items, setItems] = useState<Employee[]>([]);
  const [form, setForm] = useState<Form>(blank);
  const [editing, setEditing] = useState<string>();
  const [message, setMessage] = useState('');
  const load = useCallback(() => request<Employee[]>('/restaurants/me/users').then(setItems).catch((error) => setMessage(error.message)), [request]);
  useEffect(() => { void load(); }, [load]);

  function choosePosition(position: Position) { setForm({ ...form, employeePosition: position, permissions: PRESETS[position] }); }
  function togglePermission(permission: string) { setForm({ ...form, permissions: form.permissions.includes(permission) ? form.permissions.filter((item)=>item!==permission) : [...form.permissions,permission] }); }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (form.password !== form.confirmPassword) { setMessage('As senhas não coincidem.'); return; }
    try {
      const body = editing
        ? { name: form.name, email: form.email, phone: form.phone, active: form.active, employeePosition: form.employeePosition, permissions: form.permissions, ...(form.password ? { password: form.password } : {}) }
        : { name: form.name, email: form.email, phone: form.phone, password: form.password, employeePosition: form.employeePosition, permissions: form.permissions };
      await request(`/restaurants/me/users${editing ? `/${editing}` : ''}`, { method: editing ? 'PATCH' : 'POST', body: JSON.stringify(body) });
      setForm(blank); setEditing(undefined); setMessage('Funcionário salvo com sucesso.'); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível salvar.'); }
  }

  function edit(item: Employee) { setEditing(item.id); setForm({ name: item.name, email: item.email, phone: item.phone || '', password: '', confirmPassword: '', active: item.active, employeePosition: item.employeePosition ?? 'OTHER', permissions: item.permissions ?? [] }); }
  async function remove(item: Employee) {
    if (!window.confirm(`Excluir ${item.name}? O histórico será preservado.`)) return;
    try { await request(`/restaurants/me/users/${item.id}`, { method: 'DELETE' }); setMessage('Funcionário excluído com sucesso.'); if (editing === item.id) { setEditing(undefined); setForm(blank); } await load(); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível excluir.'); }
  }

  return <section className="mx-auto max-w-6xl"><h2 className="text-2xl font-black">Funcionários</h2><p className="mt-1 text-stone-500">Cadastre a equipe e defina exatamente o que cada funcionário pode fazer.</p>
    {settings?.tableServiceEnabled&&<div className="mt-5 rounded-2xl border bg-lime/10 p-4"><strong>Controle de mesas ativo.</strong><p className="mt-1 text-sm text-stone-600">Use a função Garçom, Cozinha, Bar, Caixa ou Gerente para preencher permissões rapidamente. Você pode ajustar cada permissão manualmente.</p></div>}
    <form onSubmit={save} className="mt-6 rounded-2xl bg-surface p-5 shadow-sm"><h3 className="font-black">{editing ? 'Editar funcionário' : 'ADICIONAR FUNCIONÁRIO'}</h3><div className="mt-3 grid gap-3 sm:grid-cols-2">{([['name', 'Nome', 'text'], ['email', 'E-mail', 'email'], ['phone', 'Telefone', 'tel'], ['password', editing ? 'Nova senha (opcional)' : 'Senha', 'password'], ['confirmPassword', editing ? 'Confirmar nova senha' : 'Confirmar senha', 'password']] as const).map(([key, label, type]) => <label key={key} className="font-bold">{label}<input required={key !== 'phone' && (!editing || (key !== 'password' && key !== 'confirmPassword'))} minLength={key === 'password' || key === 'confirmPassword' ? 8 : undefined} type={type} className="field" value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })}/></label>)}<label className="font-bold">Função<select className="field" value={form.employeePosition} onChange={(event)=>choosePosition(event.target.value as Position)}>{Object.entries(POSITION_LABEL).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>{editing && <label className="font-bold">Status<select className="field" value={String(form.active)} onChange={(event) => setForm({ ...form, active: event.target.value === 'true' })}><option value="true">Ativo</option><option value="false">Bloqueado</option></select></label>}</div>
      {settings?.tableServiceEnabled&&<fieldset className="mt-5 rounded-2xl border p-4"><legend className="px-2 font-black">Permissões do salão</legend><div className="mt-2 grid gap-2 sm:grid-cols-2">{TABLE_PERMISSIONS.map(([value,label])=><label key={value} className="flex items-center gap-3 rounded-xl bg-background p-3 text-sm font-bold"><input type="checkbox" checked={form.permissions.includes(value)} onChange={()=>togglePermission(value)}/>{label}</label>)}</div></fieldset>}
      <div className="mt-4 flex gap-2"><button className="rounded-xl bg-ink px-5 py-3 font-bold text-white">Salvar</button>{editing && <button type="button" onClick={() => { setEditing(undefined); setForm(blank); }} className="rounded-xl border px-5 font-bold">Cancelar</button>}</div></form>
    {message && <p aria-live="polite" className="mt-4 rounded-xl bg-surface p-3">{message}</p>}
    <div className="mt-5 overflow-hidden rounded-2xl bg-surface shadow-sm">{items.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 border-b p-4 last:border-0"><div><strong>{item.name}</strong><p className="text-sm text-stone-500">{item.email}{item.phone && ` · ${item.phone}`}</p><div className="mt-2 flex flex-wrap gap-2"><span className="rounded-full bg-background px-2 py-1 text-[11px] font-black">{POSITION_LABEL[item.employeePosition??'OTHER']}</span>{(item.permissions??[]).includes('TABLES_VIEW')&&<span className="rounded-full bg-lime/20 px-2 py-1 text-[11px] font-black">Acesso ao salão</span>}</div></div><div className="flex items-center gap-4"><span className={`rounded-full px-3 py-1 text-xs font-bold ${item.active ? 'bg-success/15 text-success' : 'bg-stone-200'}`}>{item.active ? 'Ativo' : 'Bloqueado'}</span><button type="button" onClick={() => edit(item)} className="font-bold underline">Editar</button><button type="button" onClick={() => void remove(item)} className="font-bold text-danger underline">Excluir</button></div></div>)}{!items.length && <p className="p-8 text-center text-stone-500">Nenhum funcionário cadastrado.</p>}</div>
  </section>;
}
