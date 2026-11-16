import Link from 'next/link';
import { getPriceList } from '@/modules/pricing/queries';
import NewProduct from '@/components/catalog/NewProduct';

export const metadata = { title: 'เพิ่มสินค้าใหม่ · Chaw Cher OS' };

/**
 * เพิ่ม "ขนาดใหม่" ของรุ่นที่มีอยู่ เข้าฐานข้อมูล · /catalog/new
 *
 * หน้านี้คู่กับ /catalog/import · อันนั้นรับทั้งไฟล์ราคาเป็นร้อยแถว
 * อันนี้รับทีละบรรทัดจากข้อความที่ลูกค้าสั่งมา ซึ่งเป็นทางที่ของใหม่
 * เข้าระบบจริงบ่อยกว่า — ลูกค้าขอขนาดพิเศษ แล้วมันไม่เคยถูกบันทึกไว้ที่ไหน
 */
export default async function NewProductPage() {
  const { rows, error } = await getPriceList();

  return (
    <>
      <Link href="/catalog" className="text-sm text-muted">← สินค้า</Link>
      <h1 className="mt-2 text-xl font-semibold tracking-tight">เพิ่มสินค้าใหม่</h1>
      <p className="mt-1 mb-5 text-sm text-muted">
        วางชื่อสินค้ากับขนาด → ระบบหารุ่นที่ใกล้ที่สุดให้ยืนยัน → เสนอราคาแนะนำ → กดเข้าฐานข้อมูล
      </p>

      {error && (
        <div className="mb-5 rounded-xl border border-danger/40 bg-danger/10 p-4 text-sm">
          <p className="font-semibold text-danger">อ่านราคาจากระบบไม่ได้</p>
          <pre className="mt-2 overflow-x-auto rounded-lg bg-bg p-2 text-xs">{error}</pre>
        </div>
      )}

      {!error && <NewProduct rows={rows} />}
    </>
  );
}
