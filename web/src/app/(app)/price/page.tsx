import { getPriceList } from '@/modules/pricing/queries';
import PriceList from '@/components/pricing/PriceList';

export const metadata = { title: 'ใบราคา · Chaw Cher OS' };

export default async function PricePage() {
  const rows = await getPriceList();

  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight">ใบราคา</h1>
      <p className="mt-1 mb-5 text-sm text-muted">
        ราคาดึงสดจากระบบทุกครั้งที่เปิดหน้านี้ · ไม่มีไฟล์เก่าให้หยิบผิด ·
        สั่งพิมพ์จากเบราว์เซอร์ได้ถ้าต้องส่งเป็นไฟล์
      </p>

      <PriceList rows={rows} />
    </>
  );
}
