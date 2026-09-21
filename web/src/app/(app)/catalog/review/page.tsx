import Link from 'next/link';
import { getImportGroups } from '@/modules/catalog/queries';
import ReviewList from '@/components/catalog/ReviewList';

export const metadata = { title: 'ตรวจสินค้า · Chaw Cher OS' };

export default async function ReviewPage() {
  const groups = await getImportGroups();

  return (
    <>
      <Link href="/catalog" className="text-sm text-muted">← สินค้า</Link>
      <h1 className="mt-2 text-xl font-semibold tracking-tight">ตรวจและอนุมัติสินค้า</h1>
      <p className="mt-1 mb-5 text-sm text-muted">
        1 การ์ด = 1 รุ่น · ตอบ 3 ข้อ: ยังขายไหม · รุ่นเดียวกันจริงไหม · สเปกถูกไหม
      </p>

      <ReviewList groups={groups} />
    </>
  );
}
