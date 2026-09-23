'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export type ActionResult = { ok: true } | { ok: false; error: string };

/** ตั้งงานใหม่ + เลือกว่าจะลงช่องทางไหนบ้างตั้งแต่แรก */
export async function createItem(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();

  const channels = formData.getAll('channels').map(String).filter(Boolean);
  const { data: item, error } = await supabase
    .schema('content')
    .from('items')
    .insert({
      title: String(formData.get('title') ?? '').trim(),
      format: String(formData.get('format') ?? 'คลิปสั้น'),
      brief: String(formData.get('brief') ?? '').trim() || null,
      campaign_id: String(formData.get('campaign_id') ?? '') || null,
      due_on: String(formData.get('due_on') ?? '') || null,
      stage: 'ไอเดีย',
    })
    .select('id')
    .single();

  if (error || !item) return { ok: false, error: error?.message ?? 'สร้างไม่สำเร็จ' };

  if (channels.length > 0) {
    const { error: plError } = await supabase
      .schema('content')
      .from('placements')
      .insert(channels.map((c) => ({ item_id: item.id, channel_id: c })));
    if (plError) return { ok: false, error: plError.message };
  }

  revalidatePath('/content');
  redirect(`/content/${item.id}`);
}

/** อัปเดตบรีฟ ลิงก์ และขั้นระหว่างผลิต */
export async function updateItem(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const id = String(formData.get('id') ?? '');

  const { error } = await supabase
    .schema('content')
    .from('items')
    .update({
      title: String(formData.get('title') ?? '').trim(),
      brief: String(formData.get('brief') ?? '').trim() || null,
      stage: String(formData.get('stage') ?? 'ไอเดีย'),
      script_url: String(formData.get('script_url') ?? '').trim() || null,
      raw_url: String(formData.get('raw_url') ?? '').trim() || null,
      edit_url: String(formData.get('edit_url') ?? '').trim() || null,
      thumbnail_url: String(formData.get('thumbnail_url') ?? '').trim() || null,
      due_on: String(formData.get('due_on') ?? '') || null,
    })
    .eq('id', id);

  if (error) return { ok: false, error: error.message };
  revalidatePath('/content');
  revalidatePath(`/content/${id}`);
  return { ok: true };
}

export async function submitForReview(itemId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .schema('content')
    .rpc('submit_for_review', { p_item_id: itemId });
  if (error) return { ok: false, error: error.message };
  revalidatePath('/content');
  revalidatePath(`/content/${itemId}`);
  return { ok: true };
}

export async function approveItem(itemId: string, note: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .schema('content')
    .rpc('approve_item', { p_item_id: itemId, p_note: note.trim() || null });
  if (error) return { ok: false, error: error.message };
  revalidatePath('/content');
  revalidatePath(`/content/${itemId}`);
  return { ok: true };
}

export async function bounceItem(itemId: string, reason: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .schema('content')
    .rpc('bounce_item', { p_item_id: itemId, p_reason: reason });
  if (error) return { ok: false, error: error.message };
  revalidatePath('/content');
  revalidatePath(`/content/${itemId}`);
  return { ok: true };
}

/** บันทึกว่าลงช่องทางนี้แล้ว — คนกด ไม่ใช่ระบบ */
export async function markPosted(placementId: string, url: string, itemId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .schema('content')
    .rpc('mark_posted', { p_placement_id: placementId, p_url: url });
  if (error) return { ok: false, error: error.message };
  revalidatePath('/content');
  revalidatePath(`/content/${itemId}`);
  return { ok: true };
}

export async function addPlacement(itemId: string, channelId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .schema('content')
    .from('placements')
    .insert({ item_id: itemId, channel_id: channelId });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/content/${itemId}`);
  return { ok: true };
}
