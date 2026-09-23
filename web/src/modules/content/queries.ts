import { createClient } from '@/lib/supabase/server';

export * from './types';
import type { Item, Placement, TodayItem, Gap } from './types';

export async function getItems(): Promise<Item[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .schema('content')
    .from('items')
    .select('id,title,format,stage,brief,campaign_id,script_url,raw_url,edit_url,thumbnail_url,due_on,approved_at,review_note,updated_at')
    .order('updated_at', { ascending: false });
  return (data ?? []) as Item[];
}

export async function getItem(id: string): Promise<Item | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .schema('content')
    .from('items')
    .select('id,title,format,stage,brief,campaign_id,script_url,raw_url,edit_url,thumbnail_url,due_on,approved_at,review_note,updated_at')
    .eq('id', id)
    .maybeSingle();
  return (data ?? null) as Item | null;
}

export async function getPlacements(itemId: string): Promise<Placement[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .schema('content')
    .from('placements')
    .select('id,item_id,channel_id,planned_on,published_at,published_url,channels(name_th)')
    .eq('item_id', itemId);
  return (data ?? []) as unknown as Placement[];
}

export async function getContentToday(): Promise<TodayItem[]> {
  const supabase = await createClient();
  const { data } = await supabase.schema('content').from('v_today').select('*');
  return (data ?? []) as TodayItem[];
}

export async function getGaps(): Promise<Gap[]> {
  const supabase = await createClient();
  const { data } = await supabase.schema('content').from('v_placement_gaps').select('*');
  return (data ?? []) as Gap[];
}

export async function getChannels() {
  const supabase = await createClient();
  const { data } = await supabase
    .schema('marketing')
    .from('channels')
    .select('id,name_th')
    .eq('status', 'ขายอยู่')
    .order('sort_order');
  return (data ?? []) as { id: string; name_th: string }[];
}

export async function getCampaigns() {
  const supabase = await createClient();
  const { data } = await supabase
    .schema('marketing')
    .from('campaigns')
    .select('id,name')
    .order('starts_on', { ascending: false });
  return (data ?? []) as { id: string; name: string }[];
}

/** ฉันอนุมัติคอนเทนต์ได้ไหม — ใช้ตัดสินว่าจะโชว์ปุ่มอนุมัติ */
export async function canApprove(): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .schema('core')
    .from('user_capabilities')
    .select('capability')
    .eq('capability', 'content.approve')
    .is('revoked_at', null)
    .maybeSingle();
  return !!data;
}
