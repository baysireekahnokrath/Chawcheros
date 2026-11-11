/**
 * ประตูของตัวตั้งเวลา (ไม่มีคนล็อกอิน) · ใช้ secret key ของ Supabase
 * ในฐานข้อมูล key นี้เรียกได้แค่ content.news_run_input / news_run_save (0049) · ห้ามเพิ่ม .from() ตาราง
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const ALLOWED = ['news_run_input', 'news_run_save'] as const;
type Fn = (typeof ALLOWED)[number];

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- ไม่มีไฟล์ type ของฐานข้อมูล
let client: SupabaseClient<any, 'content'> | null = null;

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !key) throw new Error('ยังไม่ได้ใส่ SUPABASE_SECRET_KEY ใน Vercel');
  client ??= createClient(url, key, { db: { schema: 'content' }, auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}

export async function call<T = unknown>(fn: Fn, args: Record<string, unknown> = {}): Promise<T> {
  if (!ALLOWED.includes(fn)) throw new Error(`ไม่อนุญาต ${fn}`);
  const { data, error } = await db().rpc(fn, args);
  if (error) throw new Error(`${fn}: ${error.message}`);
  return data as T;
}
