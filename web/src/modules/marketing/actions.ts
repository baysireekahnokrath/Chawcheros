'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function createCampaign(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();

  const budgetRaw = String(formData.get('budget') ?? '').trim();
  const endsRaw = String(formData.get('ends_on') ?? '').trim();

  const { error } = await supabase.schema('marketing').from('campaigns').insert({
    name: String(formData.get('name') ?? '').trim(),
    channel_id: String(formData.get('channel_id') ?? '') || null,
    objective: String(formData.get('objective') ?? '').trim() || null,
    starts_on: String(formData.get('starts_on') ?? ''),
    ends_on: endsRaw || null,
    budget: budgetRaw ? Number(budgetRaw) : null,
    status: 'กำลังทำ',
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath('/marketing');
  return { ok: true };
}

export async function addSpend(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.schema('marketing').from('campaign_spend').insert({
    campaign_id: String(formData.get('campaign_id') ?? ''),
    amount: Number(formData.get('amount') ?? 0),
    note: String(formData.get('note') ?? '').trim() || null,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath('/marketing');
  return { ok: true };
}

/**
 * ตั้งโปรโมชัน
 *
 * ส่วนลดไม่ได้เขียนลงตารางของโมดูล pricing ตรงๆ
 * แต่เรียกผ่าน "ประตู" pricing.create_promo_discount() ซึ่งเป็นที่เดียว
 * ที่กฎธุรกิจอยู่ (ต้องมีสิทธิ์ marketing.write · ส่วนลด 0-100%)
 */
export async function createPromotion(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();

  const scope = String(formData.get('scope') ?? '');
  const targetId = String(formData.get('target_id') ?? '').trim();
  const startsOn = String(formData.get('starts_on') ?? '');
  const endsOn = String(formData.get('ends_on') ?? '').trim() || null;
  const name = String(formData.get('name') ?? '').trim();

  const { data: ruleId, error: ruleError } = await supabase
    .schema('pricing')
    .rpc('create_promo_discount', {
      p_name: name,
      p_scope: scope,
      p_target_id: scope === 'ทั้งหมด' ? null : targetId,
      p_percent: Number(formData.get('percent') ?? 0),
      p_valid_from: startsOn,
      p_valid_to: endsOn,
    });

  if (ruleError) return { ok: false, error: ruleError.message };

  const { error } = await supabase.schema('marketing').from('promotions').insert({
    name,
    campaign_id: String(formData.get('campaign_id') ?? '') || null,
    headline: String(formData.get('headline') ?? '').trim() || null,
    starts_on: startsOn,
    ends_on: endsOn,
    discount_rule_id: ruleId,
    status: 'กำลังใช้',
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath('/marketing');
  return { ok: true };
}

/**
 * โปรฯ ที่ต่อท้ายคำตอบราคาของบอท (0052) · ชำระเงินสด · ขั้นบันได · ส่งฟรี · ของแถม
 * ไม่แตะกฎส่วนลดของ pricing · ฐานข้อมูลตรวจซ้ำว่ากรอกครบตามประเภท
 */
const EXTRA_KINDS = ['ชำระเงินสด', 'ขั้นบันได', 'ส่งฟรี', 'ของแถม'] as const;

export async function createPromoExtra(formData: FormData): Promise<ActionResult> {
  const kind = String(formData.get('kind') ?? '') as (typeof EXTRA_KINDS)[number];
  if (!EXTRA_KINDS.includes(kind)) return { ok: false, error: 'เลือกประเภทโปรก่อน' };
  const num = (k: string) => { const v = String(formData.get(k) ?? '').trim(); return v ? Number(v) : null; };
  const txt = (k: string) => String(formData.get(k) ?? '').trim() || null;

  const percent = kind === 'ชำระเงินสด' || kind === 'ขั้นบันได' ? num('percent') : null;
  const minTotal = kind === 'ชำระเงินสด' ? null : num('min_total');
  const detail = kind === 'ส่งฟรี' || kind === 'ของแถม' ? txt('detail') : null;
  if ((kind === 'ชำระเงินสด' || kind === 'ขั้นบันได') && !percent) return { ok: false, error: 'ใส่ % ด้วย' };
  if (kind === 'ขั้นบันได' && !minTotal) return { ok: false, error: 'ใส่ยอดซื้อขั้นต่ำด้วย' };
  if (kind === 'ของแถม' && !detail) return { ok: false, error: 'บอกว่าแถมอะไร' };
  const link = txt('link_url');
  if (link && !/^https:\/\//.test(link)) return { ok: false, error: 'ลิงก์ต้องขึ้นต้นด้วย https://' };

  const scope = String(formData.get('scope') ?? 'ทั้งหมด');
  const name = txt('name') ?? ({
    'ชำระเงินสด': `ชำระเงินสด ลด on top ${percent}%`,
    'ขั้นบันได': `ซื้อครบ ${minTotal} ลดเพิ่ม ${percent}%`,
    'ส่งฟรี': 'ส่งฟรี',
    'ของแถม': `แถม ${detail}`,
  })[kind];

  const supabase = await createClient();
  const { error } = await supabase.schema('marketing').from('promotions').insert({
    name,
    kind,
    percent,
    min_total: minTotal,
    detail,
    link_url: link,
    scope,
    target_id: scope === 'ทั้งหมด' ? null : txt('target_id'),
    starts_on: String(formData.get('starts_on') ?? ''),
    ends_on: txt('ends_on'),
    status: 'กำลังใช้',
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath('/marketing');
  return { ok: true };
}

/** จบโปรก่อนกำหนด · ห้ามลบ (A7) จึงเปลี่ยนสถานะ */
export async function endPromotion(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.schema('marketing').from('promotions').update({ status: 'จบแล้ว' }).eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/marketing');
  return { ok: true };
}
