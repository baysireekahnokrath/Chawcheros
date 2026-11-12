import { getPriceList } from '@/modules/pricing/queries';
import PriceList from '@/components/pricing/PriceList';

export const metadata = { title: 'ใบราคา · Chaw Cher OS' };

export default async function PricePage() {
  const { rows, error } = await getPriceList();

  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight">ใบราคา</h1>
      <p className="mt-1 mb-5 text-sm text-muted">
        ราคาดึงสดจากระบบทุกครั้งที่เปิดหน้านี้ · ไม่มีไฟล์เก่าให้หยิบผิด ·
        สั่งพิมพ์จากเบราว์เซอร์ได้ถ้าต้องส่งเป็นไฟล์
      </p>

      {error && (
        <div className="mb-5 rounded-xl border border-danger/40 bg-danger/10 p-4 text-sm">
          <p className="font-semibold text-danger">อ่านราคาจากระบบไม่ได้</p>
          <p className="mt-1 text-muted">
            ไม่ใช่ว่าไม่มีสินค้า แต่คำขอไปไม่ถึงข้อมูล · ข้อความจากระบบ:
          </p>
          <pre className="mt-2 overflow-x-auto rounded-lg bg-bg p-2 text-xs">{error}</pre>
        </div>
      )}

      {!error && rows.length === 0 && (
        <div className="mb-5 rounded-xl border border-warn/40 bg-warn/10 p-4 text-sm">
          <p className="font-semibold text-warn">ระบบตอบกลับปกติ แต่ไม่มีสินค้าสักตัว</p>
          <p className="mt-1 text-muted">
            แปลว่าสิทธิ์อ่านผ่านแล้ว แต่ยังไม่มีรุ่นที่สถานะ &quot;ขายอยู่&quot; ในระบบ
          </p>
        </div>
      )}

      <PriceList rows={rows} />
    </>
  );
}
