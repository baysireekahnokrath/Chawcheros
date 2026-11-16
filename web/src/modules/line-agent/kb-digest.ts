/**
 * รอบสรุปคลังความรู้ · ② ของแผน KB (7-status.md)
 *
 * อ่านบทสนทนาที่เก็บไว้ (ห้องที่ Bay เปิดเก็บ) + คำถามที่ทีมถามบอท → ให้ Claude ร่างเป็นข้อความรู้ + จัดหมวด
 * ผลทุกข้อเป็น "ร่าง" · ต้องให้ Bay ยืนยันในหน้า /knowledge ก่อนบอทหรือ FAQ จะใช้ (R4 · กฎ AI 2)
 *
 * กันมั่ว 4 ชั้น
 *   1. ทุกข้อต้องอ้างข้อความต้นทาง (evidence) · โค้ดตรวจว่าเลขที่อ้างมีจริง · ไม่มีหลักฐาน = ทิ้ง
 *   2. ชื่อคนในแชทไม่ส่งให้ AI (ใช้ "คน1" "คน2") · เบอร์โทรในผลถูกปิดทับ
 *   3. เรื่องที่มีคำว่า ต้นทุน/กำไร ทิ้งทั้งข้อ (LR-11)
 *   4. ค่า Claude นับรวมงบผู้ช่วย · งบหมด/พักบอท = ไม่รัน
 */
import Anthropic from '@anthropic-ai/sdk';
import * as z from 'zod/v4';
import { call } from './db';
import { LINE_MODELS } from './intent';

/** รุ่นสำหรับสรุป · ถูกกว่าตัวตอบแชท 2 เท่า พอสำหรับงานคัดข้อความ */
const MODEL = LINE_MODELS.find((m) => m.id === 'claude-sonnet-5-5') ?? LINE_MODELS[1];
const CHUNK_CHARS = 24_000;       // ต่อการเรียก 1 ครั้ง
const MAX_CHUNKS = 4;             // ต่อรอบ · ที่เหลือรอรอบหน้า (ข้อความยังไม่ถูกทำเครื่องหมาย)
const MAX_TOKENS = 6000;
const TIME_BUDGET_MS = 150_000;

export const KB_CATEGORIES = [
  'สินค้าและวัสดุ', 'การดูแลรักษา', 'การผลิตและเวลา', 'การส่งของและติดตั้ง',
  'การชำระเงิน', 'เคลมและปัญหางาน', 'ขั้นตอนภายในทีม', 'อื่นๆ',
] as const;

const Draft = z.object({
  items: z.array(z.object({
    title: z.string(),                 // เขียนเป็นคำถามหรือหัวข้อที่คนจะค้นหา
    body: z.string(),                  // คำตอบ/วิธีทำ · สรุปจากหลักฐานเท่านั้น
    category: z.string(),
    bls: z.string().nullable(),
    evidence: z.array(z.number()),     // เลขข้อความต้นทาง · ห้าม .int() (Claude ไม่รับ minimum ที่ zod ใส่ให้)
  })),
});

const SYSTEM = `คุณคือผู้คัดความรู้ให้ทีม Chaw Cher (แบรนด์เฟอร์นิเจอร์) · อ่านบทสนทนากลุ่มทำงาน (ทีม CC กับโรงงาน ASE) และคำถามที่ทีมถามบอท แล้วร่าง "ความรู้ที่ใช้ซ้ำได้"
ผลของคุณเป็นแค่ร่าง คนจะตรวจก่อนใช้จริง แต่ต้องไม่แต่งเอง

เก็บเฉพาะ
- คำถามที่ถูกถามแล้วมีคำตอบในบทสนทนา และคำตอบนั้นใช้ได้กับงานอื่นด้วย
- ขั้นตอน กฎ วิธีแก้ปัญหา ข้อควรระวัง ข้อมูลวัสดุ/ผ้า/หนัง/โครงสร้าง/การดูแลรักษา/การผลิต/การส่งของที่ทีมตกลงกันไว้

ห้าม
- แต่งหรือเดา · body ต้องมาจากข้อความที่อ้างเท่านั้น · มีแต่คำถามไม่มีคำตอบ = ข้ามไป
- เรื่องเฉพาะงานเดียวที่ใช้กับงานอื่นไม่ได้ (เช่น ลูกค้ารายนี้ขอเลื่อนเป็นวันนี้) = ข้ามไป
- ใส่ชื่อลูกค้า เบอร์โทร ที่อยู่ เลขบัญชี ยอดเงิน ราคา · ถ้าจำเป็นให้เขียนว่า "ลูกค้า"
- เรื่องต้นทุน กำไร ส่วนต่างราคา = ข้ามทั้งเรื่อง
- ซ้ำกับหัวข้อที่มีอยู่แล้ว (ให้ไว้ท้ายข้อความ) = ข้ามไป

รูปแบบ
- title: เขียนเป็นคำถามหรือหัวข้อสั้นๆ ที่คนจะพิมพ์ค้น เช่น "ผ้ากันน้ำซักเครื่องได้ไหม"
- body: ภาษาไทยสั้น กระชับ ไม่เกิน 6 บรรทัด
- category: เลือกจากรายการนี้เท่านั้น: ${KB_CATEGORIES.join(' · ')}
- bls: เลข BLS ถ้าเรื่องนี้มาจากงานใดงานหนึ่งชัดเจน ไม่งั้น null
- evidence: เลข [n] ของข้อความที่เป็นหลักฐาน อย่างน้อย 1 เลข
- ข้อความที่ขึ้นต้น [Qn] คือคำถามที่ทีมถามบอท (บอทตอบไม่ได้/ตอบแล้ว) ใช้เป็นหลักฐานได้เฉพาะเมื่อมีคำตอบในบทสนทนา
- ไม่มีอะไรควรเก็บ = ส่ง items ว่าง`;

type Msg = { id: string; room: string | null; who: string; at: string; text: string };
type Req = { id: string; question: string; status: string };
type Input = {
  since: string; messages: Msg[]; requests: Req[]; existing_titles: string[];
  budget: { remaining_thb: number; thb_per_usd: number; paused: boolean };
};
type Source = { kind: 'chat' | 'request'; id: string; excerpt: string };

export type DigestResult = {
  ok: boolean; created: number; messages: number; requests: number; thb: number; note: string;
};

const PHONE = /(?<![0-9])0[0-9]{1,2}[- .]?[0-9]{3}[- .]?[0-9]{3,4}(?![0-9])/g;
const COST = /(ต้นทุน|กำไร)/;
const clean = (t: string) => t.replace(PHONE, '[เบอร์]').trim();
const clock = (iso: string) =>
  new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

/** แบ่งเป็นก้อนละ ~24,000 ตัวอักษร · เลขข้อความเรียงต่อกันทั้งรอบ เพื่อให้ evidence ชี้กลับได้ */
function buildChunks(input: Input) {
  const lines: { n: number; text: string; src: Source; msgId?: string }[] = [];
  let n = 0;
  for (const m of input.messages) {
    n += 1;
    lines.push({ n, text: `[${n}] ${m.who} · ${clock(m.at)} · ${m.room ?? ''}: ${m.text.replace(/\s+/g, ' ').slice(0, 600)}`,
      src: { kind: 'chat', id: m.id, excerpt: m.text.replace(/\s+/g, ' ').slice(0, 160) }, msgId: m.id });
  }
  for (const r of input.requests) {
    n += 1;
    lines.push({ n, text: `[${n}] [Q${n}] ทีมถามบอท (${r.status}): ${r.question.replace(/\s+/g, ' ').slice(0, 300)}`,
      src: { kind: 'request', id: r.id, excerpt: r.question.replace(/\s+/g, ' ').slice(0, 160) } });
  }
  const chunks: typeof lines[] = [];
  let cur: typeof lines = []; let size = 0;
  for (const l of lines) {
    if (size + l.text.length > CHUNK_CHARS && cur.length) { chunks.push(cur); cur = []; size = 0; }
    cur.push(l); size += l.text.length;
  }
  if (cur.length) chunks.push(cur);
  return chunks;
}

function worstThb(chars: number, thbPerUsd: number) {
  return ((SYSTEM.length + chars) * MODEL.in + MAX_TOKENS * MODEL.out) / 1e6 * thbPerUsd;
}

async function askClaude(chunk: ReturnType<typeof buildChunks>[number], existing: string[]) {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim().replace(/^["']|["']$/g, '');
  if (!apiKey) return { ok: false as const, error: 'ยังไม่ได้ใส่ ANTHROPIC_API_KEY ใน Vercel' };
  const client = new Anthropic({ apiKey, timeout: 90_000, maxRetries: 1 });
  const { $schema: _drop, ...schema } = z.toJSONSchema(Draft) as Record<string, unknown>;
  void _drop;
  const prompt = chunk.map((l) => l.text).join('\n')
    + '\n\n--- หัวข้อที่มีอยู่แล้ว (ห้ามซ้ำ) ---\n' + existing.slice(0, 150).join('\n');
  try {
    const msg = await client.beta.messages.create({
      model: MODEL.id, max_tokens: MAX_TOKENS, system: SYSTEM,
      messages: [{ role: 'user', content: prompt }],
      output_config: { format: { type: 'json_schema', schema }, effort: 'low' },
      ...(MODEL.fallback ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
    });
    const usage = { input_tokens: msg.usage.input_tokens, output_tokens: msg.usage.output_tokens };
    if (msg.stop_reason === 'refusal') return { ok: false as const, error: 'Claude ปฏิเสธ (refusal)', usage };
    if (msg.stop_reason === 'max_tokens') return { ok: false as const, error: 'ผลยาวเกิน (max_tokens)', usage };
    const parsed = Draft.safeParse(JSON.parse(msg.content.map((b) => (b.type === 'text' ? b.text : '')).join('')));
    if (!parsed.success) return { ok: false as const, error: 'อ่านผล Claude ไม่ได้: ' + parsed.error.message, usage };
    return { ok: true as const, items: parsed.data.items, usage };
  } catch (e) {
    const error = e instanceof Anthropic.AuthenticationError ? 'ANTHROPIC_API_KEY ไม่ถูกต้อง'
      : e instanceof Anthropic.RateLimitError ? 'Claude ไม่ว่าง (429)'
      : e instanceof Anthropic.APIConnectionTimeoutError ? 'Claude ตอบช้าเกิน'
      : e instanceof Anthropic.APIError ? `Claude ตอบ ${e.status}: ${e.message}`
      : String(e);
    return { ok: false as const, error };
  }
}

export async function runDigest(runBy: 'ตั้งเวลา' | 'กดเอง'): Promise<DigestResult> {
  const t0 = Date.now();
  const input = await call<Input>('kb_digest_input', { p_limit: 1500 });
  const none = (note: string): DigestResult => ({ ok: true, created: 0, messages: 0, requests: 0, thb: 0, note });
  if (input.budget.paused) return none('บอทถูกพักอยู่ · ไม่สรุป');
  if (input.messages.length === 0 && input.requests.length === 0) return none('ยังไม่มีข้อความใหม่ให้สรุป');

  const chunks = buildChunks(input);
  const thb = Number(input.budget.thb_per_usd);
  let remaining = Number(input.budget.remaining_thb);
  const usage = { input_tokens: 0, output_tokens: 0 };
  const items: { title: string; body: string; category: string; bls: string | null; refs: Source[] }[] = [];
  const doneIds: string[] = [];
  const seen = new Set(input.existing_titles.map((t) => t.trim().toLowerCase()));
  let error: string | null = null; let note = ''; let reqCount = 0; let processed = 0;

  for (const chunk of chunks.slice(0, MAX_CHUNKS)) {
    const chars = chunk.reduce((a, l) => a + l.text.length, 0);
    if (worstThb(chars, thb) > remaining) { note = 'งบผู้ช่วยเดือนนี้ไม่พอ · เหลือไว้รอบหน้า'; break; }
    if (Date.now() - t0 > TIME_BUDGET_MS) { note = 'เวลาไม่พอ · เหลือไว้รอบหน้า'; break; }
    const res = await askClaude(chunk, [...seen]);
    if (res.usage) {
      usage.input_tokens += res.usage.input_tokens; usage.output_tokens += res.usage.output_tokens;
      remaining -= (res.usage.input_tokens * MODEL.in + res.usage.output_tokens * MODEL.out) / 1e6 * thb;
    }
    if (!res.ok) { error = res.error; break; }
    processed += 1;
    for (const l of chunk) { if (l.msgId) doneIds.push(l.msgId); else reqCount += 1; }
    for (const it of res.items) {
      const title = clean(it.title).slice(0, 200); const body = clean(it.body).slice(0, 4000);
      const refs = [...new Set(it.evidence)].map((n) => chunk.find((l) => l.n === n)?.src).filter((x): x is Source => !!x);
      if (!title || !body || refs.length === 0) continue;          // ไม่มีหลักฐานจริง = ทิ้ง
      if (COST.test(title + body)) continue;                         // LR-11
      const key = title.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const cat = (KB_CATEGORIES as readonly string[]).includes(it.category) ? it.category : 'อื่นๆ';
      const bls = it.bls && /^(BLS)?\d{3,5}[A-Za-z]?$/i.test(it.bls.trim()) ? it.bls.trim().toUpperCase() : null;
      items.push({ title, body, category: cat, bls: bls && !bls.startsWith('BLS') ? 'BLS' + bls : bls, refs });
    }
  }

  if (processed === 0 && !error) return none(note || 'ไม่ได้สรุป');
  const created = await call<number>('kb_digest_save', { p: {
    // ประมวลผลไม่ครบทุกก้อน = ไม่ขยับเส้นเวลา · คำถามที่ยังไม่ได้อ่านจะถูกอ่านรอบหน้า (หัวข้อซ้ำถูกกันด้วยชื่อ)
    run_by: runBy, period_from: input.since, period_to: processed >= chunks.length ? new Date().toISOString() : input.since,
    messages: doneIds.length, requests: reqCount,
    model: MODEL.id, ...usage, usd_per_mtok_in: MODEL.in, usd_per_mtok_out: MODEL.out, thb_per_usd: thb,
    message_ids: doneIds, items: items.map((i) => ({ ...i, source: 'สรุปจากแชท' })), error,
  } });
  const spent = (usage.input_tokens * MODEL.in + usage.output_tokens * MODEL.out) / 1e6 * thb;
  return {
    ok: !error, created, messages: doneIds.length, requests: reqCount, thb: spent,
    note: error ? `สรุปไม่ครบ · ${error}` : note || `สรุปเสร็จ · ได้ร่าง ${created} ข้อ`,
  };
}
