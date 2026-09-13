import type { Metadata } from 'next';
import { EmpresaShell } from '../../components/empresa/EmpresaShell';

export const metadata: Metadata = {
  title: 'Menu Flow Lojista',
  applicationName: 'Menu Flow Lojista',
  manifest: '/manifest-lojista.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'MF Lojista',
    statusBarStyle: 'default',
  },
};

export default function EmpresaLayout({ children }: { children: React.ReactNode }) {
  return <EmpresaShell>{children}</EmpresaShell>;
}
