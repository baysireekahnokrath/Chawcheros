import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import {
  getBrands, getPillars, getThemes, getCampaigns, getModels, getTeam,
} from '@/modules/content/queries';
import NewItemForm from '@/components/content/NewItemForm';

export const metadata = { title: 'ตั้งงานคอนเทนต์ · Chaw Cher OS' };

export default async function NewContentPage() {
  const supabase = await createClient();
  const [{ data: { user } }, brands, pillars, themes, campaigns, models, team] = await Promise.all([
    supabase.auth.getUser(), getBrands(), getPillars(), getThemes(), getCampaigns(), getModels(), getTeam(),
  ]);

  return (
    <>
      <Link href="/content" className="text-sm text-muted">← คอนเทนต์</Link>
      <h1 className="mt-2 text-xl font-semibold tracking-tight">ตั้งงานคอนเทนต์</h1>
      <p className="mt-1 mb-5 text-sm text-muted">
        ข้อความล้วน · ภาพเดี่ยว · อัลบั้มภาพ — ชิ้นเดียวลง Facebook, Instagram และบล็อกได้พร้อมกัน
      </p>
      <NewItemForm brands={brands} pillars={pillars} themes={themes} campaigns={campaigns}
        models={models} team={team} me={user?.id ?? null} />
    </>
  );
}
