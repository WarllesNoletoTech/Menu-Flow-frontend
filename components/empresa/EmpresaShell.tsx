'use client';

import { ReactNode, useCallback, useEffect, useState } from 'react';
import { EmpresaProvider, useEmpresa } from './EmpresaContext';
import { DashboardShell } from '../dashboard/DashboardShell';
import { useOrderSocket } from '../../lib/order-socket';

export function EmpresaShell({ children }: { children: ReactNode }) {
  return <EmpresaProvider><CompanyDashboard>{children}</CompanyDashboard></EmpresaProvider>;
}

function CompanyDashboard({ children }: { children: ReactNode }) {
  const { establishment, loadingCompany, companyError, refreshCompany, request } = useEmpresa();
  const [pending, setPending] = useState(0);
  const [unreadBillingReports, setUnreadBillingReports] = useState(0);

  const loadPending = useCallback(
    () => establishment
      ? request<{ counts: { pending: number } }>(`/restaurants/${establishment._id}/orders?group=pending&page=1&limit=1`)
          .then((result) => setPending(result.counts.pending))
          .catch(() => undefined)
      : Promise.resolve(),
    [establishment, request],
  );

  const loadUnreadBillingReports = useCallback(
    () => establishment
      ? request<{ count: number }>('/billing/me/reports/unread-count', { cache: 'no-store' })
          .then((result) => setUnreadBillingReports(result.count))
          .catch(() => undefined)
      : Promise.resolve(),
    [establishment, request],
  );

  useEffect(() => {
    void loadPending();
    void loadUnreadBillingReports();
  }, [loadPending, loadUnreadBillingReports]);

  useEffect(() => {
    const refreshOrders = () => { void loadPending(); };
    const refreshBilling = () => { void loadUnreadBillingReports(); };
    const refreshAll = () => {
      void loadPending();
      void loadUnreadBillingReports();
    };
    window.addEventListener('menu-flow:orders-updated', refreshOrders);
    window.addEventListener('menu-flow:billing-reports-viewed', refreshBilling);
    window.addEventListener('focus', refreshAll);
    const interval = window.setInterval(refreshBilling, 60_000);
    return () => {
      window.removeEventListener('menu-flow:orders-updated', refreshOrders);
      window.removeEventListener('menu-flow:billing-reports-viewed', refreshBilling);
      window.removeEventListener('focus', refreshAll);
      window.clearInterval(interval);
    };
  }, [loadPending, loadUnreadBillingReports]);

  useOrderSocket(useCallback(() => { void loadPending(); }, [loadPending]));

  const extra = establishment?.slug ? [{ icon: '↗', label: 'Ver loja', href: `/${establishment.slug}` }] : [];

  return (
    <DashboardShell
      role="RESTAURANT_ADMIN"
      establishment={establishment}
      extraItems={extra}
      pendingOrders={pending}
      unreadBillingReports={unreadBillingReports}
    >
      {loadingCompany ? (
        <div className="h-32 animate-pulse rounded-2xl bg-stone-200" />
      ) : companyError ? (
        <section role="alert" className="mx-auto max-w-2xl rounded-2xl bg-surface p-8 text-center shadow-sm">
          <h2 className="text-xl font-black">Não foi possível carregar os dados do estabelecimento.</h2>
          <p className="mt-2 text-stone-600">{companyError}</p>
          <button type="button" onClick={() => void refreshCompany().catch(() => undefined)} className="mt-5 rounded-xl bg-ink px-5 py-3 font-bold text-white">Tentar novamente</button>
        </section>
      ) : children}
    </DashboardShell>
  );
}
