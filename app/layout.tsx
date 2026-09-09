import type { Metadata } from 'next'; import { AuthProvider } from '../components/AuthProvider'; import './globals.css';
export const metadata: Metadata = { title: 'Menu Flow', description: 'Estabelecimentos e produtos da sua cidade', manifest: '/manifest.webmanifest', appleWebApp: { capable: true, statusBarStyle: 'default' } };
export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="pt-BR"><body><AuthProvider>{children}</AuthProvider></body></html>; }
