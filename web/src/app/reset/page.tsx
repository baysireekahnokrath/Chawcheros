import type { Metadata } from 'next';
import ResetForm from '@/components/ResetForm';

/**
 * ตั้งรหัสผ่านใหม่ · /reset
 *
 * อยู่นอกกลุ่ม (app) เพราะคนที่มาถึงหน้านี้ยังไม่ได้ล็อกอิน
 * middleware ปล่อยเส้นทางนี้ผ่าน · ของจริงกันที่ลิงก์ในอีเมลซึ่ง Supabase ออกให้
 */

export const metadata: Metadata = {
  title: 'ตั้งรหัสผ่านใหม่ · Chaw Cher OS',
};

export default function ResetPage() {
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">ตั้งรหัสผ่านใหม่</h1>
          <p className="mt-1 text-sm text-muted">Chaw Cher OS</p>
        </div>
        <ResetForm />
      </div>
    </main>
  );
}
