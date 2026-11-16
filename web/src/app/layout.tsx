import type { Metadata } from 'next';
import { Montserrat, Noto_Sans_Thai } from 'next/font/google';
import './globals.css';

const thai = Noto_Sans_Thai({
  variable: '--font-thai',
  subsets: ['thai', 'latin'],
  weight: ['400', '500', '600', '700'],
});

/** ตัวเลขและภาษาอังกฤษ · Gotham ตาม CI ใช้ Montserrat แทนบนเว็บ (docs/brand/README.md) */
const num = Montserrat({
  variable: '--font-num',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
});

export const metadata: Metadata = {
  title: 'CHAW CHER OS',
  description: 'ระบบภายในของ ฌ เฌอ',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="th" className={`${thai.variable} ${num.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
