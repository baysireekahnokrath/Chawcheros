'use server';

/**
 * แผนเดือน + แบรนด์ (R6) · กฎทั้งหมดอยู่ในฐานข้อมูล (0028) · ที่นี่แค่ส่งต่อ
 */
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { draftPlan } from './agent';
import { getDashboard } from './dashboard';

type Result = { ok: true } | { ok: false; error: string };
const done = (error?: { message: string } | null): Result => {
  revalidatePath('/content', 'layout');
  return error ? { ok: false, error: error.message } : { ok: true };
};
const str = (v: FormDataEntryValue | null) => String(v ?? '').trim();

export async function createPlan(brandId: string, month: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.schema('content').from('plans').insert({ brand_id: brandId, month });
  return done(error?.code === '23505' ? { message: 'เดือนนี้มีแผนของแบรนด์นี้แล้ว' } : error);
}

/** เพิ่มชิ้นในแผน · แผนอนุมัติแล้วจะสร้างการ์ดทันทีและบันทึกแจ้ง Bay (Q-17) */
export async function addSlot(formData: FormData): Promise<Result> {
  const supabase = await createClient();
  const planId = str(formData.get('plan_id'));
  const slot = {
    planned_on: str(formData.get('planned_on')),
    format: str(formData.get('format')) || 'ภาพเดี่ยว',
    channels: formData.getAll('channels').map(String),
    hook: str(formData.get('hook')),
    key_message: str(formData.get('key_message')),
    visual: str(formData.get('visual')),
    pillar_id: str(formData.get('pillar_id')),
    theme_id: str(formData.get('theme_id')),
    campaign_id: str(formData.get('campaign_id')),
    owner_id: str(formData.get('owner_id')),
    product_ids: formData.getAll('product_ids').map(String).filter(Boolean),
  };
  if (!slot.planned_on) return { ok: false, error: 'เลือกวันลง' };
  if (slot.channels.length === 0) return { ok: false, error: 'เลือกอย่างน้อย 1 ช่องทาง' };

  const { data: plan } = await supabase.schema('content').from('plans').select('status').eq('id', planId).maybeSingle();
  if (plan?.status === 'อนุมัติแล้ว') {
    const { error } = await supabase.schema('content').rpc('add_slot_after_approval', { p_plan_id: planId, p_slot: slot });
    return done(error);
  }
  const { error } = await supabase.schema('content').from('plan_slots').insert({
    plan_id: planId, planned_on: slot.planned_on, format: slot.format, channels: slot.channels,
    hook: slot.hook || null, key_message: slot.key_message || null, visual: slot.visual || null,
    pillar_id: slot.pillar_id || null, theme_id: slot.theme_id || null, campaign_id: slot.campaign_id || null,
    owner_id: slot.owner_id || null, product_ids: slot.product_ids,
  });
  return done(error);
}

export async function removeSlot(slotId: string, reason: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.schema('content').rpc('remove_slot', { p_slot_id: slotId, p_reason: reason || null });
  return done(error);
}

export async function submitPlan(planId: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.schema('content').rpc('submit_plan', { p_plan_id: planId });
  return done(error);
}

export async function approvePlan(planId: string, note: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.schema('content').rpc('approve_plan', { p_plan_id: planId, p_note: note || null });
  return done(error);
}

export async function bouncePlan(planId: string, note: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.schema('content').rpc('bounce_plan', { p_plan_id: planId, p_note: note });
  return done(error);
}

export async function markChangesSeen(planId: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.schema('content').rpc('mark_plan_changes_seen', { p_plan_id: planId });
  return done(error);
}

export async function addTheme(formData: FormData): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.schema('content').from('themes').insert({
    brand_id: str(formData.get('brand_id')), name: str(formData.get('name')),
    goal: str(formData.get('goal')) || null, starts_on: str(formData.get('starts_on')), ends_on: str(formData.get('ends_on')),
  });
  return done(error?.code === '23514' ? { message: 'วันจบต้องไม่ก่อนวันเริ่ม' } : error);
}

/** หัวข้อรายสัปดาห์ใต้ธีม (Q-12) · ว่าง = ไม่เปลี่ยน */
export async function setThemeWeek(themeId: string, weekOf: string, topic: string): Promise<Result> {
  const supabase = await createClient();
  if (!topic.trim()) return { ok: false, error: 'พิมพ์หัวข้อก่อน' };
  const { error } = await supabase.schema('content').from('theme_weeks')
    .upsert({ theme_id: themeId, week_of: weekOf, topic: topic.trim() }, { onConflict: 'theme_id,week_of' });
  return done(error);
}

// ── แบรนด์ (Q-70 Q-71 Q-08 K6) ─────────────────────────────────────────────

export async function saveBrandKit(formData: FormData): Promise<Result> {
  const supabase = await createClient();
  const names = formData.getAll('color_name').map(String);
  const hexes = formData.getAll('color_hex').map(String);
  const colors = hexes.map((hex, i) => ({ name: names[i]?.trim() || hex, hex: hex.trim() }))
    .filter((c) => /^#[0-9a-fA-F]{6}$/.test(c.hex));
  const { error } = await supabase.schema('content').from('brand_kits').upsert({
    brand_id: str(formData.get('brand_id')), logo_url: str(formData.get('logo_url')) || null,
    fonts: str(formData.get('fonts')) || null, colors,
  });
  return done(error);
}

export async function addExample(formData: FormData): Promise<Result> {
  const supabase = await createClient();
  const item = str(formData.get('item_id'));
  const url = str(formData.get('url'));
  if (!item && !url) return { ok: false, error: 'เลือกงานในระบบ หรือแปะลิงก์' };
  const { error } = await supabase.schema('content').from('brand_examples').insert({
    brand_id: str(formData.get('brand_id')), kind: str(formData.get('kind')),
    item_id: item || null, url: url || null, note: str(formData.get('note')),
  });
  return done(error?.code === '23514' ? { message: 'บอกด้วยว่าทำไมถึงใช่หรือไม่ใช่' } : error);
}

export async function removeExample(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.schema('content').from('brand_examples').update({ removed_at: new Date().toISOString() }).eq('id', id);
  return done(error);
}

export async function setCampaignColor(id: string, color: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.schema('marketing').from('campaigns').update({ color }).eq('id', id);
  return done(error);
}

export async function setRoute(format: string, channelId: string, agent: string): Promise<Result> {
  const supabase = await createClient();
  const { data, error } = await supabase.schema('content').from('agent_routes')
    .update({ agent }).eq('format', format).eq('channel_id', channelId).select('format');
  if (!error && !data?.length) return { ok: false, error: 'ตั้งค่าได้เฉพาะ Bay' };
  return done(error);
}

// ── agent ช่วย (Bay ขอ 2026-09-23) ─────────────────────────────────────────

/** agent ร่างชิ้นในแผนทั้งเดือน · ลงเป็นร่างให้ทีมแก้ก่อนส่ง */
export async function aiDraftPlan(planId: string, count: number, direction: string): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'ต้องล็อกอินก่อน' };
  const { data: plan } = await supabase.schema('content').from('plans').select('brand_id').eq('id', planId).maybeSingle();
  if (!plan) return { ok: false, error: 'ไม่พบแผน' };
  const d = await getDashboard(user.id, plan.brand_id);
  const r = await draftPlan(supabase, planId, Math.min(Math.max(count, 1), 20), direction.trim(), d.stale);
  revalidatePath('/content', 'layout');
  return r.ok ? { ok: true, message: `agent ร่างมา ${r.count} ชิ้น${r.note ? ` · ${r.note}` : ''}` } : { ok: false, error: r.error };
}
