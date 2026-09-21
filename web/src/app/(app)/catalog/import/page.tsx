import Link from 'next/link';
import { getBatches, getCatalogCounts } from '@/modules/catalog/queries';
import ImportForm from '@/components/catalog/ImportForm';

export const metadata = { title: 'อัปโหลดไฟล์ราคา · Chaw Cher OS' };

export default async function ImportPage() {
  const [batches, counts] = await Promise.all([getBatches(), getCatalogCounts()]);

  return (
    <>
      <Link href="/catalog" className="text-sm text-muted">← สินค้า</Link>
      <h1 className="mt-2 text-xl font-semibold tracking-tight">อัปโหลดไฟล์ราคา</h1>
      <p className="mt-1 mb-5 text-sm text-muted">
        ไฟล์เข้าที่พักข้อมูลก่อน แล้วค่อยตรวจทีละรุ่น
      </p>

      <ImportForm batches={batches} pendingRows={counts.รอตรวจ} />
    </>
  );
}
