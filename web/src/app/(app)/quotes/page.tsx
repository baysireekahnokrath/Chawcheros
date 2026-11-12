import { getPriceList } from '@/modules/pricing/queries';
import QuoteBuilder from '@/components/quote/QuoteBuilder';

export const metadata = { title: 'ใบเสนอราคา · Chaw Cher OS' };

/**
 * ออกใบเสนอราคาจากข้อความลูกค้า · /quotes
 *
 * ★ ใช้ชื่อ /quotes ให้ตรงกับ home_path ของโมดูล quotes ที่ลงทะเบียนไว้แล้วใน 0039
 *   เมนูหน้าแรกจึงชี้มาที่หน้านี้ได้เลย ไม่ต้องรัน SQL เพิ่ม
 *
 * อยู่ในกลุ่ม (app) · ต้องล็อกอิน เพราะหน้านี้เห็นใบราคาทั้งเล่ม
 * ไม่ใช่แค่รุ่นเดียวแบบหน้า /phoenix
 */
export default async function QuotePage() {
  const { rows, error } = await getPriceList();

  return (
    <>
      <h1 className="no-print text-xl font-semibold tracking-tight">ใบเสนอราคา</h1>
      <p className="no-print mt-1 mb-5 text-sm text-muted">
        วางข้อความที่ลูกค้าส่งมา → ตรวจที่ระบบจับคู่ให้ → พิมพ์ ·
        ราคาดึงสดจากใบราคาทุกครั้ง ไม่มีไฟล์เก่าให้หยิบผิด
      </p>

      {error && (
        <div className="no-print mb-5 rounded-xl border border-danger/40 bg-danger/10 p-4 text-sm">
          <p className="font-semibold text-danger">อ่านราคาจากระบบไม่ได้</p>
          <pre className="mt-2 overflow-x-auto rounded-lg bg-bg p-2 text-xs">{error}</pre>
        </div>
      )}

      {!error && <QuoteBuilder rows={rows} />}
    </>
  );
}
