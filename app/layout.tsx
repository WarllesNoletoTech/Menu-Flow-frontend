import type { Metadata } from 'next'; import './globals.css';
export const metadata: Metadata = { title: 'Menu Flow', description: 'Cardápio digital', manifest: '/manifest.webmanifest', appleWebApp: { capable: true, statusBarStyle: 'default' } };
export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="pt-BR"><body>{children}</body></html>; }
