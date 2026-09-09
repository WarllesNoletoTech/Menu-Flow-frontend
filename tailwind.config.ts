import type { Config } from 'tailwindcss';

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: 'var(--mf-primary)',
        lime: 'var(--mf-accent)',
        primary: 'var(--mf-primary)',
        'primary-hover': 'var(--mf-primary-hover)',
        accent: 'var(--mf-accent)',
        gold: 'var(--mf-gold)',
        sidebar: 'var(--mf-sidebar)',
        'sidebar-hover': 'var(--mf-sidebar-hover)',
        background: 'var(--mf-background)',
        surface: 'var(--mf-surface)',
        'text-primary': 'var(--mf-text-primary)',
        'text-secondary': 'var(--mf-text-secondary)',
        border: 'var(--mf-border)',
        success: 'var(--mf-success)',
        warning: 'var(--mf-warning)',
        danger: 'var(--mf-danger)',
      },
      boxShadow: { soft: '0 10px 30px rgb(41 37 36 / 0.08)' },
    },
  },
  plugins: [],
} satisfies Config;
