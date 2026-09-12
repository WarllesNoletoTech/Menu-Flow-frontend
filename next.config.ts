import type { NextConfig } from 'next';

const configuredHosts = (process.env.IMAGE_HOSTS ?? '')
  .split(',')
  .map((host) => host.trim())
  .filter(Boolean);

const config: NextConfig = {
  images: {
    // Production deployments must explicitly allow the upload/CDN hosts. Existing
    // URL fields remain readable while operators migrate assets to those hosts.
    remotePatterns: configuredHosts.map((hostname) => ({ protocol: 'https' as const, hostname })),
    // Compatibility mode avoids breaking legacy URLs while no trusted CDN has
    // been configured; the Next.js optimizer never fetches those arbitrary hosts.
    unoptimized: configuredHosts.length === 0,
  },
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' }
        ]
      },
      {
        source: '/manifest.webmanifest',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
          { key: 'Content-Type', value: 'application/manifest+json; charset=utf-8' }
        ]
      }
    ];
  }
};

export default config;
