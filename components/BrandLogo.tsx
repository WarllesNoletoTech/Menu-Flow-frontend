import Image from 'next/image';

type BrandLogoProps = {
  variant?: 'full' | 'wordmark' | 'symbol';
  className?: string;
  priority?: boolean;
};

const assets = {
  full: {
    src: '/assets/branding/menu-flow-logo.png',
    width: 1024,
    height: 1024,
    alt: 'Menu Flow',
  },
  wordmark: {
    src: '/assets/branding/menu-flow-wordmark.png',
    width: 1400,
    height: 438,
    alt: 'Menu Flow',
  },
  symbol: {
    src: '/assets/branding/menu-flow-symbol.png',
    width: 512,
    height: 512,
    alt: 'Menu Flow',
  },
} as const;

export function BrandLogo({ variant = 'full', className = '', priority = false }: BrandLogoProps) {
  const asset = assets[variant];

  return (
    <span
      data-priority={priority || undefined}
      className={`inline-block max-w-full overflow-hidden bg-transparent align-middle ${className}`}
    >
      <Image
        src={asset.src}
        width={asset.width}
        height={asset.height}
        alt={asset.alt}
        priority={priority}
        sizes={variant === 'full' ? '(max-width: 640px) 70vw, 260px' : variant === 'wordmark' ? '220px' : '64px'}
        className="block h-auto w-full object-contain"
      />
    </span>
  );
}
