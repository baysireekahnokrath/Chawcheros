import type { Metadata } from 'next';
import { Noto_Sans_Thai } from 'next/font/google';
import './globals.css';
import AuthHashCatcher from '@/components/AuthHashCatcher';

const thai = Noto_Sans_Thai({
  variable: '--font-thai',
  subsets: ['thai', 'latin'],
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'Chaw Cher OS',
  description: 'ระบบภายในของ ฌ เฌอ',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="th" className={`${thai.variable} h-full antialiased`}>
      <body className="min-h-full">
        {/* ลิงก์กู้รหัสผ่านที่ไปลงผิดหน้า ให้พามาที่ /reset · ดูเหตุผลในไฟล์นั้น */}
        <AuthHashCatcher />
        {children}
      </body>
    </html>
  );
}
