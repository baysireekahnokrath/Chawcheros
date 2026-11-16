import { createClient } from '@/lib/supabase/server';

export type TodayItem = { หมวด: string; เรื่อง: string; อีกกี่วัน: number | null; ref_id: string };

export type CampaignSummary = {
  id: string;
  name: string;
  ช่องทาง: string | null;
  status: string;
  starts_on: string;
  ends_on: string | null;
  งบที่ตั้ง: number | null;
  ใช้จริง: number;
  คงเหลือ: number | null;
  จำนวนโปร: number;
  จำนวนคอนเทนต์: number;
};

export type Channel = { id: string; name_th: string };

/** งานที่ต้องลงมือวันนี้ (เอกสารหัวข้อ 4) */
export async function getToday(): Promise<TodayItem[]> {
  const supabase = await createClient();
  const { data } = await supabase.schema('marketing').from('v_today').select('*');
  return (data ?? []) as TodayItem[];
}

export async function getCampaigns(): Promise<CampaignSummary[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .schema('marketing')
    .from('v_campaign_summary')
    .select('*')
    .order('starts_on', { ascending: false });
  return (data ?? []) as CampaignSummary[];
}

export async function getChannels(): Promise<Channel[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .schema('marketing')
    .from('channels')
    .select('id,name_th')
    .eq('status', 'ขายอยู่')
    .order('sort_order');
  return (data ?? []) as Channel[];
}

/** หมวดสินค้าที่อนุมัติแล้ว — ใช้เป็นเป้าของส่วนลด */
export async function getDiscountTargets() {
  const supabase = await createClient();
  const [{ data: cats }, { data: prods }] = await Promise.all([
    supabase.schema('catalog').from('categories').select('id,name').eq('status', 'ขายอยู่').order('name'),
    supabase.schema('catalog').from('products').select('id,collection').eq('status', 'ขายอยู่').order('collection'),
  ]);
  return {
    categories: (cats ?? []) as { id: string; name: string }[],
    products: (prods ?? []) as { id: string; collection: string }[],
  };
}

export type PromoRow = {
  id: string; name: string; kind: string; percent: number | null; min_total: number | null;
  detail: string | null; link_url: string | null; scope: string; starts_on: string; ends_on: string | null;
};

/** โปรที่กำลังใช้หรือจะเริ่ม (ยังไม่หมดเขต) · ไว้ดูและกดจบ */
export async function getLivePromotions(): Promise<PromoRow[]> {
  const supabase = await createClient();
  const today = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
  const { data } = await supabase.schema('marketing').from('promotions')
    .select('id,name,kind,percent,min_total,detail,link_url,scope,starts_on,ends_on')
    .eq('status', 'กำลังใช้')
    .or(`ends_on.is.null,ends_on.gte.${today}`)
    .order('starts_on');
  return (data ?? []) as PromoRow[];
}
