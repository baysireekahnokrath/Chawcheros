import Link from 'next/link';
import { getBrands, getPillars, getThemes } from '@/modules/content/queries';
import ContentSettings from '@/components/content/ContentSettings';

export const metadata = { title: 'ตั้งค่าคอนเทนต์ · Chaw Cher OS' };

export default async function ContentSettingsPage() {
  const [brands, pillars, themes] = await Promise.all([getBrands(), getPillars(), getThemes()]);
  return (
    <>
      <Link href="/content" className="text-sm text-muted">← คอนเทนต์</Link>
      <h1 className="mt-2 text-xl font-semibold tracking-tight">ตั้งค่าคอนเทนต์</h1>
      <p className="mt-1 mb-5 text-sm text-muted">
        Pillar และธีมของแต่ละแบรนด์ · เลิกใช้แล้วยังอยู่ในงานเก่า ไม่หายไป
      </p>
      <ContentSettings brands={brands} pillars={pillars} themes={themes} />
    </>
  );
}
