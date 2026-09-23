'use server';

/**
 * ปุ่มของ Content agent (R3) · เขียน · ตอบคำถาม · ไอเดียด่วน · สมอง agent · ตั้งค่า AI
 * งานเรียก AI ใช้เวลา 20-90 วินาที · หน้าที่เรียกต้องตั้ง maxDuration = 300
 */
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { writeItem, parseIdea, interviewStep, type WriteOutcome, type IdeaDraft } from './agent';
import { AI_MODELS } from './types';

type Result = { ok: true } | { ok: false; error: string };

function refreshItem(itemId: string) {
  revalidatePath('/content');
  revalidatePath(`/content/${itemId}`);
  revalidatePath(`/content/${itemId}/review`);
}
const refreshBrain = () => revalidatePath('/content/brain');

// ── ชิ้นงาน ──────────────────────────────────────────────────────────────────

/** ให้ AI เขียนทุกช่องทางที่ยังไม่มีคนแก้ · force = ช่องที่คนขอให้เขียนทับ */
export async function aiWrite(itemId: string, force: string[] = []): Promise<WriteOutcome> {
  const supabase = await createClient();
  const r = await writeItem(supabase, itemId, { force });
  refreshItem(itemId);
  return r;
}

/** ตอบคำถามของ agent · ตอบครบแล้ว agent เขียนต่อเอง */
export async function answerQuestions(
  itemId: string, answers: { id: string; answer: string }[],
): Promise<WriteOutcome> {
  const supabase = await createClient();
  for (const a of answers) {
    if (!a.answer.trim()) continue;
    const { error } = await supabase.schema('content').rpc('answer_question', { p_id: a.id, p_answer: a.answer });
    if (error) return { ok: false, error: error.message };
  }
  const { count } = await supabase.schema('content').from('agent_questions')
    .select('id', { count: 'exact', head: true }).eq('item_id', itemId).is('answered_at', null);
  if ((count ?? 0) > 0) {
    refreshItem(itemId);
    return { ok: true, status: 'asked', message: `บันทึกคำตอบแล้ว · เหลืออีก ${count} ข้อ` };
  }
  const r = await writeItem(supabase, itemId);
  refreshItem(itemId);
  return r;
}

// ── ไอเดียด่วน ──────────────────────────────────────────────────────────────

export async function understandIdea(text: string, images: string[]) {
  const supabase = await createClient();
  const t = text.trim();
  if (!t) return { ok: false as const, error: 'พิมพ์ไอเดียก่อน' };
  const urls = images.map((u) => u.trim()).filter(Boolean);
  const r = await parseIdea(supabase, t, urls);
  if (!r.ok) return { ok: false as const, error: r.error };
  return { ok: true as const, draft: r.data };
}

/**
 * สร้างชิ้นงานจากไอเดียที่ Bay ยืนยันแล้ว → agent เขียน → ภาพครบก็ส่งตรวจเลย (Q-114–120)
 */
export async function createFromIdea(
  idea: string, draft: IdeaDraft, images: string[], answers: { question: string; answer: string }[],
): Promise<WriteOutcome & { itemId?: string }> {
  const supabase = await createClient();
  const db = supabase.schema('content');
  const urls = images.map((u) => u.trim()).filter(Boolean);
  const format = urls.length === 0 ? 'ข้อความล้วน' : urls.length === 1 ? 'ภาพเดี่ยว' : 'อัลบั้มภาพ';
  const channels = format === 'ข้อความล้วน' ? draft.channels.filter((c) => c !== 'instagram') : draft.channels;
  if (channels.length === 0) return { ok: false, error: 'เลือกอย่างน้อย 1 ช่องทาง' };

  const { data: item, error } = await db.from('items').insert({
    title: draft.title || draft.hook,
    format,
    brand_id: draft.brand_id,
    hook: draft.hook || null,
    key_message: draft.key_message || null,
    visual: draft.visual || null,
    pillar_id: draft.pillar_id || null,
    // คำตอบตอนแปลงไอเดียเก็บไว้ใน brief · agent อ่านทุกครั้งและเสนอเข้าสมุดได้ (Q-119)
    brief: ['ไอเดียด่วน: ' + idea, ...answers.filter((a) => a.answer.trim()).map((a) => `ถาม: ${a.question} → ตอบ: ${a.answer.trim()}`)].join('\n'),
    source_url: urls[0] ?? null,
    stage: 'ไอเดีย',
  }).select('id').single();
  if (error || !item) return { ok: false, error: error?.message ?? 'สร้างชิ้นงานไม่สำเร็จ' };

  const steps = await Promise.all([
    db.from('placements').insert(channels.map((c) => ({ item_id: item.id, channel_id: c, planned_on: draft.planned_on || null }))),
    urls.length ? db.from('item_images').insert(urls.map((url, i) => ({ item_id: item.id, position: i + 1, url }))) : null,
    draft.product_ids.length ? db.from('item_models').insert(draft.product_ids.map((p) => ({ item_id: item.id, product_id: p }))) : null,
  ]);
  const failed = steps.find((s) => s?.error);
  if (failed?.error) return { ok: false, error: failed.error.message, itemId: item.id };

  const r = await writeItem(supabase, item.id);
  refreshItem(item.id);
  return { ...r, itemId: item.id };
}

// ── สมอง agent (Bay) ────────────────────────────────────────────────────────

export async function seedBrand(brandId: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.schema('content').rpc('seed_brand_brain', { p_brand_id: brandId });
  if (error) return { ok: false, error: error.message };
  refreshBrain();
  return { ok: true };
}

export async function saveSection(id: string, body: string): Promise<Result> {
  const supabase = await createClient();
  const { data, error } = await supabase.schema('content').from('brand_sections')
    .update({ body: body.trim() || null }).eq('id', id).select('id');
  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: false, error: 'แก้ได้เฉพาะ Bay' };
  refreshBrain();
  return { ok: true };
}

export async function addSection(brandId: string, kind: 'model' | 'book', topic: string): Promise<Result> {
  const supabase = await createClient();
  if (!topic.trim()) return { ok: false, error: 'ตั้งชื่อหัวข้อก่อน' };
  const { error } = await supabase.schema('content').from('brand_sections')
    .insert({ brand_id: brandId, kind, topic: topic.trim(), sort_order: 100 });
  if (error) return { ok: false, error: error.message };
  refreshBrain();
  return { ok: true };
}

export async function setSectionActive(id: string, active: boolean): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.schema('content').from('brand_sections').update({ active }).eq('id', id);
  if (error) return { ok: false, error: error.message };
  refreshBrain();
  return { ok: true };
}

/** สัมภาษณ์ 1 จังหวะ · answer ว่าง = เริ่ม/ถามต่อ */
export async function interview(sectionId: string, answer: string): Promise<Result> {
  const supabase = await createClient();
  if (answer.trim()) {
    const { error } = await supabase.schema('content').from('interview_turns')
      .insert({ section_id: sectionId, role: 'Bay', body: answer.trim() });
    if (error) return { ok: false, error: error.message };
  }
  const r = await interviewStep(supabase, sectionId);
  refreshBrain();
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

export async function savePlaybook(id: string, body: string): Promise<Result> {
  const supabase = await createClient();
  if (!body.trim()) return { ok: false, error: 'คู่มือว่างไม่ได้' };
  const { data, error } = await supabase.schema('content').from('playbooks').update({ body: body.trim() }).eq('id', id).select('id');
  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: false, error: 'แก้ได้เฉพาะ Bay' };
  refreshBrain();
  return { ok: true };
}

export async function addNote(body: string, brandId: string | null): Promise<Result> {
  const supabase = await createClient();
  if (!body.trim()) return { ok: false, error: 'พิมพ์ข้อความก่อน' };
  const { error } = await supabase.schema('content').from('notebook')
    .insert({ body: body.trim(), brand_id: brandId || null, source: 'Bay เขียน', status: 'ใช้อยู่' });
  if (error) return { ok: false, error: error.message };
  refreshBrain();
  return { ok: true };
}

/** ยืนยัน · เลิกใช้ · แก้ข้อความ/แบรนด์ ของข้อในสมุด (Bay) */
export async function updateNote(
  id: string, patch: { status?: 'ใช้อยู่' | 'เลิกใช้'; body?: string; brand_id?: string | null },
): Promise<Result> {
  const supabase = await createClient();
  const { data, error } = await supabase.schema('content').from('notebook').update(patch).eq('id', id).select('id');
  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: false, error: 'แก้ได้เฉพาะ Bay' };
  refreshBrain();
  return { ok: true };
}

export async function saveAiSettings(formData: FormData): Promise<Result> {
  const supabase = await createClient();
  const model = String(formData.get('model') ?? '');
  if (!AI_MODELS.some((m) => m.id === model)) return { ok: false, error: 'เลือกรุ่นให้ถูก' };
  const budget = Number(formData.get('monthly_budget_thb'));
  const rate = Number(formData.get('thb_per_usd'));
  if (!(budget >= 0) || !(rate > 0)) return { ok: false, error: 'ตัวเลขไม่ถูก' };
  const { data, error } = await supabase.schema('content').from('ai_settings').update({
    model, monthly_budget_thb: budget, thb_per_usd: rate, paused: formData.get('paused') === 'on',
  }).eq('id', 1).select('id');
  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: false, error: 'ตั้งค่าได้เฉพาะ Bay' };
  refreshBrain();
  return { ok: true };
}
