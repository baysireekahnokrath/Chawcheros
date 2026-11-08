/**
 * นับคนมาถึงโชว์รูม จาก LINE @chawcher (OA ลูกค้า · คนละตัวกับบอท Team Bay)
 *
 * ป้าย A4 ในโชว์รูม → QR เปิดแชทพร้อมข้อความ "สวัสดี มาถึงโชว์รูมแล้ว" → ลูกค้ากดส่ง → เราบันทึก
 *
 * กฎ (ดู 0041)
 *   OA-1  เก็บเฉพาะข้อความแจ้งมาถึง · ข้อความอื่นทิ้งตั้งแต่ตรงนี้ ไม่แตะฐานข้อมูล
 *   OA-6  ไม่ตอบลูกค้าเด็ดขาด · แอดมินยังคุยในหน้า Chat ของ LINE OA Manager ตามปกติ
 *   OA-7  ใช้ key ชุดของ @chawcher (LINE_OA_*) ไม่ปนกับบอท Team Bay (LINE_CHANNEL_*)
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type OaEvent = {
  type: string;
  webhookEventId: string;
  timestamp: number;
  source: { type: 'user' | 'group' | 'room'; userId?: string };
  message?: { type: string; text?: string };
};

export function oaSecrets() {
  const secret = process.env.LINE_OA_CHANNEL_SECRET?.trim();
  const token = process.env.LINE_OA_CHANNEL_ACCESS_TOKEN?.trim() || null; // ไม่บังคับ · มีแล้วได้ชื่อลูกค้า
  return secret ? { secret, token } : null;
}

/**
 * ข้อความนี้คือการแจ้งมาถึงโชว์รูมไหม
 * ข้อความบน QR = "สวัสดี มาถึงโชว์รูมแล้ว" · ลูกค้าอาจแก้/พิมพ์เอง จึงดูแค่แก่นคำ
 * ไม่สนช่องว่าง · สะกด "โชรูม" ก็นับ · "ยังไม่มาถึงโชว์รูม" ไม่นับ
 */
export function isArrival(text: string | undefined | null): boolean {
  if (!text) return false;
  const t = text.normalize('NFC').replace(/\s+/g, '');
  if (!/มาถึงโชว?์?รูม|ถึงโชว?์?รูมแล้ว|มาถึงshowroom/i.test(t)) return false;
  if (/ยังไม่(มา)?ถึง|ไม่ได้มา/.test(t)) return false;
  return true;
}

async function displayName(token: string | null, userId: string): Promise<string | null> {
  if (!token) return null;
  try {
    const res = await fetch(`https://api.line.me/v2/bot/profile/${encodeURIComponent(userId)}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    return ((await res.json()) as { displayName?: string }).displayName ?? null;
  } catch {
    return null;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- ไม่มีไฟล์ type ของฐานข้อมูล
let client: SupabaseClient<any, 'line_oa'> | null = null;
function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !key) throw new Error('ยังไม่ได้ใส่ SUPABASE_SECRET_KEY ใน Vercel');
  client ??= createClient(url, key, {
    db: { schema: 'line_oa' },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

/** คืน 'saved' | 'dup' | 'skip' · skip = ไม่ใช่ข้อความแจ้งมาถึง (ไม่ถูกเก็บ) */
export async function handleOaEvent(ev: OaEvent, token: string | null): Promise<'saved' | 'dup' | 'skip'> {
  if (ev.type !== 'message' || ev.message?.type !== 'text') return 'skip';
  if (ev.source.type !== 'user' || !ev.source.userId) return 'skip';
  const text = ev.message.text ?? '';
  if (!isArrival(text)) return 'skip';

  const name = await displayName(token, ev.source.userId);
  const { data, error } = await db().rpc('record_arrival', {
    p_event_id: ev.webhookEventId,
    p_user_id: ev.source.userId,
    p_message: text,
    p_at: new Date(ev.timestamp || Date.now()).toISOString(),
    p_display_name: name,
  });
  if (error) throw new Error(`record_arrival: ${error.message}`);
  return data ? 'saved' : 'dup';
}
