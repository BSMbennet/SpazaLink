import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { CartProvider } from '@/components/cart-provider';
import { SiteHeader } from '@/components/site-header';

export const metadata: Metadata = {
  title: 'SpazaLink | Your neighbourhood marketplace',
  description: 'Find local spaza shops, kota sellers, home cooks and neighbourhood traders in South Africa.',
  applicationName: 'SpazaLink',
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = { themeColor: '#155e45', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <html lang="en"><body><CartProvider><SiteHeader />{children}</CartProvider></body></html>;
}
