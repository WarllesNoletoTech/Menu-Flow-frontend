'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type BusinessDay = { dayOfWeek: number; isOpen: boolean; periods: Array<{ openTime: string; closeTime: string }> };
type Response = { configured?: boolean; timezone?: string; days?: BusinessDay[] };

const names = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
const emptyDay = (dayOfWeek: number): BusinessDay => ({ dayOfWeek, isOpen: false, periods: [] });

export function normalizeBusinessDays(receivedDays?: BusinessDay[]): BusinessDay[] {
  const savedByDay = new Map(
    (Array.isArray(receivedDays) ? receivedDays : [])
      .filter((day) => Number.isInteger(day?.dayOfWeek) && day.dayOfWeek >= 0 && day.dayOfWeek <= 6)
      .map((day) => [day.dayOfWeek, day]),
  );
  return names.map((_, dayOfWeek) => savedByDay.get(dayOfWeek) ?? emptyDay(dayOfWeek));
}

export function BusinessHoursEditor({ request, endpoint }: { request: <T>(path: string, init?: RequestInit) => Promise<T>; endpoint: string }) {
  const [days, setDays] = useState<BusinessDay[]>([]);
  const [timezone, setTimezone] = useState('America/Sao_Paulo');
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const requestNumber = useRef(0);

  const applyResponse = useCallback((result: Response) => {
    const normalized = normalizeBusinessDays(result.days);
    setDays(normalized);
    // Persisted days are authoritative even if an older API omitted or misreported configured.
    setConfigured(normalized.some((day) => day.isOpen || day.periods.length > 0) || Boolean(result.configured));
    if (result.timezone) setTimezone(result.timezone);
  }, []);

  const load = useCallback(async () => {
    const currentRequest = ++requestNumber.current;
    setLoading(true);
    setLoadError('');
    try {
      const result = await request<Response>(endpoint, { cache: 'no-store' });
      if (currentRequest !== requestNumber.current) return;
      applyResponse(result);
      setMessage('');
    } catch {
      if (currentRequest !== requestNumber.current) return;
      setDays([]);
      setLoadError('Não foi possível carregar os horários de funcionamento.');
    } finally {
      if (currentRequest === requestNumber.current) setLoading(false);
    }
  }, [applyResponse, endpoint, request]);

  useEffect(() => {
    void load();
    return () => { requestNumber.current += 1; };
  }, [load]);

  const change = (index: number, value: BusinessDay) => setDays((items) => items.map((item, itemIndex) => itemIndex === index ? value : item));

  async function save() {
    if (busy || loading || loadError) return;
    setBusy(true);
    setMessage('');
    try {
      const saved = await request<Response>(endpoint, { method: 'PATCH', cache: 'no-store', body: JSON.stringify({ days }) });
      applyResponse(saved);
      // Confirm the persisted representation instead of trusting React state or only the PATCH response.
      const confirmed = await request<Response>(endpoint, { cache: 'no-store' });
      applyResponse(confirmed);
      setMessage('Horários de funcionamento atualizados com sucesso.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível atualizar os horários.');
    } finally {
      setBusy(false);
    }
  }

  return <section className="mx-auto max-w-5xl">
    <header><h1 className="text-3xl font-black text-ink">Horários de funcionamento</h1><p className="mt-1 text-stone-500">Configure quando sua loja abre. Horários após meia-noite são aceitos.</p><p className="mt-1 text-xs font-bold text-stone-400">Fuso horário: {timezone}</p></header>
    {loading && <p role="status" className="mt-6 rounded-xl bg-surface p-5 font-semibold">Carregando horários...</p>}
    {!loading && loadError && <div role="alert" className="mt-6 rounded-xl border border-danger bg-surface p-5"><p className="font-semibold text-danger">{loadError}</p><button type="button" className="mt-3 min-h-11 rounded-xl bg-ink px-4 font-bold text-white" onClick={() => void load()}>Tentar novamente</button></div>}
    {!loading && !loadError && <>
      {!configured && <p className="mt-5 rounded-xl bg-amber-50 p-4 font-semibold text-amber-900">Horários ainda não configurados.</p>}
      <div className="mt-6 grid gap-4">{days.map((day, index) => <article key={day.dayOfWeek} className="rounded-2xl border border-border bg-surface p-4 shadow-sm sm:p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-black">{names[day.dayOfWeek]}</h2><label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-full bg-background px-4 font-bold"><input type="checkbox" checked={day.isOpen} onChange={(event) => change(index, { ...day, isOpen: event.target.checked, periods: event.target.checked ? (day.periods.length ? day.periods : [{ openTime: '08:00', closeTime: '18:00' }]) : [] })}/>{day.isOpen ? 'Aberto' : 'Fechado'}</label></div>{day.isOpen ? <div className="mt-4 space-y-3">{day.periods.map((period, periodIndex) => <div key={periodIndex} className="grid items-end gap-2 sm:grid-cols-[1fr_auto_1fr_44px]"><label className="text-sm font-bold">Abertura<input aria-label={`Abertura de ${names[day.dayOfWeek]}`} type="time" className="field" value={period.openTime} onChange={(event) => change(index, { ...day, periods: day.periods.map((item, itemIndex) => itemIndex === periodIndex ? { ...item, openTime: event.target.value } : item) })}/></label><span className="hidden pb-3 text-stone-400 sm:block">até</span><label className="text-sm font-bold">Fechamento<input aria-label={`Fechamento de ${names[day.dayOfWeek]}`} type="time" className="field" value={period.closeTime} onChange={(event) => change(index, { ...day, periods: day.periods.map((item, itemIndex) => itemIndex === periodIndex ? { ...item, closeTime: event.target.value } : item) })}/></label><button type="button" disabled={day.periods.length === 1} aria-label="Remover período" className="min-h-11 rounded-xl text-danger disabled:opacity-30" onClick={() => change(index, { ...day, periods: day.periods.filter((_, itemIndex) => itemIndex !== periodIndex) })}>✕</button></div>)}<button type="button" className="min-h-11 font-bold text-accent underline" onClick={() => change(index, { ...day, periods: [...day.periods, { openTime: '08:00', closeTime: '18:00' }] })}>+ Adicionar período</button></div> : <p className="mt-4 text-sm font-black text-stone-400">FECHADO</p>}</article>)}</div>
    </>}
    {message && <p role="status" className="mt-5 rounded-xl bg-surface p-4 font-semibold">{message}</p>}
    <button type="button" disabled={busy || loading || Boolean(loadError)} onClick={() => void save()} className="mt-6 w-full rounded-xl bg-ink px-6 py-3 font-black text-white disabled:opacity-60 sm:w-auto">{busy ? 'Salvando...' : 'Salvar horários'}</button>
  </section>;
}
