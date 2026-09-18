import type { Metadata } from 'next';
import { PrivateDashboard } from '../../components/dashboard/PrivateDashboard';

export const metadata: Metadata = {
  title: 'Menu Flow Garçom',
  applicationName: 'Menu Flow Garçom',
  manifest: '/manifest-garcom.webmanifest',
  appleWebApp: { capable: true, title: 'MF Garçom', statusBarStyle: 'default' },
};

export default function EmployeeLayout({children}:{children:React.ReactNode}){return <PrivateDashboard role="EMPLOYEE">{children}</PrivateDashboard>}
