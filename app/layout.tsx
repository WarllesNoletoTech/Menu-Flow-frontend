import type { Metadata, Viewport } from 'next';
import { AuthProvider } from '../components/AuthProvider';
import { PwaInstallPrompt } from '../components/pwa/PwaInstallPrompt';
import { PwaRegister } from '../components/pwa/PwaRegister';
import './globals.css';

export const metadata: Metadata = {
  title: 'Menu Flow',
  description: 'Estabelecimentos e produtos da sua cidade',
  applicationName: 'Menu Flow',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/favicon.ico', type: 'image/x-icon' },
      { url: '/assets/branding/menu-flow-symbol.png', type: 'image/png' }
    ],
    apple: '/assets/branding/menu-flow-icon-192.png'
  },
  appleWebApp: {
    capable: true,
    title: 'Menu Flow',
    statusBarStyle: 'default'
  }
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#221C1A'
};

export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>
        <AuthProvider>{children}</AuthProvider>
        <PwaRegister />
        <PwaInstallPrompt />
      </body>
    </html>
  );
}
