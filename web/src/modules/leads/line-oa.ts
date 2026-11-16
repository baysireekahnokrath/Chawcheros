/**
 * รับข้อความจาก LINE @chawcher (OA ที่ลูกค้าทัก · คนละตัวกับบอท Team Bay) เข้ารายการคนสนใจ
 *
 * กฎ
 *   - ไม่ตอบลูกค้าเด็ดขาด · ไฟล์นี้ไม่มีโค้ดส่งข้อความ (LD-11) · ทีมยังตอบในหน้าแชทของ LINE ตามเดิม
 *   - รับเฉพาะข้อความตัวอักษรจากแชท 1 ต่อ 1 · กลุ่ม รูป สติกเกอร์ ไฟล์ ทิ้ง (LD-12 · LD-64)
 *   - เก็บแค่ข้อความล่าสุด 1 ข้อความ ตัด 200 ตัวอักษร (ตัดซ้ำอีกชั้นในฐานข้อมูล) · ไม่เก็บบทสนทนา
 *   - เขียนฐานข้อมูลผ่านฟังก์ชันเดียว leads.upsert_from_line · อ่านตารางไม่ได้ (LD-76)
 *   - ใช้ key ชุดของ @chawcher (LINE_OA_*) ไม่ปนกับบอท Team Bay (LINE_CHANNEL_*)
 *   - ห้าม log ข้อความของลูกค้า ชื่อ หรือ key
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { suggestTags } from './tagging';

export type OaEvent = {
  type?: string;
  webhookEventId?: string;
  timestamp?: number;
  source?: { type?: string; userId?: string };
  message?: { type?: string; text?: string };
};

/**
 * LINE_OA_CHANNEL_SECRET        จำเป็น · ใช้ตรวจลายเซ็น
 * LINE_OA_CHANNEL_ACCESS_TOKEN  ไม่บังคับ · มีแล้วได้ชื่อที่แสดงของลูกค้า ไม่มี = ขึ้นว่า "ลูกค้า LINE"
 * SUPABASE_SECRET_KEY           จำเป็น · ตัวเดียวกับที่บอท Team Bay ใช้อยู่แล้ว
 */
export function oaConfig() {
  const secret = process.env.LINE_OA_CHANNEL_SECRET?.trim();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!secret || !url || !key) return null;
  return { secret, url, key, token: process.env.LINE_OA_CHANNEL_ACCESS_TOKEN?.trim() || null };
}
export type OaConfig = NonNullable<ReturnType<typeof oaConfig>>;

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
let client: SupabaseClient<any, 'leads'> | null = null;
function db(cfg: OaConfig) {
  client ??= createClient(cfg.url, cfg.key, {
    db: { schema: 'leads' },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

/** สิ่งที่จะส่งเข้าฐานข้อมูลจาก 1 เหตุการณ์ · null = ทิ้ง (แยกออกมาให้ทดสอบได้โดยไม่ต้องต่ออะไร) */
export function leadFromEvent(ev: OaEvent) {
  if (ev?.type !== 'message' || ev.message?.type !== 'text') return null;
  if (ev.source?.type !== 'user' || !ev.source.userId) return null;
  const text = (ev.message.text ?? '').trim();
  if (!text) return null;
  const tags = suggestTags(text);
  return {
    p_user_id: ev.source.userId,
    p_message: text.replace(/\s+/g, ' ').slice(0, 200),
    p_at: new Date(typeof ev.timestamp === 'number' && ev.timestamp > 0 ? ev.timestamp : Date.now()).toISOString(),
    p_topic: tags.topic,
    p_product: tags.product,
  };
}

export async function handleOaEvent(ev: OaEvent, cfg: OaConfig): Promise<'saved' | 'skip'> {
  const args = leadFromEvent(ev);
  if (!args) return 'skip';
  const name = await displayName(cfg.token, args.p_user_id);
  const { error } = await db(cfg).rpc('upsert_from_line', { ...args, p_display_name: name });
  // ส่งต่อแค่รหัส error ของฐานข้อมูล · ไม่ใส่ข้อความลูกค้าลง log
  if (error) throw new Error(`upsert_from_line ${error.code ?? ''}`.trim());
  return 'saved';
}
