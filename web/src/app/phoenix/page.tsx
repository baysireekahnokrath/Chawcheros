import type { Metadata } from 'next';
import PhoenixGate from '@/components/phoenix/PhoenixGate';

/**
 * หน้าจัดชุดฟีนิกซ์ · /phoenix
 *
 * อยู่นอกกลุ่ม (app) เพราะไม่ต้องล็อกอิน — ไม่มีหัวเมนูที่ต้องมี session
 * middleware ปล่อยเส้นทางนี้ผ่าน · ข้อมูลกันด้วย PIN ที่ฐานข้อมูล (migration 0047)
 */

export const metadata: Metadata = {
  title: 'จัดชุดฟีนิกซ์ · ฌ เฌอ',
  description: 'เลือกโมดูลฟีนิกซ์ ได้ราคาและแบบแปลนทันที',
};

export default function PhoenixPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <PhoenixGate />
    </main>
  );
}
