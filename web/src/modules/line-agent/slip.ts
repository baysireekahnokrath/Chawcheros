/**
 * อ่านสลิปโอนเงินด้วย Claude (ดูรูป) · ได้แค่ "ร่าง" · เงินจริงต้องมีคนยืนยันเสมอ (กฎ AI 4)
 * ไม่ส่งข้อมูลออเดอร์หรือลูกค้าให้ Claude · Claude เห็นแค่รูปสลิป
 * การจับคู่ BLS ทำในฐานข้อมูล (line_agent.slip_candidates) ไม่ใช่ AI
 */
import Anthropic from '@anthropic-ai/sdk';
import * as z from 'zod/v4';
import type { LINE_MODELS } from './intent';

export const Slip = z.object({
  is_slip: z.boolean(),
  amount: z.number().nullable(),
  paid_on: z.string().nullable(),       // YYYY-MM-DD (ค.ศ.)
  paid_time: z.string().nullable(),
  bank: z.string().nullable(),
  ref: z.string().nullable(),
  payer_name: z.string().nullable(),
  receiver_name: z.string().nullable(),
});
export type Slip = z.infer<typeof Slip>;

const SYSTEM = `คุณอ่านรูปสลิปโอนเงินธนาคารไทย แล้วคัดลอกค่าตามที่เห็นในรูปเท่านั้น
- is_slip: true ถ้าเป็นสลิป/หลักฐานการโอนเงิน · false ถ้าเป็นรูปอื่น (สินค้า งาน ตำหนิ แชท)
- amount: จำนวนเงินที่โอน เป็นตัวเลข ไม่มีจุลภาค
- paid_on: วันที่โอน รูปแบบ YYYY-MM-DD เป็นปี ค.ศ. (ถ้าสลิปเป็น พ.ศ. ให้ลบ 543)
- paid_time: เวลา HH:MM
- bank: ธนาคารผู้โอน
- ref: เลขที่รายการ/เลขอ้างอิง ตามที่พิมพ์ในสลิป
- payer_name: ชื่อผู้โอน · receiver_name: ชื่อผู้รับ
อ่านไม่ออกหรือไม่มี = null · ห้ามเดา`;

export const SLIP_MAX_TOKENS = 1500;
export const SLIP_IMAGE_TOKENS = 1600;

type Price = (typeof LINE_MODELS)[number];

export async function readSlip(model: Price, data: Buffer, type: string):
  Promise<{ ok: true; slip: Slip; usage: { input_tokens: number; output_tokens: number } } | { ok: false; error: string; usage?: { input_tokens: number; output_tokens: number } }> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim().replace(/^["']|["']$/g, '');
  if (!apiKey) return { ok: false, error: 'ยังไม่ได้ใส่ ANTHROPIC_API_KEY' };
  const client = new Anthropic({ apiKey, timeout: 30_000, maxRetries: 1 });
  const { $schema: _drop, ...schema } = z.toJSONSchema(Slip) as Record<string, unknown>;
  void _drop;
  const media = (type.includes('png') ? 'image/png' : 'image/jpeg') as 'image/png' | 'image/jpeg';
  let msg: Anthropic.Beta.BetaMessage;
  try {
    msg = await client.beta.messages.create({
      model: model.id,
      max_tokens: SLIP_MAX_TOKENS,
      system: SYSTEM,
      messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: media, data: data.toString('base64') } },
        { type: 'text', text: 'อ่านสลิปนี้' },
      ] }],
      output_config: { format: { type: 'json_schema', schema }, effort: 'low' },
      ...(model.fallback ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
    });
  } catch (e) {
    return { ok: false, error: e instanceof Anthropic.APIError ? `Claude ตอบ ${e.status}: ${e.message}` : String(e) };
  }
  const usage = { input_tokens: msg.usage.input_tokens, output_tokens: msg.usage.output_tokens };
  if (msg.stop_reason === 'refusal' || msg.stop_reason === 'max_tokens') return { ok: false, error: msg.stop_reason, usage };
  try {
    const parsed = Slip.safeParse(JSON.parse(msg.content.map((b) => (b.type === 'text' ? b.text : '')).join('')));
    if (!parsed.success) return { ok: false, error: 'อ่านผลไม่ได้: ' + parsed.error.message, usage };
    const s = parsed.data;
    if (s.paid_on && !/^\d{4}-\d{2}-\d{2}$/.test(s.paid_on)) s.paid_on = null;
    return { ok: true, slip: s, usage };
  } catch (e) {
    return { ok: false, error: 'อ่านผลไม่ได้: ' + String(e), usage };
  }
}
