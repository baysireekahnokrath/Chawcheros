import Link from 'next/link';
import { getBrands, getPillars, getModels, canApprove } from '@/modules/content/queries';
import IdeaForm from '@/components/content/IdeaForm';

export const metadata = { title: 'ไอเดียด่วน · Chaw Cher OS' };

// agent อ่านไอเดีย + เขียนทุกช่องทาง ใช้เวลาได้ถึง 90 วินาที
export const maxDuration = 300;

export default async function IdeaPage({ searchParams }: PageProps<'/content/idea'>) {
  const { text } = await searchParams;
  const [brands, pillars, models, approver] = await Promise.all([getBrands(), getPillars(), getModels(), canApprove()]);
  return (
    <>
      <Link href="/content" className="text-sm text-muted">← คอนเทนต์</Link>
      <h1 className="mt-3 text-xl font-semibold tracking-tight">ไอเดียด่วน</h1>
      <p className="mb-4 mt-1 text-sm text-muted">พิมพ์ประโยคเดียว agent จัดการที่เหลือ · ชิ้นนี้จะติดป้ายนอกแผน</p>
      <IdeaForm brands={brands} pillars={pillars} models={models} canReview={approver} initial={typeof text === 'string' ? text : ''} />
    </>
  );
}
