/**
 * คุยกับ LINE Messaging API · ฝั่งเซิร์ฟเวอร์เท่านั้น
 *
 * ใช้แค่ 3 อย่าง: ตรวจลายเซ็น webhook · ตอบกลับ (reply = ไม่นับโควตา) · อ่านชื่อห้อง/ชื่อคน
 * ไม่มี push · บอทไม่พูดเอง (D1) · ตอบไม่ทันก็ไม่ส่ง (LR-18)
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

const API = 'https://api.line.me/v2/bot';

export function lineSecrets() {
  const secret = process.env.LINE_CHANNEL_SECRET?.trim();
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN?.trim();
  return secret && token ? { secret, token } : null;
}

/** LR-1 · ไม่ผ่าน = ทิ้ง · ใครก็ยิงเข้ามาปลอมเป็น LINE ไม่ได้ */
export function verifySignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  const expected = createHmac('sha256', secret).update(rawBody).digest();
  let got: Buffer;
  try {
    got = Buffer.from(signature, 'base64');
  } catch {
    return false;
  }
  return got.length === expected.length && timingSafeEqual(got, expected);
}

/** ตอบกลับด้วย reply token · ข้อความ LINE ยาวได้ไม่เกิน 5,000 ตัวอักษร */
export async function reply(token: string, replyToken: string, text: string): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`${API}/message/reply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ replyToken, messages: [{ type: 'text', text: text.slice(0, 4900) }] }),
  });
  if (res.ok) return { ok: true };
  return { ok: false, error: `LINE reply ${res.status}: ${(await res.text()).slice(0, 300)}` };
}

async function getJson<T>(token: string, path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

export async function groupName(token: string, groupId: string) {
  const r = await getJson<{ groupName?: string }>(token, `/group/${encodeURIComponent(groupId)}/summary`);
  return r?.groupName ?? null;
}

export async function memberName(token: string, groupId: string, userId: string) {
  const r = await getJson<{ displayName?: string }>(
    token, `/group/${encodeURIComponent(groupId)}/member/${encodeURIComponent(userId)}`);
  return r?.displayName ?? null;
}

/** ตรวจว่า token ใช้ได้ไหม · หน้าหลังบ้าน LR-23 */
export async function botInfo(token: string) {
  return getJson<{ displayName?: string; basicId?: string }>(token, '/info');
}

// ---------------------------------------------------------------------------
// รูปแบบ webhook ที่ใช้ · เฉพาะช่องที่อ่านจริง
// ---------------------------------------------------------------------------
export type Mentionee = { index: number; length: number; type?: string; userId?: string; isSelf?: boolean };

export type LineEvent = {
  type: string;
  webhookEventId: string;
  replyToken?: string;
  deliveryContext?: { isRedelivery?: boolean };
  source: { type: 'group' | 'room' | 'user'; groupId?: string; roomId?: string; userId?: string };
  message?: { type: string; text?: string; mention?: { mentionees: Mentionee[] } };
};

/**
 * ทักบอทไหม (D1) · ดูจาก mention ที่ LINE บอกว่าเป็นบอทเอง (isSelf)
 * คืนข้อความที่ตัดชื่อบอทออกแล้ว หรือ null ถ้าไม่ได้ทัก
 */
export function mentionedText(ev: LineEvent): string | null {
  const text = ev.message?.text ?? '';
  const self = ev.message?.mention?.mentionees?.filter((m) => m.isSelf) ?? [];
  if (self.length === 0) return null;
  let out = text;
  for (const m of [...self].sort((a, b) => b.index - a.index)) {
    out = out.slice(0, m.index) + out.slice(m.index + m.length);
  }
  return out.trim();
}
