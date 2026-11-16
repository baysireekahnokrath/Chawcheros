'use server';

/**
 * การกดทุกอย่างในโมดูลคนสนใจ · เรียก "ประตู" ใน schema leads เท่านั้น (0053_leads.sql)
 * สิทธิ์ตรวจในฐานข้อมูล (sales.write หรือ cs.write) · ไม่มีสิทธิ์ = ประตูโยน error กลับมา
 * ไม่มีการส่งข้อความถึงลูกค้าจากไฟล์นี้ และไม่เรียก AI
 */
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import {
  CHANNELS, FLOW, HEATS, PRODUCTS, REASONS, SOURCES, TOPICS, isOneOf,
} from './constants';

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

const UUID = /^[0-9a-f-]{36}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}(:\d{2})?$/;

function friendly(message: string): string {
  if (/permission denied|insufficient_privilege|ต้องมีสิทธิ์/.test(message)) {
    return 'บัญชีนี้ยังไม่มีสิทธิ์ใช้รายการคนสนใจ (ต้องมี sales.write หรือ cs.write)';
  }
  if (/schema .* does not exist|Invalid schema|PGRST106|must be one of the following/i.test(message)) {
    return 'ฐานข้อมูลยังไม่มีโมดูลคนสนใจ (ยังไม่ได้วาง migration 0053_leads.sql)';
  }
  return message;
}

async function gate<T = unknown>(fn: string, args: Record<string, unknown>, id?: string): Promise<ActionResult<T>> {
  const supabase = await createClient();
  const { data, error } = await supabase.schema('leads').rpc(fn, args);
  if (error) return { ok: false, error: friendly(error.message) };
  revalidatePath('/leads');
  revalidatePath('/leads/list');
  revalidatePath('/leads/week');
  if (id) revalidatePath(`/leads/${id}`);
  return { ok: true, data: data as T };
}

const bad = (error: string): ActionResult<never> => ({ ok: false, error });

/** LD-14 · ชื่อ + ช่องทางซ้ำกับแถวที่มีอยู่ → ให้คนเลือกว่าเปิดแถวเดิมหรือเป็นคนใหม่ */
export async function createLead(input: {
  channel: string; name: string; topic: string | null; message: string; force: boolean;
}): Promise<ActionResult<{ id: string } | { duplicate: { id: string; name: string; stage: string } }>> {
  const name = input.name.trim();
  if (!isOneOf(CHANNELS, input.channel)) return bad('เลือกช่องทางก่อน');
  if (!name) return bad('ใส่ชื่อที่เห็นในแชทก่อน');
  if (input.topic !== null && !isOneOf(TOPICS, input.topic)) return bad('เรื่องไม่ถูกต้อง');

  const supabase = await createClient();
  if (!input.force) {
    const { data: same } = await supabase
      .schema('leads')
      .from('leads')
      .select('id,display_name,stage')
      .eq('channel', input.channel)
      .order('created_at', { ascending: false })
      .limit(1000);
    const key = name.replace(/\s+/g, '');
    const hit = (same ?? []).find((r) => (r.display_name as string).replace(/\s+/g, '') === key);
    if (hit) {
      return { ok: true, data: { duplicate: { id: hit.id as string, name: hit.display_name as string, stage: hit.stage as string } } };
    }
  }
  const r = await gate<string>('create_lead', {
    p_channel: input.channel, p_display_name: name, p_topic: input.topic, p_message: input.message.trim() || null,
  });
  return r.ok ? { ok: true, data: { id: r.data as string } } : r;
}

export async function markReplied(id: string): Promise<ActionResult> {
  if (!UUID.test(id)) return bad('ไม่พบรายการ');
  return gate('mark_replied', { p_lead: id }, id);
}

export async function markFollowupSent(id: string): Promise<ActionResult<number>> {
  if (!UUID.test(id)) return bad('ไม่พบรายการ');
  return gate<number>('mark_followup_sent', { p_lead: id }, id);
}

export async function setTag(id: string, key: 'topic' | 'product' | 'readiness', value: string): Promise<ActionResult> {
  if (!UUID.test(id)) return bad('ไม่พบรายการ');
  const list = key === 'topic' ? TOPICS : key === 'product' ? PRODUCTS : HEATS;
  if (!isOneOf<string>(list, value)) return bad('ป้ายไม่ถูกต้อง');
  return gate('set_tags', { p_lead: id, [`p_${key}`]: value }, id);
}

export async function confirmTags(id: string): Promise<ActionResult> {
  if (!UUID.test(id)) return bad('ไม่พบรายการ');
  return gate('set_tags', { p_lead: id, p_confirm: true }, id);
}

export async function setNeedBy(id: string, text: string, heat: string | null): Promise<ActionResult> {
  if (!UUID.test(id)) return bad('ไม่พบรายการ');
  if (heat !== null && !isOneOf(HEATS, heat)) return bad('ความพร้อมไม่ถูกต้อง');
  return gate('set_need_by', { p_lead: id, p_need_by: text.slice(0, 200), p_readiness: heat }, id);
}

export async function setStage(
  id: string, stage: string, appointmentOn?: string | null, appointmentTime?: string | null,
): Promise<ActionResult> {
  if (!UUID.test(id)) return bad('ไม่พบรายการ');
  if (!isOneOf(FLOW, stage)) return bad('ขั้นไม่ถูกต้อง');
  if (appointmentOn && !DATE.test(appointmentOn)) return bad('วันนัดไม่ถูกต้อง');
  if (appointmentTime && !TIME.test(appointmentTime)) return bad('เวลานัดไม่ถูกต้อง');
  return gate('set_stage', {
    p_lead: id, p_stage: stage, p_appointment_on: appointmentOn || null, p_appointment_time: appointmentTime || null,
  }, id);
}

export async function setNextAction(id: string, on: string | null, note: string): Promise<ActionResult> {
  if (!UUID.test(id)) return bad('ไม่พบรายการ');
  if (on && !DATE.test(on)) return bad('วันที่ไม่ถูกต้อง');
  return gate('set_next_action', { p_lead: id, p_on: on || null, p_note: note.slice(0, 200) }, id);
}

export async function setAppointment(id: string, on: string, time: string | null): Promise<ActionResult> {
  if (!UUID.test(id)) return bad('ไม่พบรายการ');
  if (!DATE.test(on)) return bad('ใส่วันนัดโชว์รูมก่อน');
  if (time && !TIME.test(time)) return bad('เวลานัดไม่ถูกต้อง');
  return gate('set_appointment', { p_lead: id, p_on: on, p_time: time || null }, id);
}

export async function closeBought(id: string, source: string): Promise<ActionResult> {
  if (!UUID.test(id)) return bad('ไม่พบรายการ');
  if (!isOneOf(SOURCES, source)) return bad('ปิดเป็น ซื้อ ต้องเลือกที่มาของออเดอร์');
  return gate('close_bought', { p_lead: id, p_source: source }, id);
}

export async function closeLost(id: string, reason: string): Promise<ActionResult> {
  if (!UUID.test(id)) return bad('ไม่พบรายการ');
  if (!isOneOf(REASONS, reason)) return bad('ปิดเป็น หาย ต้องเลือกเหตุผล 1 ข้อ');
  return gate('close_lost', { p_lead: id, p_reason: reason }, id);
}

export async function reopenLead(id: string): Promise<ActionResult> {
  if (!UUID.test(id)) return bad('ไม่พบรายการ');
  return gate('reopen', { p_lead: id }, id);
}

export async function setCounted(id: string, counted: boolean): Promise<ActionResult> {
  if (!UUID.test(id)) return bad('ไม่พบรายการ');
  return gate('set_counted', { p_lead: id, p_counted: counted }, id);
}
