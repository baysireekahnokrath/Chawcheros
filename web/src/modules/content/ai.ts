/**
 * ตัวเรียก Claude ของโมดูลคอนเทนต์ · ใช้ฝั่งเซิร์ฟเวอร์เท่านั้น
 *
 * ทุกครั้งที่เรียก: เช็กงบเดือนนี้ก่อน → เรียก → บันทึกลง content.ai_requests (กฎ AI 3 · Q-39)
 * เช็กงบแบบ "กรณีแย่สุด" = ถ้าครั้งนี้ใช้ token เต็มเพดาน ยังไม่เกินงบ ถึงยอมเรียก
 * งบจึงไม่มีทางเกินที่ Bay ตั้ง (ยกเว้นกดพร้อมกันหลายคนในวินาทีเดียวกัน)
 *
 * agent ใช้ session ของคนที่กด · อ่านได้เท่าที่คนนั้นอ่านได้ (กฎ AI 5)
 */
import Anthropic from '@anthropic-ai/sdk';
import * as z from 'zod/v4';
import { AI_MODELS } from './types';

type Supa = Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>;

export type AiKind = 'เขียนข้อความ' | 'ไอเดียด่วน' | 'สัมภาษณ์' | 'แชท @AI' | 'สรุปคู่แข่ง' | 'คิดไอเดีย' | 'ร่างแผน';

export type AiResult<T> =
  | { ok: true; data: T; requestId: string }
  | { ok: false; error: string; requestId?: string };

type RunArgs<S extends z.ZodType> = {
  supabase: Supa;
  kind: AiKind;
  itemId?: string | null;
  brandId?: string | null;
  instruction?: string | null;
  usedRefs?: Record<string, unknown>;
  system: string;
  content: Anthropic.Beta.BetaContentBlockParam[];
  schema: S;
  maxTokens: number;
  effort: 'low' | 'medium' | 'high';
};


/** zod → JSON schema ของ structured outputs · คง enum ไว้ให้ Claude ตอบได้แค่ค่าที่กำหนด */
function jsonSchema(schema: z.ZodType): Record<string, unknown> {
  const { $schema: _drop, ...rest } = z.toJSONSchema(schema) as Record<string, unknown>;
  void _drop;
  return rest;
}

export async function runClaude<S extends z.ZodType>(a: RunArgs<S>): Promise<AiResult<z.infer<S>>> {
  // ตัดช่องว่าง/ขึ้นบรรทัดที่ติดมาตอนคัดลอก key · ต้องขึ้นต้นด้วย sk-ant-
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim().replace(/^["']|["']$/g, '');
  if (!apiKey) {
    return { ok: false, error: 'ยังไม่ได้ใส่ ANTHROPIC_API_KEY ใน Vercel · agent ยังทำงานไม่ได้' };
  }

  const { data: budget } = await a.supabase.schema('content').from('v_ai_budget').select('*').maybeSingle();
  if (!budget) return { ok: false, error: 'อ่านงบ AI ไม่ได้ (ต้องมีสิทธิ์ทีมคอนเทนต์)' };
  if (budget.paused) return { ok: false, error: 'Bay พัก agent ไว้ · เปิดได้ที่หน้าสมอง agent' };

  const model: string = budget.model;
  const price = AI_MODELS.find((m) => m.id === model);
  if (!price) return { ok: false, error: `ไม่รู้จักรุ่น ${model} · เลือกรุ่นใหม่ที่หน้าสมอง agent` };

  // ภาษาไทยกิน token มาก · ประมาณเผื่อไว้ 1 token ต่อ 1 ตัวอักษร · ภาพ 1 ภาพ ≈ 2,000 token
  const promptTokens = a.system.length + a.content.reduce((n, b) => n + (b.type === 'text' ? b.text.length : 2000), 0);
  const worstThb = (promptTokens * price.in + a.maxTokens * price.out)
    / 1e6 * Number(budget.thb_per_usd);
  const remaining = Number(budget.remaining_thb);
  if (worstThb > remaining) {
    return {
      ok: false,
      error: `งบ AI เดือนนี้เหลือ ${remaining.toFixed(2)} บาท ไม่พอสำหรับครั้งนี้ (อาจใช้ถึง ${worstThb.toFixed(2)} บาท) · Bay เพิ่มงบได้ที่หน้าสมอง agent`,
    };
  }

  const client = new Anthropic({ apiKey });
  const isOpus5 = model === 'claude-opus-5';
  const log = async (row: {
    status: 'สำเร็จ' | 'ถามก่อน' | 'ล้มเหลว' | 'ถูกปฏิเสธ';
    output?: unknown; error?: string; input_tokens?: number; output_tokens?: number;
  }) => {
    const { data } = await a.supabase.schema('content').from('ai_requests').insert({
      kind: a.kind,
      item_id: a.itemId ?? null,
      brand_id: a.brandId ?? null,
      model,
      instruction: a.instruction ?? null,
      used_refs: a.usedRefs ?? {},
      usd_per_mtok_in: price.in,
      usd_per_mtok_out: price.out,
      thb_per_usd: budget.thb_per_usd,
      ...row,
    }).select('id').single();
    return data?.id as string | undefined;
  };

  let msg: Anthropic.Beta.BetaMessage;
  try {
    msg = await client.beta.messages.stream({
      model,
      max_tokens: a.maxTokens,
      system: a.system,
      messages: [{ role: 'user', content: a.content }],
      output_config: {
        format: { type: 'json_schema', schema: jsonSchema(a.schema) },
        ...(price.effort ? { effort: a.effort } : {}),
      },
      // Opus 5 ปฏิเสธบางเรื่องได้ · ให้เซิร์ฟเวอร์ส่งต่อรุ่นสำรองเอง แทนที่จะคืนว่าปฏิเสธ
      ...(isOpus5 ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
    }).finalMessage();
  } catch (e) {
    const error = e instanceof Anthropic.AuthenticationError
      ? `API key ไม่ถูกต้อง (key ใน Vercel ขึ้นต้นด้วย ${apiKey.slice(0, 7)}… ยาว ${apiKey.length} ตัว · ของจริงต้องขึ้นต้น sk-ant- ยาวราว 100 ตัว)`
      : e instanceof Anthropic.APIError ? `Claude ตอบ ${e.status}: ${e.message}` : String(e);
    const requestId = await log({ status: 'ล้มเหลว', error });
    return { ok: false, error: 'เรียก AI ไม่สำเร็จ · ' + error, requestId };
  }

  const tokens = { input_tokens: msg.usage.input_tokens, output_tokens: msg.usage.output_tokens };
  if (msg.stop_reason === 'refusal') {
    const requestId = await log({ status: 'ถูกปฏิเสธ', error: 'refusal', ...tokens });
    return { ok: false, error: 'AI ไม่ยอมเขียนเรื่องนี้ · ลองปรับ brief แล้วสั่งใหม่', requestId };
  }
  if (msg.stop_reason === 'max_tokens') {
    const requestId = await log({ status: 'ล้มเหลว', error: 'max_tokens', ...tokens });
    return { ok: false, error: 'AI เขียนยาวเกินเพดาน · ลองสั่งใหม่หรือให้เขียนน้อยช่องทางลง', requestId };
  }

  const text = msg.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
  let data: z.infer<S>;
  try {
    const parsed = a.schema.safeParse(JSON.parse(text));
    if (!parsed.success) throw new Error(parsed.error.message);
    data = parsed.data;
  } catch (e) {
    const requestId = await log({ status: 'ล้มเหลว', error: 'อ่านคำตอบไม่ได้: ' + String(e), output: text, ...tokens });
    return { ok: false, error: 'อ่านคำตอบของ AI ไม่ได้ · ลองสั่งใหม่', requestId };
  }

  const asked = typeof data === 'object' && data !== null && (data as { decision?: string }).decision === 'ask';
  const requestId = await log({ status: asked ? 'ถามก่อน' : 'สำเร็จ', output: data, ...tokens });
  if (!requestId) return { ok: false, error: 'บันทึกการใช้ AI ไม่ได้ · ต้องมีสิทธิ์ทีมคอนเทนต์' };
  return { ok: true, data, requestId };
}

/** วันนี้ตามเวลาไทย YYYY-MM-DD */
export const todayBangkok = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date());

export const isDirectImage = (u: string) => /^https:\/\/.+\.(jpe?g|png|webp|gif)(\?|$)/i.test(u);
