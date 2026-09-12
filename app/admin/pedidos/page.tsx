'use client';

import { OrdersList } from '../../../components/dashboard/OrdersList';

export default function Page() {
  return (
    <section className="mx-auto max-w-7xl space-y-6">
      <header className="mf-panel rounded-[32px] px-5 py-6 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <span className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-[11px] font-black uppercase tracking-[.18em] text-primary">Operação da plataforma</span>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-stone-900 sm:text-[2.35rem]">Pedidos</h1>
          <p className="mt-2 text-sm leading-6 text-stone-500 sm:text-base">Acompanhe os pedidos dos estabelecimentos ativos, filtre por cidade e consulte o andamento da operação em um único lugar.</p>
        </div>
      </header>

      <div className="rounded-[30px] border border-border/90 bg-white p-4 shadow-[0_14px_36px_rgba(41,37,36,.05)] sm:p-5">
        <OrdersList admin />
      </div>
    </section>
  );
}
