import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  // CTO Dokunuşu: Next.js'in "metadataBase is not set" uyarısını kalıcı olarak susturan satır.
  // Uygulamayı canlıya aldığımızda buradaki URL'yi gerçek domain ile değiştirebiliriz.
  metadataBase: new URL('https://longosphere.com'),

  title: 'Longosphere Sayım',
  description: 'Longosphere Dijital Depo ve Stok Sayım Sistemi',
  manifest: '/manifest.json',

  // CTO Dokunuşu: iOS (iPhone) cihazlarda Safari çubuklarını gizler, tam ekran uygulama hissi verir
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'LongoSayım',
  },
  openGraph: {
    images: [
      {
        url: 'https://bolt.new/static/og_default.png',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    images: [
      {
        url: 'https://bolt.new/static/og_default.png',
      },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr">
      <body className={inter.className}>{children}</body>
    </html>
  );
}