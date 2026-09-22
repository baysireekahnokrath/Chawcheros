'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

/**
 * สแกนแล้วได้อะไรมา อาจเป็นรหัสเปล่าๆ หรือเป็นลิงก์เต็มจาก QR
 *
 * QR บนสติกเกอร์เก็บเป็นลิงก์ จะได้เปิดด้วยกล้องมือถือเฉยๆ ได้ ไม่ต้องลงแอป
 * แต่เครื่องยิงบาร์โค้ดจะพิมพ์ลิงก์ทั้งเส้นลงช่อง ต้องดึงเฉพาะรหัสออกมา
 */
export async function normalizeUnitCode(raw: string): Promise<string> {
  const t = raw.trim();
  const m = t.match(/U\d{7}/i);
  return (m ? m[0] : t).toUpperCase();
}

/** หาตัวสินค้าจากรหัส — ใช้ตอนสแกนเสร็จแล้วจะโชว์ว่าเจออะไร */
export async function findUnit(rawCode: string) {
  const code = await normalizeUnitCode(rawCode);
  if (!code) return { ok: false as const, error: 'ยังไม่ได้ใส่รหัส' };

  const supabase = await createClient();
  const { data, error } = await supabase
    .schema('stock')
    .from('units')
    .select(
      'id,unit_code,status,serial_no,made_at,made_on,made_by,note,location_id,' +
        'locations(name),product_variants(sku,material_grade,wood_type,configuration,width_cm,depth_cm,height_cm,products(collection))',
    )
    .eq('unit_code', code)
    .maybeSingle();

  if (error) return { ok: false as const, error: error.message };
  if (!data) {
    return { ok: false as const, error: `ไม่พบรหัส ${code} — สแกนใหม่ หรือพิมพ์รหัสบนสติกเกอร์` };
  }
  return { ok: true as const, unit: data };
}

/** ประวัติการย้ายของตัวนี้ — ใช้ตอบว่า "ของหายไปตอนไหน" */
export async function getUnitHistory(unitId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .schema('stock')
    .from('unit_moves')
    .select('id,from_status,to_status,note,moved_at,from:from_location(name),to:to_location(name)')
    .eq('unit_id', unitId)
    .order('moved_at', { ascending: false })
    .limit(50);
  return (data ?? []) as unknown as {
    id: number;
    from_status: string | null;
    to_status: string;
    note: string | null;
    moved_at: string;
    from: { name: string } | null;
    to: { name: string } | null;
  }[];
}

/** ★ ย้ายของ — ต้องจบใน 3 วินาที */
export async function moveUnit(formData: FormData): Promise<ActionResult<string>> {
  const supabase = await createClient();
  const code = await normalizeUnitCode(String(formData.get('unit_code') ?? ''));
  const status = String(formData.get('status') ?? '').trim();

  const { error } = await supabase.schema('stock').rpc('move_unit', {
    p_unit_code: code,
    p_location_id: String(formData.get('location_id') ?? ''),
    p_status: status || null,
    p_note: String(formData.get('note') ?? '').trim() || null,
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath('/stock');
  return { ok: true, data: code };
}

/** ยืมออก — กำหนดกลับบังคับ ฐานข้อมูลก็กันอีกชั้น */
export async function lendUnit(formData: FormData): Promise<ActionResult<string>> {
  const supabase = await createClient();
  const code = await normalizeUnitCode(String(formData.get('unit_code') ?? ''));

  const { error } = await supabase.schema('stock').rpc('lend_unit', {
    p_unit_code: code,
    p_destination: String(formData.get('destination') ?? '').trim(),
    p_due_back_on: String(formData.get('due_back_on') ?? ''),
    p_borrower: String(formData.get('borrower') ?? '').trim() || null,
    p_purpose: String(formData.get('purpose') ?? '').trim() || null,
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath('/stock');
  return { ok: true, data: code };
}

export async function returnUnit(formData: FormData): Promise<ActionResult<string>> {
  const supabase = await createClient();
  const code = await normalizeUnitCode(String(formData.get('unit_code') ?? ''));
  const status = String(formData.get('status') ?? 'พร้อมขาย').trim();

  const { error } = await supabase.schema('stock').rpc('return_unit', {
    p_unit_code: code,
    p_location_id: String(formData.get('location_id') ?? ''),
    p_status: status,
    p_note: String(formData.get('note') ?? '').trim() || null,
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath('/stock');
  return { ok: true, data: code };
}

/**
 * รับของเข้าหลายตัวพร้อมกัน — Kiwi 4 ตัว = ออกรหัส 4 รหัส
 * คืนรหัสที่ออกให้ทั้งหมด เพื่อเอาไปพิมพ์สติกเกอร์ต่อทันที
 */
export async function receiveUnits(
  formData: FormData,
): Promise<ActionResult<{ codes: string[] }>> {
  const supabase = await createClient();
  const qty = Number(String(formData.get('qty') ?? '').trim());

  if (!Number.isInteger(qty) || qty < 1) {
    return { ok: false, error: 'จำนวนต้องเป็นจำนวนเต็มอย่างน้อย 1' };
  }

  const { data, error } = await supabase.schema('stock').rpc('receive_units', {
    p_variant_id: String(formData.get('variant_id') ?? ''),
    p_qty: qty,
    p_location_id: String(formData.get('location_id') ?? ''),
    p_status: String(formData.get('status') ?? 'พร้อมขาย'),
    p_note: String(formData.get('note') ?? '').trim() || null,
  });

  if (error) return { ok: false, error: error.message };

  const codes = ((data ?? []) as { unit_code: string }[]).map((u) => u.unit_code);
  revalidatePath('/stock');
  return { ok: true, data: { codes } };
}

/** สร้างที่อยู่ใหม่เอง เช่น งานแฟร์ที่ยังไม่เคยไป */
export async function createLocation(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.schema('stock').from('locations').insert({
    name: String(formData.get('name') ?? '').trim(),
    kind: String(formData.get('kind') ?? 'อื่นๆ'),
    is_fixed: false,
    note: String(formData.get('note') ?? '').trim() || null,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath('/stock');
  return { ok: true };
}
