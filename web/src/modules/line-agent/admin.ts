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

const ROOM_FLAGS = ['see_price', 'see_customer', 'see_money', 'see_address', 'customer_draft', 'can_slip', 'can_photo', 'push_worksheet', 'see_kb'] as const;

/** สิทธิ์และหน้าที่ของแต่ละกลุ่ม (0036) · ไม่ติ๊ก = ปิด */
export async function saveRoomFlags(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  const patch: Record<string, unknown> = {};
  for (const f of ROOM_FLAGS) patch[f] = formData.get(f) === 'on';
  const polite = String(formData.get('draft_polite') ?? 'ค่ะ');
  patch.draft_polite = polite === 'ครับ' ? 'ครับ' : 'ค่ะ';
  const status = String(formData.get('status') ?? '');
  if (['อนุมัติ', 'ปฏิเสธ'].includes(status)) patch.status = status;
  const supabase = await createClient();
  await supabase.schema('line_agent').from('rooms').update(patch).eq('id', id);
  done();
}

export async function closeChange(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  await supabase.schema('line_agent').from('change_requests')
    .update({ status: 'ปิดแล้ว', closed_by: user?.id ?? null, closed_at: new Date().toISOString() }).eq('id', id);
  done();
}

/** หน้าสลิป · พี่ษา (finance.write) หรือ Bay · ยืนยัน = เงินเข้าจริง ตรวจกับรูปแล้ว */
export async function slipAction(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  const act = String(formData.get('act') ?? '');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {};
  if (act === 'confirm') {
    const bls = String(formData.get('bls') ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const amount = Number(String(formData.get('amount') ?? '').replace(/,/g, ''));
    if (!/^(BLS)?\d{3,5}[A-Z]?$/.test(bls) || !(amount > 0)) return;
    Object.assign(patch, { bls: bls.startsWith('BLS') ? bls : 'BLS' + bls, amount, status: 'ยืนยันแล้ว', confirmed_by: user?.id ?? null, confirmed_at: now });
  } else if (act === 'posted') {
    Object.assign(patch, { status: 'ลงชีตแล้ว', posted_by: user?.id ?? null, posted_at: now });
  } else if (act === 'reject') {
    Object.assign(patch, { status: 'ไม่ใช่สลิป', note: String(formData.get('note') ?? '') || null });
  } else return;
  await supabase.schema('line_agent').from('slips').update(patch).eq('id', id);
  revalidatePath('/line/slips');
}
