/**
 * FAQ สาธารณะ · อ่านจากฐานข้อมูลด้วย key สาธารณะ (anon) ผ่านฟังก์ชัน line_agent.faq_public() ตัวเดียว (0048)
 * ฟังก์ชันคืนเฉพาะข้อที่ Bay ยืนยัน + ติ๊กสาธารณะ และเฉพาะข้อความที่เขียนให้ลูกค้าอ่าน
 * ใช้ร่วมกันระหว่างหน้า /faq และ /api/faq (chawcher.com ดึงจากตัวหลัง · ข้อ 2 ก)
 */
import { createClient } from '@supabase/supabase-js';

export type FaqItem = { id: string; category: string; q: string; a: string; updated_at: string | null };
export type Faq = { updated_at: string | null; items: FaqItem[] };

export async function getFaq(): Promise<Faq> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('ยังไม่ได้ตั้งค่า Supabase');
  const sb = createClient(url, key, { db: { schema: 'line_agent' }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await sb.rpc('faq_public');
  if (error) throw new Error(error.message);
  const f = data as Faq | null;
  return { updated_at: f?.updated_at ?? null, items: f?.items ?? [] };
}

/** ข้อมูลโครงสร้างให้ Google (FAQPage) · chawcher.com วางในหน้าเว็บได้เลย */
export function faqJsonLd(items: FaqItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((i) => ({
      '@type': 'Question', name: i.q, acceptedAnswer: { '@type': 'Answer', text: i.a },
    })),
  };
}

/** จัดกลุ่มตามหมวด · คงลำดับที่ฐานข้อมูลเรียงมา */
export function byCategory(items: FaqItem[]) {
  const m = new Map<string, FaqItem[]>();
  for (const i of items) m.set(i.category, [...(m.get(i.category) ?? []), i]);
  return [...m.entries()];
}
