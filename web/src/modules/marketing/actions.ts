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
