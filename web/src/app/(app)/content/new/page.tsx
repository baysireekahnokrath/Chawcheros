import Link from 'next/link';
import { getChannels, getCampaigns } from '@/modules/content/queries';
import NewItemForm from '@/components/content/NewItemForm';

export const metadata = { title: 'ตั้งงานคอนเทนต์ · Chaw Cher OS' };

export default async function NewContentPage() {
  const [channels, campaigns] = await Promise.all([getChannels(), getCampaigns()]);

  return (
    <>
      <Link href="/content" className="text-sm text-muted">← คอนเทนต์</Link>
      <h1 className="mt-2 text-xl font-semibold tracking-tight">ตั้งงานคอนเทนต์</h1>
      <p className="mt-1 mb-5 text-sm text-muted">
        เลือกได้หลายช่องทาง — คลิปตัวเดียวลง TikTok, Reel, Shorts พร้อมกันได้
      </p>
      <NewItemForm channels={channels} campaigns={campaigns} />
    </>
  );
}
