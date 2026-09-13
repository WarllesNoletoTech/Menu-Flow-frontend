'use client';
import { ReactNode, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { Role } from '../../lib/auth';
import { dashboardForRole } from '../../lib/auth';
import { useAuth } from '../AuthProvider';

export function RoleGuard({ allowedRole, children }: { allowedRole: Role; children: ReactNode }) {
  const auth = useAuth();
  const customerScope = allowedRole === 'CUSTOMER';
  const user = customerScope ? auth.customerUser : auth.user;
  const loading = customerScope ? auth.customerLoading : auth.loading;
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      const loginPath = customerScope ? '/cliente/login' : '/login';
      router.replace(`${loginPath}?returnTo=${encodeURIComponent(pathname)}`);
      return;
    }
    if (user.role !== allowedRole) {
      // Uma sessão de cliente e uma sessão operacional podem coexistir. Em caso
      // de inconsistência, redirecionamos apenas dentro do mesmo escopo.
      if (customerScope) router.replace('/cliente/login');
      else router.replace(user.role === 'CUSTOMER' ? '/login' : dashboardForRole[user.role]);
    }
  }, [allowedRole, customerScope, loading, pathname, router, user]);

  if (loading || !user || user.role !== allowedRole) {
    return <div className="min-h-screen bg-background p-6" aria-label="Carregando painel"><div className="h-20 animate-pulse rounded-2xl bg-stone-200" /></div>;
  }
  return <>{children}</>;
}
