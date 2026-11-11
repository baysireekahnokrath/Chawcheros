/**
 * AI ของหน้าข่าว · 2 งาน
 *   1. collectNews() · ทุกเช้า 08:00 (Vercel Cron) · ค้นเว็บหาข่าว Chaw Cher + ASE ที่ยังไม่มี → ร่างโพสต์ + ข้อความ LINE
 *   2. draftFromNote() · Bay พิมพ์เรื่อง + แนบรูปเอง → ร่างโพสต์ + ข้อความ LINE
 *
 * ผลทุกชิ้นเป็น "ร่าง" · ขึ้นเว็บ/ส่ง LINE ต้องให้ Bay กดในหน้า /news (CLAUDE.md · ของออกนอกต้องถามก่อน)
 *
 * กันซ้ำ 2 ชั้น: ส่งรายการข่าวที่มีแล้วให้ AI ข้าม + ฐานข้อมูลปฏิเสธลิงก์ซ้ำ (source_key · 0049)
 * กันแต่ง: ทุกข่าวต้องมีลิงก์ต้นทางจริง · โค้ดตรวจว่าลิงก์นั้นมาจากผลค้นจริงในรอบนี้
 */
import Anthropic from '@anthropic-ai/sdk';
import * as z from 'zod/v4';
import { call } from './db';
import type { NewsImage } from './wp';

/** ค้นทุกเช้าใช้ Sonnet 5.5 (ถูกกว่า Opus 2 เท่า · เหมือนรอบสรุปคลังความรู้) · ร่างจากเรื่องที่ Bay ส่งใช้ Opus 5.5 (ชิ้นเดียว ภาษาสำคัญ) */
const SEARCH_MODEL = { id: 'claude-sonnet-5-5', in: 2, out: 10 } as const;
const WRITE_MODEL = { id: 'claude-opus-5-5', in: 4, out: 20 } as const;
const USD_PER_SEARCH = 0.01;                  // $10 ต่อ 1,000 ครั้ง
const MAX_SEARCHES = 10;
const MONTHLY_BUDGET_THB = Number(process.env.NEWS_BUDGET_THB ?? 300);

export const SOURCES = {
  'Chaw Cher': ['"Chaw Cher"', '"ฌ เฌอ"', 'chawcher', 'facebook.com/chawcher', 'instagram.com/chawcher'],
  ASE: ['"ASE Sofa"', '"เอเซ่ โซฟา"', 'facebook.com/AseSofa', 'instagram.com/ase.living', '"ASE Living"'],
} as const;

const VOICE = `น้ำเสียงแบรนด์ Chaw Cher (ฌ เฌอ · แบรนด์เฟอร์นิเจอร์/โซฟาไทย): สุภาพ อบอุ่น มินิมอล ไม่โอ้อวด ไม่ใช้คำว่า "ที่สุด" "อันดับ 1"
ภาษาไทยเป็นหลัก ชื่อเฉพาะภาษาอังกฤษคงไว้ · ลงท้ายสุภาพด้วย "ครับ" ได้แต่ไม่ทุกประโยค
ASE (บริษัท เอเซ่ จำกัด) คือผู้ผลิตโซฟาที่ทำงานคู่กับ Chaw Cher · ข่าว ASE เล่าในมุม "ครอบครัวเดียวกัน/ฝีมือการผลิต"
ห้ามแต่งข้อเท็จจริง ชื่อ ตำแหน่ง ตัวเลข วันที่ ที่ไม่มีในข้อมูล · ห้ามพูดถึงราคา ต้นทุน กำไร
post_title: หัวข่าวสั้น ไม่เกิน 90 ตัวอักษร
post_body: 2-4 ย่อหน้า คั่นย่อหน้าด้วยบรรทัดว่าง · ไม่ใส่ markdown ไม่ใส่ลิงก์
line_text: ข้อความ LINE สั้น 2-4 บรรทัด ขึ้นต้นด้วย "✨ Chaw Cher News" (หรือ "✨ ASE News" ถ้าเป็นข่าว ASE) ใส่อีโมจิได้ 1-2 ตัว ไม่ใส่ลิงก์ (ระบบเติมเอง)`;

// ---------------------------------------------------------------------------
// 1. ค้นข่าวทุกเช้า
// ---------------------------------------------------------------------------
const Found = z.object({
  items: z.array(z.object({
    brand: z.enum(['Chaw Cher', 'ASE']),
    source_url: z.string(),
    source_title: z.string(),
    source_date: z.string().nullable(),   // YYYY-MM-DD ถ้ารู้
    summary: z.string(),                   // สรุปสิ่งที่ต้นทางเขียนจริง 1-3 ประโยค
    post_title: z.string(),
    post_body: z.string(),
    line_text: z.string(),
  })),
});

type RunInput = { seen: { url: string | null; title: string | null }[]; spent_thb_month: number; thb_per_usd: number; ran_today: boolean };

export type CollectResult = { ok: boolean; created: number; found: number; thb: number; note: string };

const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date());

function apiKey() {
  return process.env.ANTHROPIC_API_KEY?.trim().replace(/^["']|["']$/g, '') || null;
}

function explainError(e: unknown) {
  return e instanceof Anthropic.AuthenticationError ? 'ANTHROPIC_API_KEY ไม่ถูกต้อง'
    : e instanceof Anthropic.RateLimitError ? 'Claude ไม่ว่าง (429) · ลองใหม่ภายหลัง'
    : e instanceof Anthropic.APIConnectionTimeoutError ? 'Claude ตอบช้าเกิน'
    : e instanceof Anthropic.APIError ? `Claude ตอบ ${e.status}: ${e.message}`
    : e instanceof Error ? e.message : String(e);
}

const norm = (u: string) => u.trim().toLowerCase().replace(/^https?:\/\/(www\.|m\.)?/, '').replace(/[/?#]+$/, '');

/** ข้อความ JSON สุดท้ายของคำตอบ (หลังผลค้นเว็บก้อนสุดท้าย) */
function finalText(content: Anthropic.Beta.BetaContentBlock[]) {
  let last = -1;
  content.forEach((b, i) => { if (b.type !== 'text') last = i; });
  return content.slice(last + 1).map((b) => (b.type === 'text' ? b.text : '')).join('');
}

/** ลิงก์ทุกอันที่ผลค้น/ผลอ่านเว็บรอบนี้เห็นจริง · ใช้ตรวจว่า AI ไม่แต่งลิงก์ */
function seenUrls(content: Anthropic.Beta.BetaContentBlock[]) {
  const urls = new Set<string>();
  for (const b of content) {
    if (b.type === 'web_search_tool_result' && Array.isArray(b.content)) {
      for (const r of b.content) if (r.type === 'web_search_result') urls.add(norm(r.url));
    }
    if (b.type === 'web_fetch_tool_result' && b.content.type === 'web_fetch_result') urls.add(norm(b.content.url));
  }
  return urls;
}

export async function collectNews(runBy: 'ตั้งเวลา' | 'กดเอง'): Promise<CollectResult> {
  const input = await call<RunInput>('news_run_input');
  const thbPerUsd = Number(input.thb_per_usd) || 36;
  const save = async (items: z.infer<typeof Found>['items'], usage: { input_tokens: number; output_tokens: number; web: number }, error: string | null) =>
    call<number>('news_run_save', { p: {
      run_by: runBy, items: items.map((i) => ({ ...i, images: [] })), model: SEARCH_MODEL.id,
      input_tokens: usage.input_tokens, output_tokens: usage.output_tokens, web_searches: usage.web,
      usd_per_mtok_in: SEARCH_MODEL.in, usd_per_mtok_out: SEARCH_MODEL.out, usd_per_search: USD_PER_SEARCH,
      thb_per_usd: thbPerUsd, error,
    } });

  if (runBy === 'ตั้งเวลา' && input.ran_today) return { ok: true, created: 0, found: 0, thb: 0, note: 'วันนี้ค้นไปแล้ว' };
  if (Number(input.spent_thb_month) >= MONTHLY_BUDGET_THB) {
    return { ok: false, created: 0, found: 0, thb: 0, note: `งบค้นข่าวเดือนนี้หมด (฿${MONTHLY_BUDGET_THB})` };
  }
  const key = apiKey();
  if (!key) return { ok: false, created: 0, found: 0, thb: 0, note: 'ยังไม่ได้ใส่ ANTHROPIC_API_KEY ใน Vercel' };

  const seen = input.seen.map((s) => `- ${s.title ?? ''} ${s.url ?? ''}`.trim()).join('\n') || '(ยังไม่มี)';
  const system = `คุณคือผู้เก็บข่าวให้ทีม Chaw Cher · วันนี้ ${today()} (เวลาไทย)
หน้าที่: ค้นเว็บหาข่าว/โพสต์ "ใหม่" เกี่ยวกับ 2 แบรนด์นี้ ที่เผยแพร่ภายใน 14 วันที่ผ่านมา
- Chaw Cher: ${SOURCES['Chaw Cher'].join(' · ')}
- ASE: ${SOURCES.ASE.join(' · ')}
เก็บ: ข่าวสื่อ บทความ รีวิว งานอีเวนต์/บูธ รางวัล ผลงานร่วม โพสต์ประกาศจากเพจทางการ ที่พูดถึงแบรนด์จริงๆ
ข้าม: ข่าวที่อยู่ในรายการ "มีแล้ว" (ลิงก์เดียวกันหรือเรื่องเดียวกัน) · หน้าสินค้า/แคตตาล็อก/หน้าแรกเว็บ · โฆษณา · บริษัทอื่นที่ชื่อคล้าย (เช่น ASE ที่ไม่ใช่ผู้ผลิตโซฟา) · ข่าวเก่ากว่า 14 วัน
source_url ต้องเป็นลิงก์ที่คุณเห็นในผลค้นหรือเปิดอ่านจริงในรอบนี้เท่านั้น
summary: สรุปสิ่งที่ต้นทางเขียน ไม่เติมเอง
ถ้าไม่มีข่าวใหม่ ส่ง items ว่าง (เป็นเรื่องปกติ ไม่ต้องหามาเติม)

${VOICE}`;

  const client = new Anthropic({ apiKey: key, timeout: 240_000, maxRetries: 1 });
  const { $schema: _drop, ...schema } = z.toJSONSchema(Found) as Record<string, unknown>;
  void _drop;
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: 'user', content: `ข่าวที่มีแล้ว (ห้ามซ้ำ):\n${seen}\n\nเริ่มค้นได้เลย` }];
  const usage = { input_tokens: 0, output_tokens: 0, web: 0 };
  const allContent: Anthropic.Beta.BetaContentBlock[] = [];
  let msg: Anthropic.Beta.BetaMessage | null = null;

  try {
    for (let turn = 0; turn < 4; turn++) {
      msg = await client.beta.messages.stream({
        model: SEARCH_MODEL.id, max_tokens: 16000, system, messages,
        tools: [
          { type: 'web_search_20260209', name: 'web_search', max_uses: MAX_SEARCHES, user_location: { type: 'approximate', country: 'TH', timezone: 'Asia/Bangkok' } },
          { type: 'web_fetch_20260209', name: 'web_fetch', max_uses: 6 },
        ],
        output_config: { format: { type: 'json_schema', schema }, effort: 'low' },
        betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
      }).finalMessage();
      usage.input_tokens += msg.usage.input_tokens; usage.output_tokens += msg.usage.output_tokens;
      usage.web += msg.usage.server_tool_use?.web_search_requests ?? 0;
      allContent.push(...msg.content);
      if (msg.stop_reason !== 'pause_turn') break;
      messages.push({ role: 'assistant', content: msg.content });   // ค้นยังไม่จบ · ส่งกลับให้ทำต่อ
    }
  } catch (e) {
    const error = explainError(e);
    await save([], usage, error);
    return { ok: false, created: 0, found: 0, thb: 0, note: 'ค้นไม่สำเร็จ · ' + error };
  }

  const thb = ((usage.input_tokens * SEARCH_MODEL.in + usage.output_tokens * SEARCH_MODEL.out) / 1e6 + usage.web * USD_PER_SEARCH) * thbPerUsd;
  const fail = async (error: string) => { await save([], usage, error); return { ok: false, created: 0, found: 0, thb, note: error }; };
  if (!msg) return fail('ไม่ได้คำตอบจาก Claude');
  if (msg.stop_reason === 'refusal') return fail('Claude ปฏิเสธ (refusal)');
  if (msg.stop_reason === 'max_tokens') return fail('ผลยาวเกิน (max_tokens)');
  if (msg.stop_reason === 'pause_turn') return fail('ค้นนานเกิน · ลองกดใหม่');

  let parsed;
  try { parsed = Found.safeParse(JSON.parse(finalText(msg.content))); } catch { parsed = null; }
  if (!parsed?.success) return fail('อ่านผล Claude ไม่ได้');

  const real = seenUrls(allContent);
  const known = new Set(input.seen.map((s) => (s.url ? norm(s.url) : '')).filter(Boolean));
  const items = parsed.data.items.filter((i) =>
    /^https?:\/\//.test(i.source_url) && real.has(norm(i.source_url)) && !known.has(norm(i.source_url))
    && i.post_title.trim() && !/(ต้นทุน|กำไร)/.test(i.post_title + i.post_body + i.line_text));
  const created = await save(items, usage, null);
  return {
    ok: true, created, found: parsed.data.items.length, thb,
    note: created ? `ได้ข่าวใหม่ ${created} เรื่อง` : 'ไม่มีข่าวใหม่วันนี้',
  };
}

// ---------------------------------------------------------------------------
// 2. Bay ส่งเรื่องเอง (เหมือนที่ส่งในแชท) → ร่าง
// ---------------------------------------------------------------------------
const Draft = z.object({ post_title: z.string(), post_body: z.string(), line_text: z.string(), alts: z.array(z.string()) });

export async function draftFromNote(p: { brand: 'Chaw Cher' | 'ASE'; note: string; images: NewsImage[] }) {
  const key = apiKey();
  if (!key) throw new Error('ยังไม่ได้ใส่ ANTHROPIC_API_KEY ใน Vercel');
  const client = new Anthropic({ apiKey: key, timeout: 120_000, maxRetries: 1 });
  const { $schema: _drop, ...schema } = z.toJSONSchema(Draft) as Record<string, unknown>;
  void _drop;
  const content: Anthropic.Beta.BetaContentBlockParam[] = [
    ...p.images.slice(0, 6).map((i): Anthropic.Beta.BetaContentBlockParam => ({ type: 'image', source: { type: 'url', url: i.preview || i.url } })),
    { type: 'text', text: `แบรนด์: ${p.brand}\nวันที่: ${today()}\nเรื่องจาก Bay:\n${p.note}\n\nalts: คำอธิบายรูป (alt) ภาษาไทยสั้นๆ ทีละรูปตามลำดับ ${p.images.length} รูป · บรรยายสิ่งที่เห็นเท่านั้น ไม่ระบุชื่อคนที่ Bay ไม่ได้บอก` },
  ];
  try {
    const msg = await client.beta.messages.create({
      model: WRITE_MODEL.id, max_tokens: 4000,
      system: `คุณเขียนข่าวสั้นให้เว็บ chawcher.com และข้อความ LINE จากเรื่องที่ Bay (เจ้าของแบรนด์) เล่ามา + รูปที่แนบ
ใช้ข้อมูลจากเรื่องที่ Bay เล่าและสิ่งที่เห็นในรูปเท่านั้น · บรรยากาศในรูปเล่าได้ แต่ห้ามเดาชื่อ ตำแหน่ง ข้อตกลง หรือผลลัพธ์ที่ไม่ได้บอก

${VOICE}`,
      messages: [{ role: 'user', content }],
      output_config: { format: { type: 'json_schema', schema }, effort: 'low' },
      betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
    });
    if (msg.stop_reason === 'refusal') throw new Error('Claude ปฏิเสธ (refusal)');
    const parsed = Draft.safeParse(JSON.parse(msg.content.map((b) => (b.type === 'text' ? b.text : '')).join('')));
    if (!parsed.success) throw new Error('อ่านผล Claude ไม่ได้');
    return parsed.data;
  } catch (e) {
    throw new Error(explainError(e));
  }
}
