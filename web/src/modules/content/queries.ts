import { createClient } from '@/lib/supabase/server';

export * from './types';
import type {
  Item, Placement, TodayItem, Gap, ItemImage, Brand, Pillar, Theme, Model, Person,
  ReviewNote, Message, Version, OpenPart,
} from './types';

const ITEM_COLS =
  'id,title,format,stage,brief,campaign_id,script_url,raw_url,edit_url,thumbnail_url,due_on,approved_at,review_note,updated_at,' +
  'brand_id,hook,key_message,visual,pillar_id,theme_id,owner_id,off_plan,source_url,created_by,version';

export async function getItems(): Promise<Item[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .schema('content')
    .from('items')
    .select(ITEM_COLS)
    .order('updated_at', { ascending: false });
  return (data ?? []) as unknown as Item[];
}

export async function getItem(id: string): Promise<Item | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .schema('content')
    .from('items')
    .select(ITEM_COLS)
    .eq('id', id)
    .maybeSingle();
  return (data ?? null) as unknown as Item | null;
}

export async function getPlacements(itemId: string): Promise<Placement[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .schema('content')
    .from('placements')
    .select('id,item_id,channel_id,planned_on,published_at,published_url,hook,copy_text,first_comment,web_title,web_keyword,web_meta,human_edited,skipped_reason,passed_at,channels(name_th)')
    .eq('item_id', itemId);
  return (data ?? []) as unknown as Placement[];
}

/** ภาพของชิ้นงาน เรียงตามลำดับ · ภาพแรก = key visual */
export async function getImages(itemId: string): Promise<ItemImage[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .schema('content')
    .from('item_images')
    .select('id,position,url,passed_at')
    .eq('item_id', itemId)
    .is('removed_at', null)
    .order('position')
    .order('created_at');
  return (data ?? []) as ItemImage[];
}

/** key visual ของหลายชิ้นในครั้งเดียว · ใช้บนรายการงาน */
export async function getKeyVisuals(itemIds: string[]): Promise<Record<string, string>> {
  if (itemIds.length === 0) return {};
  const supabase = await createClient();
  const { data } = await supabase
    .schema('content')
    .from('item_images')
    .select('item_id,url,position,created_at')
    .in('item_id', itemIds)
    .is('removed_at', null)
    .order('position')
    .order('created_at');
  const out: Record<string, string> = {};
  for (const r of (data ?? []) as { item_id: string; url: string }[]) out[r.item_id] ??= r.url;
  return out;
}

export async function getItemModels(itemId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .schema('content')
    .from('item_models')
    .select('product_id')
    .eq('item_id', itemId);
  return ((data ?? []) as { product_id: string }[]).map((r) => r.product_id);
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

/** แบรนด์ที่ยังใช้อยู่ · ตั้งงานคอนเทนต์ต้องเลือกแบรนด์ก่อน (Q-110) */
export async function getBrands(): Promise<Brand[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .schema('catalog')
    .from('brands')
    .select('id,name')
    .neq('status', 'เลิกขาย')
    .order('name');
  return (data ?? []) as Brand[];
}

export async function getPillars(): Promise<Pillar[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .schema('content')
    .from('pillars')
    .select('id,brand_id,name,color,sort_order,active')
    .order('sort_order')
    .order('name');
  return (data ?? []) as Pillar[];
}

export async function getThemes(): Promise<Theme[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .schema('content')
    .from('themes')
    .select('id,brand_id,name,goal,starts_on,ends_on,active')
    .order('starts_on', { ascending: false });
  return (data ?? []) as Theme[];
}

/** รุ่นสินค้า (Collection) · คอนเทนต์ผูกระดับรุ่น ไม่ใช่ SKU */
export async function getModels(): Promise<Model[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .schema('catalog')
    .from('products')
    .select('id,brand_id,collection,name_th')
    .neq('status', 'เลิกขาย')
    .order('collection');
  return (data ?? []) as Model[];
}

/** คนในทีมที่ยังทำงานอยู่ · ใช้เลือกคนทำ */
export async function getTeam(): Promise<Person[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .schema('core')
    .from('app_users')
    .select('id,full_name')
    .eq('status', 'ใช้งาน')
    .order('full_name');
  return (data ?? []) as Person[];
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

// ── ตรวจ · แชท · เวอร์ชัน (R2) ─────────────────────────────────────────────

export async function getReviewNotes(itemId: string): Promise<ReviewNote[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .schema('content')
    .from('review_notes')
    .select('id,version,part_key,part_label,note,done_at,created_at')
    .eq('item_id', itemId)
    .order('version', { ascending: false })
    .order('created_at');
  return (data ?? []) as ReviewNote[];
}

export async function getMessages(itemId: string): Promise<Message[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .schema('content')
    .from('messages')
    .select('id,author_id,kind,part_label,body,mentions,created_at')
    .eq('item_id', itemId)
    .order('created_at');
  return (data ?? []) as Message[];
}

export async function getVersions(itemId: string): Promise<Version[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .schema('content')
    .from('item_versions')
    .select('version,submitted_at,snapshot')
    .eq('item_id', itemId)
    .order('version', { ascending: false });
  return (data ?? []) as Version[];
}

/** ส่วนที่ยังไม่ผ่าน · ฐานข้อมูลคิดให้ จะได้ตรงกับที่ฟังก์ชันตรวจบังคับ */
export async function getOpenParts(itemId: string): Promise<OpenPart[]> {
  const supabase = await createClient();
  const { data } = await supabase.schema('content').rpc('open_parts', { p_item_id: itemId });
  return (data ?? []) as OpenPart[];
}

/** ข้อความใหม่ของฉันต่องาน · แจ้งด้วยตัวเลขเท่านั้น (Y2) */
export async function getUnread(): Promise<Record<string, { unread: number; mentions: number }>> {
  const supabase = await createClient();
  const { data } = await supabase.schema('content').from('v_my_unread').select('item_id,unread,mentions');
  const out: Record<string, { unread: number; mentions: number }> = {};
  for (const r of (data ?? []) as { item_id: string; unread: number; mentions: number }[]) {
    out[r.item_id] = { unread: Number(r.unread), mentions: Number(r.mentions) };
  }
  return out;
}

/** เปิดงานแล้ว = อ่านแชทแล้ว */
export async function markRead(itemId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .schema('content')
    .from('message_reads')
    .upsert({ user_id: user.id, item_id: itemId, last_read_at: new Date().toISOString() });
}
