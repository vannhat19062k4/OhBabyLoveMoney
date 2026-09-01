import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { PwaRegister } from './pwa-register';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'OhBabyLoveMoney — Quản lý tài chính cá nhân',
  description: 'Theo dõi dòng tiền, ngân sách, thẻ tín dụng và khoản vay một cách rõ ràng.',
  manifest: '/manifest.webmanifest',
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
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
