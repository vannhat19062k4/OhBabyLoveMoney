import type { Metadata } from 'next';
import './globals.css';
import { PwaRegister } from './pwa-register';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://ohbabylovemoney.vercel.app'),
  title: 'OhBabyLoveMoney — Quản lý tài chính cá nhân',
  description: 'Theo dõi dòng tiền, ngân sách, thẻ tín dụng và khoản vay một cách rõ ràng.',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [{ url: '/icon-192.png', sizes: '192x192', type: 'image/png' }],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'LoveMoney' },
  openGraph: {
    title: 'OhBabyLoveMoney',
    description: 'Quản lý tiền rõ ràng, sống nhẹ nhàng hơn.',
    images: [{ url: '/og.png', width: 1536, height: 1024, alt: 'OhBabyLoveMoney' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'OhBabyLoveMoney',
    description: 'Quản lý tiền rõ ràng, sống nhẹ nhàng hơn.',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body className="antialiased">
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
