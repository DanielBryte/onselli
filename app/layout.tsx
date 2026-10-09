import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://onselli.com'),
  title: {
    default: 'Onselli | Build a business around what you know',
    template: '%s | Onselli',
  },
  description:
    'Create courses, digital products, and a premium creator storefront with Onselli — the platform for turning expertise into a real business.',
  keywords: [
    'Onselli',
    'creator platform',
    'knowledge business',
    'online courses',
    'digital products',
    'creator storefront',
    'sell expertise',
  ],
  manifest: '/site.webmanifest',
  openGraph: {
    title: 'Onselli',
    description:
      'Turn your knowledge into a premium digital offer — courses, workshops, digital products, and a storefront built to grow.',
    url: 'https://onselli.com',
    siteName: 'Onselli',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Onselli',
    description:
      'Create, sell, and grow your knowledge business with a polished home for course creators and experts.',
  },
  icons: {
    icon: [{ url: '/favicon.ico', sizes: 'any' }],
    apple: [{ url: '/apple-icon.png', sizes: '180x180', type: 'image/png' }],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><head><link rel="preconnect" href="https://fonts.googleapis.com"/><link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous"/><link href="https://fonts.googleapis.com/css2?family=Urbanist:wght@400;500;600;700;800&display=swap" rel="stylesheet"/></head><body>{children}</body></html>;
}
