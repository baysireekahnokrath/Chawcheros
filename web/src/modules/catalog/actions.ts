'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { parsePriceCsv, type Problem } from './parsePriceCsv';
import type { ImportRow } from './queries';

export type UploadResult =
  | { ok: true; inserted: number; groups: number; problems: Problem[]; batchId: string }
  | { ok: false; error: string; problems?: Problem[] };

export type ActionResult = { ok: true; count?: number } | { ok: false; error: string };

/** ส่งทีละ 300 แถว — 751 แถวในคำขอเดียวใหญ่เกินไปสำหรับ PostgREST */
const CHUNK = 300;

/**
 * อัปโหลดไฟล์ราคา
 *
 * ของที่เข้ามาจากไฟล์นี้ยัง "ไม่ใช่สินค้า" — ยังไม่มี SKU ยังไม่มีใครเห็นนอกจากคนตรวจ
 * SKU จะออกตอนกดอนุมัติเท่านั้น เพราะ SKU ออกแล้วออกเลย ใช้ซ้ำไม่ได้ (กฎ A3)
 * ถ้าออกให้ตั้งแต่ตอนอัปโหลด แถวที่ซ้ำหรือเลิกขายจะกินเลขทิ้งไปถาวร
 */
export async function uploadPriceFile(formData: FormData): Promise<UploadResult> {
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: 'ยังไม่ได้เลือกไฟล์' };
  }

  let text: string;
  try {
    text = await file.text();
  } catch {
    return { ok: false, error: 'อ่านไฟล์ไม่ได้ — ต้องเป็นไฟล์ .csv ที่บันทึกแบบ UTF-8' };
  }

  const { rows, problems, missingColumns } = parsePriceCsv(text);

  if (missingColumns.length > 0) {
    return {
      ok: false,
      error:
        'ไฟล์นี้ไม่ใช่รูปแบบไฟล์ราคา — หาหัวตารางไม่เจอ: ' + missingColumns.join(', '),
    };
  }
  if (rows.length === 0) {
    return { ok: false, error: 'อ่านไฟล์ได้ แต่ไม่มีแถวที่ใช้ได้เลย', problems };
  }

  const supabase = await createClient();

  const { data: batch, error: batchError } = await supabase
    .schema('catalog')
    .from('import_batches')
    .insert({
      source_file: file.name,
      note: `อัปโหลดผ่านหน้าเว็บ · ${rows.length} แถว`,
    })
    .select('id')
    .single();

  if (batchError || !batch) {
    return { ok: false, error: batchError?.message ?? 'สร้างรายการนำเข้าไม่สำเร็จ' };
  }

  let inserted = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK).map((r) => ({ ...r, batch_id: batch.id }));
    const { error } = await supabase.schema('catalog').from('import_variants').insert(chunk);
    if (error) {
      return {
        ok: false,
        error:
          `ใส่ข้อมูลได้ ${inserted} แถวแล้วติดปัญหาที่แถว ${i + 1}: ${error.message}` +
          ' — แถวที่เข้าไปแล้วยังอยู่ กดยกเลิกไฟล์นี้ได้ที่หน้านำเข้า',
        problems,
      };
    }
    inserted += chunk.length;
  }

  const groups = new Set(rows.map((r) => `${r.collection}\u0000${r.category}`)).size;

  revalidatePath('/catalog');
  revalidatePath('/catalog/import');
  revalidatePath('/catalog/review');
  return { ok: true, inserted, groups, problems, batchId: batch.id };
}

/**
 * อนุมัติทั้งกลุ่ม — จุดเดียวในระบบที่ SKU ถูกออกจากการนำเข้า
 * กฎธุรกิจทั้งหมดอยู่ในฟังก์ชันฝั่งฐานข้อมูล ไม่ได้อยู่ในหน้าเว็บ
 * หน้าเว็บซ่อนปุ่มได้ แต่ฐานข้อมูลคือด่านจริง
 */
export async function approveGroup(collection: string, category: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema('catalog')
    .rpc('approve_import_group', { p_collection: collection, p_category: category });

  if (error) return { ok: false, error: error.message };
  revalidatePath('/catalog');
  revalidatePath('/catalog/review');
  return { ok: true, count: (data as number) ?? 0 };
}

/**
 * อนุมัติเฉพาะตัวที่เลือก
 *
 * บางกลุ่มมีของคนละตัวปนกัน เช่น กางเขน · ตู้เก็บของ มีสูง 126.5 กับสูง 80
 * ตัวหนึ่งยังขาย อีกตัวเลิกแล้ว ถ้าเลือกได้แค่ "ทั้งกลุ่ม" ก็บอกระบบไม่ได้
 */
export async function approveRows(ids: string[]): Promise<ActionResult> {
  if (ids.length === 0) return { ok: false, error: 'ยังไม่ได้เลือกตัวไหนเลย' };

  const supabase = await createClient();
  const { data, error } = await supabase
    .schema('catalog')
    .rpc('approve_import_rows', { p_ids: ids });

  if (error) return { ok: false, error: error.message };
  revalidatePath('/catalog');
  revalidatePath('/catalog/review');
  return { ok: true, count: (data as number) ?? 0 };
}

/** ไม่เอาเฉพาะตัวที่เลือก — เปลี่ยนสถานะ ไม่ได้ลบ (กฎ A7) */
export async function rejectRows(ids: string[], note: string): Promise<ActionResult> {
  if (ids.length === 0) return { ok: false, error: 'ยังไม่ได้เลือกตัวไหนเลย' };

  const supabase = await createClient();
  const { data, error } = await supabase
    .schema('catalog')
    .from('import_variants')
    .update({
      review_status: 'ไม่เอา',
      review_note: note.trim() || null,
      reviewed_at: new Date().toISOString(),
    })
    .in('id', ids)
    .eq('review_status', 'รอตรวจ')
    .select('id');

  if (error) return { ok: false, error: error.message };
  revalidatePath('/catalog');
  revalidatePath('/catalog/review');
  return { ok: true, count: data?.length ?? 0 };
}

/** ไม่เอากลุ่มนี้ — เปลี่ยนสถานะ ไม่ได้ลบ (กฎ A7 ห้าม DELETE) */
export async function rejectGroup(
  collection: string,
  category: string,
  note: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema('catalog')
    .from('import_variants')
    .update({ review_status: 'ไม่เอา', review_note: note.trim() || null, reviewed_at: new Date().toISOString() })
    .eq('collection', collection)
    .eq('category', category)
    .eq('review_status', 'รอตรวจ')
    .select('id');

  if (error) return { ok: false, error: error.message };
  revalidatePath('/catalog');
  revalidatePath('/catalog/review');
  return { ok: true, count: data?.length ?? 0 };
}

/**
 * ยกเลิกไฟล์ที่อัปโหลดผิด
 *
 * อัปโหลดไฟล์เดิมซ้ำสองครั้งจะได้ของซ้ำกันสองชุด ตรงนี้คือทางถอย
 * ยังไม่ลบ แค่เปลี่ยนสถานะแถวที่ยังไม่ได้ตรวจเป็น "ไม่เอา"
 * แถวที่อนุมัติไปแล้วไม่แตะ เพราะมันออก SKU ไปแล้ว ถอยไม่ได้
 */
export async function cancelBatch(batchId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema('catalog')
    .from('import_variants')
    .update({ review_status: 'ไม่เอา', review_note: 'ยกเลิกทั้งไฟล์', reviewed_at: new Date().toISOString() })
    .eq('batch_id', batchId)
    .eq('review_status', 'รอตรวจ')
    .select('id');

  if (error) return { ok: false, error: error.message };
  revalidatePath('/catalog');
  revalidatePath('/catalog/import');
  revalidatePath('/catalog/review');
  return { ok: true, count: data?.length ?? 0 };
}

/**
 * ดึงแถวในกลุ่มตอนกดดูรายละเอียด
 *
 * ไม่ส่ง 751 แถวไปพร้อมหน้าเว็บตั้งแต่แรก เพราะคนตรวจเปิดดูจริงแค่บางกลุ่ม
 * และส่วนใหญ่เปิดจากมือถือ (กฎ A9 มือถือมาก่อน)
 */
export async function fetchGroupRows(
  collection: string,
  category: string,
): Promise<{ ok: true; rows: ImportRow[] } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema('catalog')
    .from('import_variants')
    .select(
      'id,source_row_no,brand,sub_category,material_grade,wood,wood_colour,width_cm,depth_cm,height_cm,seat_height_cm,list_price_incl_vat,discount_pct,legacy_nnsku,review_status',
    )
    .eq('collection', collection)
    .eq('category', category)
    .order('source_row_no');

  if (error) return { ok: false, error: error.message };
  return { ok: true, rows: (data ?? []) as ImportRow[] };
}
