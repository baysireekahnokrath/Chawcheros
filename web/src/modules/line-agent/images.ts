/**
 * เก็บรูปจาก LINE (สลิป · งานเสร็จ) ลงที่เก็บไฟล์ส่วนตัว bucket "line-images" (0036)
 * ไม่มีลิงก์สาธารณะ · หน้า /line สร้างลิงก์ชั่วคราวให้คนที่มีสิทธิ์ดูเท่านั้น
 * ไฟล์นี้ใช้ secret key ได้แค่ "อัปโหลดเข้า bucket นี้" · ห้ามเพิ่มอย่างอื่น
 */
import { createClient } from '@supabase/supabase-js';
import { getContent } from './line';

const BUCKET = 'line-images';

export async function saveLineImage(token: string, messageId: string, folder: 'slips' | 'work'): Promise<{ path: string; data: Buffer; type: string }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !key) throw new Error('ยังไม่ได้ใส่ SUPABASE_SECRET_KEY ใน Vercel');
  const { data, type } = await getContent(token, messageId);
  const ext = type.includes('png') ? 'png' : 'jpg';
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date());
  const path = `${folder}/${day}/${messageId}.${ext}`;
  const storage = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }).storage;
  const { error } = await storage.from(BUCKET).upload(path, data, { contentType: type, upsert: true });
  if (error) throw new Error('เก็บรูปไม่ได้: ' + error.message);
  return { path, data, type };
}
