'use server';

/**
 * หลังบ้านของ LINE agent · Bay (สิทธิ์ admin) เท่านั้น · RLS ใน 0034 กันอีกชั้น
 * LR-3 อนุมัติห้อง · LR-20 บันทึก+งบ · LR-21 พักบอท · LR-29 ธงตอบผิด
 */
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { LINE_MODELS } from './intent';

const done = () => revalidatePath('/line');

export async function decideRoom(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  const status = String(formData.get('status') ?? '');
  if (!['อนุมัติ', 'ปฏิเสธ'].includes(status)) return;
  const supabase = await createClient();
  await supabase.schema('line_agent').from('rooms')
    .update({ status, decided_at: new Date().toISOString() }).eq('id', id);
  done();
}

export async function saveSettings(formData: FormData) {
  const model = String(formData.get('model') ?? '');
  const budget = Number(formData.get('monthly_budget_thb'));
  const rate = Number(formData.get('thb_per_usd'));
  if (!LINE_MODELS.some((m) => m.id === model) || !(budget >= 0) || !(rate > 0)) return;
  const supabase = await createClient();
  await supabase.schema('line_agent').from('settings').update({
    model, monthly_budget_thb: budget, thb_per_usd: rate, paused: formData.get('paused') === 'on',
  }).eq('id', 1);
  done();
}

export async function togglePause(formData: FormData) {
  const supabase = await createClient();
  await supabase.schema('line_agent').from('settings')
    .update({ paused: formData.get('paused') === 'true' }).eq('id', 1);
  done();
}

export async function setFlag(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  const flagged = formData.get('flagged') === 'true';
  const supabase = await createClient();
  await supabase.schema('line_agent').from('requests')
    .update({ flagged, flagged_at: flagged ? new Date().toISOString() : null }).eq('id', id);
  done();
}

/** ปุ่ม "ดึงตอนนี้" · Bay เท่านั้น */
export async function syncSheetsNow() {
  const { getMyCapabilities } = await import('@/modules/registry');
  if (!(await getMyCapabilities()).has('admin')) return;
  const { syncAll } = await import('@/modules/sheets/sync');
  try { await syncAll(); } catch (e) { console.error('sync now', e); }
  done();
}
