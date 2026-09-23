'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export type ActionResult = { ok: true } | { ok: false; error: string };

const str = (v: FormDataEntryValue | null) => String(v ?? '').trim();
const orNull = (v: FormDataEntryValue | null) => str(v) || null;

function refresh(itemId?: string) {
  revalidatePath('/content');
  if (itemId) {
    revalidatePath(`/content/${itemId}`);
    revalidatePath(`/content/${itemId}/review`);
  }
}

/**
 * ตั้งงานใหม่ (เฟส 1) · แบรนด์ ประเภท ช่องทางพร้อมวันลง brief และป้ายกำกับ
 * งานที่ตั้งจากหน้านี้ = นอกแผน (Q-118) · แผนเดือน (R6) จะสร้างงานเองด้วย off_plan = false
 */
export async function createItem(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();

  const hook = str(formData.get('hook'));
  const channels = formData.getAll('channels').map(String).filter(Boolean);
  if (!hook) return { ok: false, error: 'ใส่ hook ก่อน อย่างน้อยทีมจะได้รู้ว่าเรื่องนี้เล่าอะไร' };
  if (channels.length === 0) return { ok: false, error: 'เลือกอย่างน้อย 1 ช่องทาง' };

  const { data: item, error } = await supabase
    .schema('content')
    .from('items')
    .insert({
      title: str(formData.get('title')) || hook,
      format: str(formData.get('format')),
      brand_id: orNull(formData.get('brand_id')),
      hook,
      key_message: orNull(formData.get('key_message')),
      visual: orNull(formData.get('visual')),
      pillar_id: orNull(formData.get('pillar_id')),
      theme_id: orNull(formData.get('theme_id')),
      campaign_id: orNull(formData.get('campaign_id')),
      owner_id: orNull(formData.get('owner_id')),
      source_url: orNull(formData.get('source_url')),
      stage: 'ไอเดีย',
    })
    .select('id')
    .single();

  if (error || !item) return { ok: false, error: error?.message ?? 'สร้างไม่สำเร็จ' };

  const { error: plError } = await supabase
    .schema('content')
    .from('placements')
    .insert(channels.map((c) => ({
      item_id: item.id,
      channel_id: c,
      planned_on: orNull(formData.get(`date_${c}`)),
    })));
  if (plError) return { ok: false, error: plError.message };

  const models = formData.getAll('models').map(String).filter(Boolean);
  if (models.length > 0) {
    const { error: mError } = await supabase
      .schema('content')
      .from('item_models')
      .insert(models.map((m) => ({ item_id: item.id, product_id: m })));
    if (mError) return { ok: false, error: mError.message };
  }

  refresh();
  redirect(`/content/${item.id}`);
}

/** แก้ brief ป้ายกำกับ และขั้น (ไอเดีย · กำลังทำ · พับไว้) */
export async function updateBrief(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const id = str(formData.get('id'));

  const { error } = await supabase
    .schema('content')
    .from('items')
    .update({
      title: str(formData.get('title')) || str(formData.get('hook')),
      hook: orNull(formData.get('hook')),
      key_message: orNull(formData.get('key_message')),
      visual: orNull(formData.get('visual')),
      pillar_id: orNull(formData.get('pillar_id')),
      theme_id: orNull(formData.get('theme_id')),
      campaign_id: orNull(formData.get('campaign_id')),
      owner_id: orNull(formData.get('owner_id')),
      source_url: orNull(formData.get('source_url')),
      stage: str(formData.get('stage')) || 'ไอเดีย',
    })
    .eq('id', id);

  if (error) return { ok: false, error: error.message };

  const models = formData.getAll('models').map(String).filter(Boolean);
  const { data: cur } = await supabase.schema('content').from('item_models').select('product_id').eq('item_id', id);
  const have = ((cur ?? []) as { product_id: string }[]).map((r) => r.product_id);
  const add = models.filter((m) => !have.includes(m));
  const drop = have.filter((m) => !models.includes(m));
  if (add.length) {
    const { error: e } = await supabase.schema('content').from('item_models')
      .insert(add.map((m) => ({ item_id: id, product_id: m })));
    if (e) return { ok: false, error: e.message };
  }
  if (drop.length) {
    const { error: e } = await supabase.schema('content').from('item_models')
      .delete().eq('item_id', id).in('product_id', drop);
    if (e) return { ok: false, error: e.message };
  }

  refresh(id);
  return { ok: true };
}

/**
 * บันทึกข้อความของช่องทางหนึ่ง · ติดป้ายว่าคนแก้แล้ว agent จะไม่เขียนทับ (C1.3)
 * ถ้าชิ้นนี้อนุมัติแล้ว ฐานข้อมูลถอนอนุมัติเอง (C3)
 */
export async function saveCopy(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const id = str(formData.get('placement_id'));
  const itemId = str(formData.get('item_id'));
  const web = formData.has('web_title');

  const { error } = await supabase
    .schema('content')
    .from('placements')
    .update({
      hook: orNull(formData.get('hook')),
      copy_text: orNull(formData.get('copy_text')),
      first_comment: orNull(formData.get('first_comment')),
      ...(web
        ? {
            web_title: orNull(formData.get('web_title')),
            web_keyword: orNull(formData.get('web_keyword')),
            web_meta: orNull(formData.get('web_meta')),
          }
        : {}),
      human_edited: true,
    })
    .eq('id', id);

  if (error) return { ok: false, error: error.message };
  refresh(itemId);
  return { ok: true };
}

export async function setPlacementDate(placementId: string, date: string, itemId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .schema('content')
    .from('placements')
    .update({ planned_on: date || null })
    .eq('id', placementId);
  if (error) return { ok: false, error: error.message };
  refresh(itemId);
  return { ok: true };
}

/** ไม่ลงที่นี่แล้ว (R-18) · ต้องบอกเหตุผล · ส่งค่าว่าง = กลับมาลงที่นี่ */
export async function skipPlacement(placementId: string, reason: string, itemId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .schema('content')
    .from('placements')
    .update({ skipped_reason: reason.trim() || null })
    .eq('id', placementId);
  if (error) return { ok: false, error: error.message };
  refresh(itemId);
  return { ok: true };
}

export async function addPlacement(itemId: string, channelId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .schema('content')
    .from('placements')
    .insert({ item_id: itemId, channel_id: channelId });
  if (error) return { ok: false, error: error.message };
  refresh(itemId);
  return { ok: true };
}

// ── ภาพ · ลิงก์ทีละภาพ เรียงได้ ภาพแรก = key visual ─────────────────────────

export async function addImage(itemId: string, url: string): Promise<ActionResult> {
  const supabase = await createClient();
  const u = url.trim();
  if (!u) return { ok: false, error: 'วางลิงก์ภาพก่อน' };
  const { data: last } = await supabase
    .schema('content').from('item_images').select('position')
    .eq('item_id', itemId).is('removed_at', null)
    .order('position', { ascending: false }).limit(1).maybeSingle();
  const { error } = await supabase
    .schema('content')
    .from('item_images')
    .insert({ item_id: itemId, url: u, position: ((last as { position: number } | null)?.position ?? 0) + 1 });
  if (error) return { ok: false, error: error.message };
  refresh(itemId);
  return { ok: true };
}

/** สลับภาพกับภาพก่อนหน้า · เขียนลำดับใหม่ทั้งชุดให้เป็น 1..n */
export async function moveImageUp(itemId: string, imageId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data } = await supabase
    .schema('content').from('item_images').select('id')
    .eq('item_id', itemId).is('removed_at', null)
    .order('position').order('created_at');
  const ids = ((data ?? []) as { id: string }[]).map((r) => r.id);
  const i = ids.indexOf(imageId);
  if (i <= 0) return { ok: true };
  [ids[i - 1], ids[i]] = [ids[i], ids[i - 1]];
  for (let k = 0; k < ids.length; k++) {
    const { error } = await supabase.schema('content').from('item_images')
      .update({ position: k + 1 }).eq('id', ids[k]);
    if (error) return { ok: false, error: error.message };
  }
  refresh(itemId);
  return { ok: true };
}

/** เอาภาพออก · ไม่ลบแถว (A7) */
export async function removeImage(itemId: string, imageId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .schema('content')
    .from('item_images')
    .update({ removed_at: new Date().toISOString() })
    .eq('id', imageId);
  if (error) return { ok: false, error: error.message };
  refresh(itemId);
  return { ok: true };
}

// ── ส่งตรวจ · อนุมัติ · ตีกลับ · โพสต์ (ด่านจริงอยู่ในฟังก์ชันฐานข้อมูล) ──────

export async function submitForReview(itemId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .schema('content')
    .rpc('submit_for_review', { p_item_id: itemId });
  if (error) return { ok: false, error: error.message };
  refresh(itemId);
  return { ok: true };
}

export async function approveItem(itemId: string, note: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .schema('content')
    .rpc('approve_item', { p_item_id: itemId, p_note: note.trim() || null });
  if (error) return { ok: false, error: error.message };
  refresh(itemId);
  return { ok: true };
}

export async function bounceItem(itemId: string, reason: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .schema('content')
    .rpc('bounce_item', { p_item_id: itemId, p_reason: reason });
  if (error) return { ok: false, error: error.message };
  refresh(itemId);
  return { ok: true };
}

/** บันทึกว่าลงช่องทางนี้แล้ว — คนกด ไม่ใช่ระบบ */
export async function markPosted(placementId: string, url: string, itemId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .schema('content')
    .rpc('mark_posted', { p_placement_id: placementId, p_url: url });
  if (error) return { ok: false, error: error.message };
  refresh(itemId);
  return { ok: true };
}

// ── งานคลิปเดิม (LegacyItemDetail) ────────────────────────────────────────────

export async function updateItem(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const id = str(formData.get('id'));

  const { error } = await supabase
    .schema('content')
    .from('items')
    .update({
      title: str(formData.get('title')),
      brief: orNull(formData.get('brief')),
      stage: str(formData.get('stage')) || 'ไอเดีย',
      script_url: orNull(formData.get('script_url')),
      raw_url: orNull(formData.get('raw_url')),
      edit_url: orNull(formData.get('edit_url')),
      thumbnail_url: orNull(formData.get('thumbnail_url')),
      due_on: orNull(formData.get('due_on')),
    })
    .eq('id', id);

  if (error) return { ok: false, error: error.message };
  refresh(id);
  return { ok: true };
}

// ── ตั้งค่า · pillar และธีมของแต่ละแบรนด์ ────────────────────────────────────

export async function createPillar(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .schema('content')
    .from('pillars')
    .insert({
      brand_id: str(formData.get('brand_id')),
      name: str(formData.get('name')),
      color: str(formData.get('color')) || '#a8a29e',
    });
  if (error) {
    return { ok: false, error: error.code === '23505' ? 'แบรนด์นี้มี pillar ชื่อนี้อยู่แล้ว' : error.message };
  }
  revalidatePath('/content/settings');
  return { ok: true };
}

export async function setPillarActive(id: string, active: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.schema('content').from('pillars').update({ active }).eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/content/settings');
  return { ok: true };
}

export async function createTheme(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .schema('content')
    .from('themes')
    .insert({
      brand_id: str(formData.get('brand_id')),
      name: str(formData.get('name')),
      goal: orNull(formData.get('goal')),
      starts_on: str(formData.get('starts_on')),
      ends_on: str(formData.get('ends_on')),
    });
  if (error) {
    return { ok: false, error: error.code === '23514' ? 'วันจบต้องไม่ก่อนวันเริ่ม' : error.message };
  }
  revalidatePath('/content/settings');
  return { ok: true };
}

export async function setThemeActive(id: string, active: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.schema('content').from('themes').update({ active }).eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/content/settings');
  return { ok: true };
}

// ── ตรวจทีละส่วน · ติ๊กแก้ · แชท (R2) ───────────────────────────────────────

export type Verdict = { part: string; pass: boolean; note?: string };

/** ตรวจทีละส่วน · ผ่านหมด = อนุมัติ · มีไม่ผ่าน = ส่งกลับแก้เฉพาะส่วนนั้น (กฎอยู่ใน content.review_item) */
export async function reviewItem(itemId: string, verdicts: Verdict[], note: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .schema('content')
    .rpc('review_item', { p_item_id: itemId, p_verdicts: verdicts, p_note: note.trim() || null });
  if (error) return { ok: false, error: error.message };
  refresh(itemId);
  return { ok: true };
}

export async function tickNote(noteId: string, done: boolean, itemId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .schema('content')
    .rpc('tick_review_note', { p_note_id: noteId, p_done: done });
  if (error) return { ok: false, error: error.message };
  refresh(itemId);
  return { ok: true };
}

/** ส่งข้อความในงาน · @ชื่อคนในทีม = ขึ้นในหน้าแรกของคนนั้น (Y3) */
export async function sendMessage(itemId: string, body: string, partLabel: string): Promise<ActionResult> {
  const supabase = await createClient();
  const text = body.trim();
  if (!text) return { ok: false, error: 'พิมพ์ข้อความก่อน' };
  const [{ data: { user } }, { data: team }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.schema('core').from('app_users').select('id,full_name').eq('status', 'ใช้งาน'),
  ]);
  if (!user) return { ok: false, error: 'ต้องล็อกอินก่อน' };
  const mentions = ((team ?? []) as { id: string; full_name: string }[])
    .filter((p) => text.includes('@' + p.full_name))
    .map((p) => p.id);

  const { error } = await supabase
    .schema('content')
    .from('messages')
    .insert({
      item_id: itemId,
      author_id: user.id,
      part_label: partLabel && partLabel !== 'ทั้งชิ้น' ? partLabel : null,
      body: text,
      mentions,
    });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/content/${itemId}`);
  revalidatePath(`/content/${itemId}/review`);
  return { ok: true };
}
