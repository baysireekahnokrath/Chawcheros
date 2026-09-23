import { createClient } from '@/lib/supabase/server';

export * from './types';
import type {
  Item, Placement, TodayItem, Gap, ItemImage, Brand, Pillar, Theme, Model, Person,
  ReviewNote, Message, Version, OpenPart,
  CalItem, CalPlacement,
  Plan, PlanSlot, PlanChange, ThemeWeek, BrandKit, BrandExample, AgentRoute,
  AgentQuestion, AiBudget, AiRequest, BrandSection, NotebookEntry, Playbook, InterviewTurn,
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
  // ชื่อช่องทางดึงแยก · embed ข้าม schema (content → marketing) ถูก PostgREST ปฏิเสธหลังเพิ่ม ai_request_id (R3)
  const [{ data, error }, { data: chans }] = await Promise.all([
    supabase
      .schema('content')
      .from('placements')
      .select('id,item_id,channel_id,planned_on,published_at,published_url,hook,copy_text,first_comment,web_title,web_keyword,web_meta,human_edited,ai_request_id,skipped_reason,passed_at')
      .eq('item_id', itemId),
    supabase.schema('marketing').from('channels').select('id,name_th'),
  ]);
  if (error) console.error('getPlacements', error);
  const name = new Map((chans ?? []).map((c) => [c.id as string, c.name_th as string]));
  return (data ?? []).map((p) => ({ ...p, channels: { name_th: name.get(p.channel_id) ?? p.channel_id } })) as Placement[];
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
    .select('id,name,color')
    .order('starts_on', { ascending: false });
  return (data ?? []) as { id: string; name: string; color: string | null }[];
}

/**
 * แบรนด์ในโมดูลคอนเทนต์ · แบรนด์ตั้งต้นขึ้นก่อน (ฌ เฌอ) · แบรนด์ที่ Bay ซ่อนไม่ขึ้น (content.brand_prefs)
 * withHidden = ใช้ตอนแสดงชื่อแบรนด์ของงานเก่า
 */
export async function getBrands(withHidden = false): Promise<Brand[]> {
  const supabase = await createClient();
  const [{ data }, { data: prefs }] = await Promise.all([
    supabase.schema('catalog').from('brands').select('id,name').neq('status', 'เลิกขาย').order('name'),
    supabase.schema('content').from('brand_prefs').select('brand_id,in_content,is_default,sort_order'),
  ]);
  const pref = new Map((prefs ?? []).map((p) => [p.brand_id, p]));
  return ((data ?? []) as Brand[])
    .filter((b) => withHidden || pref.get(b.id)?.in_content !== false)
    .sort((a, b) => (pref.get(a.id)?.is_default ? -1 : 0) - (pref.get(b.id)?.is_default ? -1 : 0)
      || (pref.get(a.id)?.sort_order ?? 100) - (pref.get(b.id)?.sort_order ?? 100));
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

// ── Content agent (R3) ─────────────────────────────────────────────────────

export async function getAgentQuestions(itemId: string): Promise<AgentQuestion[]> {
  const supabase = await createClient();
  const { data } = await supabase.schema('content').from('agent_questions')
    .select('id,item_id,question,choices,answer,answered_at,created_at').eq('item_id', itemId).order('created_at');
  return (data ?? []) as AgentQuestion[];
}

export async function getAiBudget(): Promise<AiBudget | null> {
  const supabase = await createClient();
  const { data } = await supabase.schema('content').from('v_ai_budget').select('*').maybeSingle();
  return (data ?? null) as AiBudget | null;
}

export async function getAiRequests(limit = 30): Promise<AiRequest[]> {
  const supabase = await createClient();
  const { data } = await supabase.schema('content').from('v_ai_requests')
    .select('id,requested_by,kind,item_id,model,status,instruction,error,used_refs,cost_thb,created_at')
    .order('created_at', { ascending: false }).limit(limit);
  return (data ?? []) as AiRequest[];
}

export async function getBrandSections(brandId: string): Promise<BrandSection[]> {
  const supabase = await createClient();
  const { data } = await supabase.schema('content').from('brand_sections')
    .select('id,brand_id,kind,topic,guide,body,sort_order,active,confirmed_at')
    .eq('brand_id', brandId).order('kind', { ascending: false }).order('sort_order').order('created_at');
  return (data ?? []) as BrandSection[];
}

export async function getNotebook(): Promise<NotebookEntry[]> {
  const supabase = await createClient();
  const { data } = await supabase.schema('content').from('notebook')
    .select('id,brand_id,body,source,status,reason,from_item_id,created_at').order('created_at', { ascending: false });
  return (data ?? []) as NotebookEntry[];
}

export async function getPlaybooks(brandId: string): Promise<Playbook[]> {
  const supabase = await createClient();
  const { data } = await supabase.schema('content').from('playbooks')
    .select('id,brand_id,channel_id,body').eq('brand_id', brandId);
  return (data ?? []) as Playbook[];
}

export async function getInterviewTurns(sectionIds: string[]): Promise<InterviewTurn[]> {
  if (sectionIds.length === 0) return [];
  const supabase = await createClient();
  const { data } = await supabase.schema('content').from('interview_turns')
    .select('id,section_id,role,body,choices,created_at').in('section_id', sectionIds).order('created_at');
  return (data ?? []) as InterviewTurn[];
}

/** ฉันคือ Bay ไหม (สิทธิ์ admin) · แก้สมอง agent และตั้งค่า AI */
export async function isAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase.schema('core').from('user_capabilities')
    .select('capability').eq('user_id', user.id).eq('capability', 'admin').is('revoked_at', null).maybeSingle();
  return !!data;
}

// ── ปฏิทิน (R4) ─────────────────────────────────────────────────────────────

/** ทุกชิ้นงานเฟส 1 ที่มีวันลง · ปฏิทินกรองและจัดวันฝั่ง client */
export async function getCalendar(): Promise<{ items: CalItem[]; placements: CalPlacement[] }> {
  const supabase = await createClient();
  const db = supabase.schema('content');
  const [{ data: items }, { data: pl }, { data: models }, { data: images }] = await Promise.all([
    db.from('items').select('id,title,hook,stage,brand_id,pillar_id,campaign_id,owner_id,off_plan')
      .in('format', ['ข้อความล้วน', 'ภาพเดี่ยว', 'อัลบั้มภาพ']).neq('stage', 'พับไว้'),
    db.from('placements').select('id,item_id,channel_id,planned_on,published_at')
      .not('planned_on', 'is', null).is('skipped_reason', null),
    db.from('item_models').select('item_id,product_id'),
    db.from('item_images').select('item_id,url,position,created_at').is('removed_at', null)
      .order('position').order('created_at'),
  ]);
  const kv: Record<string, string> = {};
  for (const r of (images ?? []) as { item_id: string; url: string }[]) kv[r.item_id] ??= r.url;
  const prods: Record<string, string[]> = {};
  for (const r of (models ?? []) as { item_id: string; product_id: string }[]) (prods[r.item_id] ??= []).push(r.product_id);
  const ids = new Set((items ?? []).map((i) => i.id));
  return {
    items: (items ?? []).map((i) => ({ ...i, visual: kv[i.id] ?? null, products: prods[i.id] ?? [] })) as CalItem[],
    placements: ((pl ?? []) as CalPlacement[]).filter((p) => ids.has(p.item_id)),
  };
}

// ── แผนเดือน + แบรนด์ (R6) ──────────────────────────────────────────────────

export async function getPlan(brandId: string, month: string) {
  const supabase = await createClient();
  const db = supabase.schema('content');
  const { data: plan } = await db.from('plans')
    .select('id,brand_id,month,status,note,review_note,submitted_at,approved_at')
    .eq('brand_id', brandId).eq('month', month).maybeSingle();
  if (!plan) return { plan: null, slots: [] as PlanSlot[], changes: [] as PlanChange[] };
  const [{ data: slots }, { data: changes }] = await Promise.all([
    db.from('plan_slots').select('id,plan_id,planned_on,format,channels,hook,key_message,visual,pillar_id,theme_id,campaign_id,owner_id,product_ids,item_id')
      .eq('plan_id', plan.id).is('removed_at', null).order('planned_on'),
    db.from('plan_changes').select('id,kind,summary,seen_at,created_at').eq('plan_id', plan.id).order('created_at', { ascending: false }),
  ]);
  const ids = (slots ?? []).map((s) => s.item_id).filter(Boolean) as string[];
  const { data: stages } = ids.length ? await db.from('items').select('id,stage').in('id', ids) : { data: [] };
  const stageOf = new Map((stages ?? []).map((i) => [i.id, i.stage]));
  return {
    plan: plan as Plan,
    slots: (slots ?? []).map((s) => ({ ...s, item_stage: s.item_id ? stageOf.get(s.item_id) ?? null : null })) as PlanSlot[],
    changes: (changes ?? []) as PlanChange[],
  };
}

/** แผนทุกแบรนด์ที่รออนุมัติ หรือยังไม่อนุมัติของเดือนหน้า · ใช้บนหน้าแรก (H4) */
export async function getOpenPlans(): Promise<Plan[]> {
  const supabase = await createClient();
  const { data } = await supabase.schema('content').from('plans')
    .select('id,brand_id,month,status,note,review_note,submitted_at,approved_at')
    .neq('status', 'อนุมัติแล้ว').order('month');
  return (data ?? []) as Plan[];
}

export async function getThemeWeeks(themeIds: string[]): Promise<ThemeWeek[]> {
  if (themeIds.length === 0) return [];
  const supabase = await createClient();
  const { data } = await supabase.schema('content').from('theme_weeks').select('theme_id,week_of,topic').in('theme_id', themeIds);
  return (data ?? []) as ThemeWeek[];
}

export async function getBrandKit(brandId: string): Promise<BrandKit | null> {
  const supabase = await createClient();
  const { data } = await supabase.schema('content').from('brand_kits').select('brand_id,logo_url,fonts,colors').eq('brand_id', brandId).maybeSingle();
  return (data ?? null) as BrandKit | null;
}

export async function getBrandExamples(brandId: string): Promise<BrandExample[]> {
  const supabase = await createClient();
  const { data } = await supabase.schema('content').from('brand_examples')
    .select('id,brand_id,kind,item_id,url,note').eq('brand_id', brandId).is('removed_at', null).order('created_at', { ascending: false });
  return (data ?? []) as BrandExample[];
}

export async function getAgentRoutes(): Promise<AgentRoute[]> {
  const supabase = await createClient();
  const { data } = await supabase.schema('content').from('agent_routes').select('format,channel_id,agent');
  return (data ?? []) as AgentRoute[];
}

/** งานที่ผ่านแล้ว/โพสต์แล้ว/ตีกลับ · คลังงาน (Q-72) และตัวเลือกตัวอย่างใช่/ไม่ใช่ (Q-71) */
export async function getArchive(brandId: string | null) {
  const supabase = await createClient();
  let q = supabase.schema('content').from('items')
    .select('id,title,hook,stage,brand_id,pillar_id,theme_id,campaign_id,updated_at')
    .in('format', ['ข้อความล้วน', 'ภาพเดี่ยว', 'อัลบั้มภาพ'])
    .in('stage', ['พร้อมโพสต์', 'โพสต์แล้ว', 'ตีกลับแก้'])
    .order('updated_at', { ascending: false }).limit(300);
  if (brandId) q = q.eq('brand_id', brandId);
  const [{ data: items }, { data: links }] = await Promise.all([q, supabase.schema('content').from('item_models').select('item_id,product_id')]);
  const prods: Record<string, string[]> = {};
  for (const l of links ?? []) (prods[l.item_id] ??= []).push(l.product_id);
  return (items ?? []).map((i) => ({ ...i, products: prods[i.id] ?? [] })) as {
    id: string; title: string; hook: string | null; stage: string; brand_id: string | null; pillar_id: string | null;
    theme_id: string | null; campaign_id: string | null; updated_at: string; products: string[];
  }[];
}
