/**
 * ดึงข่าวที่ร่างแล้วจาก Google Sheet "Chaw Cher News" แท็บ "ร่าง" → content.news_items (สถานะ ร่าง)
 *
 * ไม่มีค่า API: Claude (แพ็กเกจของ Bay) เป็นคนเขียนแท็บ "ร่าง" ทุกเช้า 08:00 (งานตั้งเวลาใน Claude)
 * ระบบนี้แค่ "อ่าน" ชีตด้วยบัญชีเดียวกับที่อ่าน Order Tracking (สิทธิ์ผู้ดู · B40) แล้วบันทึกเป็นร่าง
 * กันซ้ำในฐานข้อมูล: ช่อง "รหัส" ซ้ำ หรือลิงก์ต้นทางซ้ำ = ข้าม (0049 news_import)
 *
 * แท็บ "ร่าง" คอลัมน์: A รหัส · B วันที่ร่าง · C แบรนด์ · D ลิงก์ต้นทาง · E หัวข้อต้นทาง · F วันที่ต้นทาง
 *                     G หัวข่าว · H เนื้อข่าว · I ข้อความ LINE · J ลิงก์รูป (บรรทัดละรูป) · K มาจาก · L สรุปต้นทาง
 */
import { read } from '@/modules/sheets/google';
import { call } from './db';
import type { NewsImage } from './wp';

export const NEWS_SHEET_ID = process.env.NEWS_SHEET_ID?.trim() || '19vtyQJyNimSkFeh3RYz7BoE34mlFVIcm4ubce1iGlQA';
export const NEWS_SHEET_URL = `https://docs.google.com/spreadsheets/d/${NEWS_SHEET_ID}/edit`;

/** ลิงก์ Google Drive แบบเปิดดู → ลิงก์ที่ดึงไฟล์รูปได้ (ไฟล์ต้องแชร์ "ทุกคนที่มีลิงก์") */
export function imageUrl(raw: string): string | null {
  const u = raw.trim();
  if (!/^https?:\/\//.test(u)) return null;
  const m = u.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:.*&)?id=)([\w-]{20,})/);
  return m ? `https://drive.google.com/uc?export=download&id=${m[1]}` : u.replace(/^http:/, 'https:');
}

export type ImportResult = { ok: boolean; created: number; rows: number; note: string };

export async function importFromSheet(runBy: 'ตั้งเวลา' | 'กดเอง'): Promise<ImportResult> {
  let rows: string[][];
  try {
    [rows] = await read(NEWS_SHEET_ID, ['ร่าง!A2:L500']);
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    await call('news_import', { p: { run_by: runBy, items: [], error } }).catch(() => null);
    return { ok: false, created: 0, rows: 0, note: 'อ่านชีตไม่ได้ · ' + error };
  }
  const items = rows
    .filter((r) => (r[0] ?? '').trim() && (r[6] ?? '').trim())          // ต้องมีรหัส + หัวข่าว
    .map((r) => {
      const cell = (i: number) => (r[i] ?? '').trim();
      const images: NewsImage[] = cell(9).split(/[\n,]+/).map(imageUrl).filter((u): u is string => !!u)
        .slice(0, 10).map((url) => ({ url, preview: null, wp_id: null, alt: '' }));
      return {
        sheet_ref: cell(0), brand: cell(2), source_url: cell(3), source_title: cell(4), source_date: cell(5),
        post_title: cell(6), post_body: cell(7), line_text: cell(8), images, summary: cell(11),
      };
    })
    .filter((i) => !/(ต้นทุน|กำไร)/.test(i.post_title + i.post_body + i.line_text));
  const created = await call<number>('news_import', { p: { run_by: runBy, items } });
  return {
    ok: true, created, rows: items.length,
    note: created ? `ได้ข่าวใหม่ ${created} เรื่อง` : items.length ? 'ไม่มีข่าวใหม่ (ทุกแถวดึงไปแล้ว)' : 'แท็บ "ร่าง" ยังว่าง',
  };
}
