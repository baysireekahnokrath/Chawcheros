/**
 * ประตูเดียวที่ webhook ใช้คุยกับฐานข้อมูล
 *
 * webhook ไม่มีคนล็อกอิน จึงใช้ secret key ของ Supabase
 * แต่ในฐานข้อมูล key นี้ได้สิทธิ์ execute แค่ฟังก์ชัน line_agent.* ที่ตัดข้อมูลลับออกแล้ว (0034)
 * และไฟล์นี้เปิดให้เรียกได้แค่ชื่อในรายการข้างล่าง · ห้ามเพิ่ม .from() ตารางอื่น
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const ALLOWED = [
  'room_order', 'room_orders_due', 'room_orders_overdue', 'room_stock',
  'room_orders_undated', 'room_clearance', 'room_price', 'sheets_age_minutes',
  'room_join', 'room_leave', 'claim_event', 'finish_request', 'flag_last', 'room_state',
  'photo_add', 'slip_add', 'slip_pick', 'change_add', 'worksheets_pending', 'worksheet_rooms', 'worksheet_sent',
  'image_seen', 'images_for',
] as const;
type Fn = (typeof ALLOWED)[number];

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- ไม่มีไฟล์ type ของฐานข้อมูล
let client: SupabaseClient<any, 'line_agent'> | null = null;

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !key) throw new Error('ยังไม่ได้ใส่ SUPABASE_SECRET_KEY ใน Vercel');
  client ??= createClient(url, key, {
    db: { schema: 'line_agent' },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

export async function call<T = unknown>(fn: Fn, args: Record<string, unknown> = {}): Promise<T> {
  if (!ALLOWED.includes(fn)) throw new Error(`ไม่อนุญาต ${fn}`);
  const { data, error } = await db().rpc(fn, args);
  if (error) throw new Error(`${fn}: ${error.message}`);
  return data as T;
}
