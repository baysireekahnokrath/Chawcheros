import Link from 'next/link';
import { getLocations, getVariantsForReceiving } from '@/modules/stock/queries';
import ReceiveForm from '@/components/stock/ReceiveForm';

export const metadata = { title: 'รับของเข้า · Chaw Cher OS' };

export default async function ReceivePage() {
  const [variants, locations] = await Promise.all([
    getVariantsForReceiving(),
    getLocations(),
  ]);

  return (
    <>
      <div className="print:hidden">
        <Link href="/stock" className="text-sm text-muted">← คลัง</Link>
        <h1 className="mt-2 text-xl font-semibold tracking-tight">รับของเข้า</h1>
        <p className="mt-1 mb-5 text-sm text-muted">
          ระบบออกรหัสให้ทุกตัว แล้วพิมพ์สติกเกอร์ QR ไปติดของจริง
        </p>
      </div>
      <ReceiveForm variants={variants} locations={locations} />
    </>
  );
}
