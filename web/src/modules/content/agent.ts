/**
 * Content agent · ตัวเดียวเขียนทุกช่องทาง (Q-05 Q-06 · decisions-log N)
 *
 * สมองของ agent (Q-100–106) อ่านใหม่ทุกครั้งที่เขียน:
 *   brand model + brand book (เฉพาะหัวข้อที่ Bay ยืนยัน) · สมุดความคิด Bay (เฉพาะข้อที่ใช้อยู่)
 *   · คู่มือแพลตฟอร์มของแบรนด์ · ข้อมูลสินค้าจริงจากแคตตาล็อก
 * ทุกข้อมีรหัสอ้างอิง เช่น [BM2] [N5] · agent ตอบกลับว่าใช้ข้อไหน · เก็บไว้ใน ai_requests.used_refs
 *
 * กฎ AI: ร่างอย่างเดียว คนเป็นคนส่ง · ห้ามแต่งข้อมูล · ไม่แตะเงินหรือการโพสต์
 * ช่องที่คนแก้เอง (human_edited) ไม่เขียนทับ เว้นแต่คนขอช่องนั้นตรงๆ (C1.3 · Q-38)
 */
import * as z from 'zod/v4';
import { runClaude, isDirectImage, todayBangkok } from './ai';
import { PHASE1_CHANNELS, LIMITS, channelName } from './types';
import type Anthropic from '@anthropic-ai/sdk';

type Supa = Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>;

// ── กฎที่ไม่เปลี่ยน · อยู่ต้น system prompt ──────────────────────────────────

const RULES = `คุณคือ Content agent ของบริษัทเฟอร์นิเจอร์ ฌ เฌอ (Chaw Cher) · เขียนคอนเทนต์ภาษาไทยให้แบรนด์ในเครือ
คุณร่างอย่างเดียว คนในทีมเป็นคนตรวจและโพสต์เอง

กฎที่ห้ามละเมิด
1. ห้ามแต่งข้อมูลสินค้า · ขนาด วัสดุ ราคา สี ที่มา ปีที่ออกแบบ ใช้ได้เฉพาะที่อยู่ใน "ข้อมูลสินค้าจากระบบ" เท่านั้น ถ้าไม่มีให้ไม่พูดถึง หรือถาม
2. ห้ามสัญญาเรื่องเงิน ส่วนลด โปรโมชัน การผ่อน การส่งฟรี ถ้าไม่อยู่ใน brief
3. ถ้าข้อมูลไม่พอจะเขียนให้ดี หรือไม่แน่ใจทิศทาง ให้ decision = "ask" แล้วถามสั้นๆ 1-3 ข้อ พร้อมตัวเลือกให้แตะตอบ · อย่าถามสิ่งที่ตอบได้จาก brief หรือสมอง
4. ถ้าสมุดความคิด Bay ขัดกับ brand book หรือ brand model ห้ามตัดสินเอง ให้ถาม
5. แต่ละช่องทางคิดใหม่ตามคู่มือของช่องทางนั้น เรื่องเดียวกันแต่เล่าคนละแบบ ไม่ใช่ย่อหรือแปลงจากอันเดียวกัน
6. ตอบ used_refs เป็นรหัสในวงเล็บเหลี่ยมของข้อที่คุณใช้จริง เช่น "BM2" "N5" "P-facebook"
7. notebook_proposals: เสนอข้อเข้าสมุดความคิด Bay เฉพาะสิ่งที่ใช้กับงานอื่นได้ด้วย เช่น จากคำตอบของ Bay จากเหตุผลที่ตีกลับ หรือจากสิ่งที่คนแก้ในร่างของคุณ · ไม่มีก็ส่ง [] · Bay จะยืนยันเอง
8. ถ้า brand model ยังว่าง ให้เขียนแบบสุภาพ อบอุ่น ไม่ขายแรง และบอกใน note_to_team ว่ายังไม่มี brand model`;

// ── สมอง ─────────────────────────────────────────────────────────────────────

type Brain = { text: string; refs: Record<string, string> };

export async function loadBrain(supabase: Supa, brandId: string, channels: string[]): Promise<Brain> {
  const db = supabase.schema('content');
  const [{ data: sections }, { data: notes }, { data: books }] = await Promise.all([
    db.from('brand_sections').select('id,kind,topic,body').eq('brand_id', brandId).eq('active', true)
      .not('confirmed_at', 'is', null).order('kind').order('sort_order'),
    db.from('notebook').select('id,body,brand_id').eq('status', 'ใช้อยู่')
      .or(`brand_id.is.null,brand_id.eq.${brandId}`).order('created_at'),
    db.from('playbooks').select('id,channel_id,body').eq('brand_id', brandId).in('channel_id', channels),
  ]);
  const refs: Record<string, string> = {};
  const out: string[] = [];

  const model = (sections ?? []).filter((s) => s.kind === 'model' && s.body?.trim());
  const book = (sections ?? []).filter((s) => s.kind === 'book' && s.body?.trim());
  out.push('## Brand model');
  if (model.length === 0) out.push('(ยังว่าง · Bay ยังไม่ได้สัมภาษณ์)');
  model.forEach((s, i) => { refs[`BM${i + 1}`] = s.id; out.push(`[BM${i + 1}] ${s.topic}: ${s.body}`); });
  out.push('', '## Brand book');
  if (book.length === 0) out.push('(ยังว่าง)');
  book.forEach((s, i) => { refs[`BB${i + 1}`] = s.id; out.push(`[BB${i + 1}] ${s.topic}: ${s.body}`); });
  out.push('', '## สมุดความคิด Bay');
  if (!notes?.length) out.push('(ยังไม่มีข้อ)');
  (notes ?? []).forEach((n, i) => {
    refs[`N${i + 1}`] = n.id;
    out.push(`[N${i + 1}] ${n.brand_id ? '' : '(ทุกแบรนด์) '}${n.body}`);
  });
  out.push('', '## คู่มือแพลตฟอร์ม');
  for (const p of books ?? []) {
    refs[`P-${p.channel_id}`] = p.id;
    out.push(`[P-${p.channel_id}] ${channelName(p.channel_id)}`, p.body, '');
  }
  return { text: out.join('\n'), refs };
}

/** ข้อมูลสินค้าจริง · รุ่น · ขนาด · วัสดุ · ราคา (ถ้าคนกดมีสิทธิ์อ่านราคา) */
export async function productFacts(supabase: Supa, productIds: string[]): Promise<string> {
  if (productIds.length === 0) return '(ชิ้นนี้ไม่ได้ผูกสินค้า · ห้ามอ้างสเปกสินค้าใดๆ)';
  const { data: products } = await supabase.schema('catalog').from('products')
    .select('id,collection,name_th,name_en,description,categories(name)').in('id', productIds);
  const { data: variants } = await supabase.schema('catalog').from('product_variants')
    .select('id,product_id,sku,configuration,seat_count,width_cm,depth_cm,height_cm,seat_height_cm,material_grade,wood_type,wood_colour')
    .in('product_id', productIds).neq('status', 'เลิกขาย').limit(60);
  const skus = (variants ?? []).map((v) => v.sku);
  const { data: prices } = skus.length
    ? await supabase.schema('pricing').from('v_variant_price')
      .select('*').in('variant_id', (variants ?? []).map((v) => v.id))
    : { data: [] };
  type Price = { variant_id: string; ราคาขายรวม_vat: number | null };
  const priceOf = new Map(((prices ?? []) as Price[]).map((p) => [p.variant_id, p]));

  return (products ?? []).map((p) => {
    const cat = (p.categories as unknown as { name: string } | null)?.name;
    const vs = (variants ?? []).filter((v) => v.product_id === p.id).slice(0, 15).map((v) => {
      const pr = priceOf.get(v.id);
      const dims = [v.width_cm && `กว้าง ${v.width_cm}`, v.depth_cm && `ลึก ${v.depth_cm}`, v.height_cm && `สูง ${v.height_cm}`,
        v.seat_height_cm && `สูงถึงที่นั่ง ${v.seat_height_cm}`].filter(Boolean).join(' ');
      return `  - ${[v.configuration, v.seat_count && `${v.seat_count} ที่นั่ง`, dims && `${dims} ซม.`, v.material_grade && `หนัง/ผ้า ${v.material_grade}`,
        v.wood_type && `ไม้ ${v.wood_type}`, v.wood_colour && `สี ${v.wood_colour}`,
        pr?.ราคาขายรวม_vat && `ราคาขาย ${Number(pr.ราคาขายรวม_vat).toLocaleString('th-TH')} บาท (รวม VAT)`]
        .filter(Boolean).join(' · ')}`;
    });
    return [`รุ่น ${p.collection}${p.name_th ? ` (${p.name_th})` : ''}${p.name_en ? ` / ${p.name_en}` : ''}${cat ? ` · หมวด ${cat}` : ''}`,
      p.description ? `  คำอธิบาย: ${p.description}` : '', ...vs].filter(Boolean).join('\n');
  }).join('\n\n');
}

// ── เขียนชิ้นงาน ──────────────────────────────────────────────────────────────

const ChannelId = z.enum(['facebook', 'instagram', 'website']);
const WriteSchema = z.object({
  decision: z.enum(['write', 'ask', 'reply']),
  questions: z.array(z.object({ question: z.string(), choices: z.array(z.string()) })),
  channels: z.array(z.object({
    channel: ChannelId,
    hook: z.string(),
    copy_text: z.string(),
    first_comment: z.string(),
    web_title: z.string(),
    web_keyword: z.string(),
    web_meta: z.string(),
  })),
  notebook_proposals: z.array(z.object({ body: z.string(), this_brand_only: z.boolean(), reason: z.string() })),
  used_refs: z.array(z.string()),
  note_to_team: z.string(),
});

export type WriteOutcome =
  | { ok: true; status: 'written' | 'submitted' | 'asked' | 'replied'; message: string }
  | { ok: false; error: string };

/**
 * เขียนข้อความทุกช่องทางของชิ้นงาน
 * force = ช่องทางที่คนขอให้เขียนใหม่ตรงๆ (เขียนทับได้แม้คนแก้ไปแล้ว)
 * instruction = คำสั่งจาก @AI ในแชท
 */
export async function writeItem(
  supabase: Supa,
  itemId: string,
  opts: { force?: string[]; instruction?: string; kind?: 'เขียนข้อความ' | 'แชท @AI' } = {},
): Promise<WriteOutcome> {
  const db = supabase.schema('content');
  const { data: item } = await db.from('items')
    .select('id,title,format,stage,brand_id,hook,key_message,visual,brief,pillar_id,theme_id,campaign_id,source_url')
    .eq('id', itemId).maybeSingle();
  if (!item) return { ok: false, error: 'ไม่พบชิ้นงาน' };
  if (!item.brand_id) return { ok: false, error: 'ชิ้นนี้ยังไม่ได้เลือกแบรนด์' };
  if (['พร้อมโพสต์', 'โพสต์แล้ว'].includes(item.stage) && !opts.instruction) {
    return { ok: false, error: 'ชิ้นนี้ผ่านตรวจแล้ว · ถ้าจะให้ AI แก้ ให้สั่งผ่าน @AI ในแชท' };
  }

  const [{ data: placements }, { data: images }, { data: models }, { data: brand },
    { data: pillar }, { data: theme }, { data: questions }, { data: notes }, { data: chat }] = await Promise.all([
    db.from('placements').select('id,channel_id,hook,copy_text,first_comment,web_title,web_keyword,web_meta,human_edited,ai_copy_text,skipped_reason,published_at')
      .eq('item_id', itemId),
    db.from('item_images').select('url').eq('item_id', itemId).is('removed_at', null).order('position'),
    db.from('item_models').select('product_id').eq('item_id', itemId),
    supabase.schema('catalog').from('brands').select('name').eq('id', item.brand_id).maybeSingle(),
    item.pillar_id ? db.from('pillars').select('name').eq('id', item.pillar_id).maybeSingle() : Promise.resolve({ data: null }),
    item.theme_id ? db.from('themes').select('name,goal').eq('id', item.theme_id).maybeSingle() : Promise.resolve({ data: null }),
    db.from('agent_questions').select('question,answer').eq('item_id', itemId).order('created_at'),
    db.from('review_notes').select('part_label,note,done_at').eq('item_id', itemId).order('created_at', { ascending: false }).limit(10),
    db.from('messages').select('kind,body,created_at').eq('item_id', itemId).eq('kind', 'คน').order('created_at', { ascending: false }).limit(8),
  ]);

  const open = (questions ?? []).filter((q) => !q.answer);
  if (open.length > 0 && !opts.instruction) {
    return { ok: false, error: `agent ยังรอคำตอบอีก ${open.length} ข้อ · ตอบก่อนแล้ว agent จะเขียนต่อเอง` };
  }

  const live = (placements ?? []).filter((p) => !p.skipped_reason && !p.published_at);
  const force = new Set(opts.force ?? []);
  const targets = live.filter((p) => !p.human_edited || force.has(p.channel_id));
  if (targets.length === 0) {
    return { ok: false, error: 'ทุกช่องทางคนแก้เองแล้ว · agent ไม่เขียนทับ · ถ้าต้องการให้กด "ให้ AI เขียนช่องนี้ใหม่" หรือสั่ง @AI พร้อมชื่อช่องทาง' };
  }
  const targetIds = targets.map((t) => t.channel_id);
  const brain = await loadBrain(supabase, item.brand_id, targetIds);
  const facts = await productFacts(supabase, (models ?? []).map((m) => m.product_id));

  const edits = live.filter((p) => p.human_edited && p.ai_copy_text && p.ai_copy_text !== p.copy_text);
  const brief = [
    `# ชิ้นงาน`,
    `แบรนด์: ${brand?.name ?? '-'} · ประเภท: ${item.format} · ภาพ ${images?.length ?? 0} ภาพ`,
    `เรื่อง: ${item.title}`,
    `Hook: ${item.hook ?? '-'}`,
    `Key message: ${item.key_message ?? '-'}`,
    `Visual: ${item.visual ?? '-'}`,
    item.brief ? `Brief เพิ่มเติม: ${item.brief}` : '',
    pillar ? `Pillar: ${pillar.name}` : '',
    theme ? `ธีม: ${theme.name}${theme.goal ? ` · เป้าหมาย ${theme.goal}` : ''}` : '',
    '',
    '# ข้อมูลสินค้าจากระบบ',
    facts,
    '',
    questions?.length ? '# คำถามที่เคยถาม Bay และคำตอบ\n' + questions.map((q) => `- ${q.question} → ${q.answer ?? '(ยังไม่ตอบ)'}`).join('\n') : '',
    notes?.length ? '# เหตุผลที่ผู้ตรวจไม่ผ่าน (ล่าสุดก่อน)\n' + notes.map((n) => `- ${n.part_label}: ${n.note}${n.done_at ? ' (แก้แล้ว)' : ''}`).join('\n') : '',
    edits.length ? '# สิ่งที่คนแก้ในร่างของคุณ (เรียนจากตรงนี้)\n' + edits.map((e) =>
      `## ${channelName(e.channel_id)}\nร่างของ AI:\n${e.ai_copy_text}\n\nคนแก้เป็น:\n${e.copy_text}`).join('\n\n') : '',
    chat?.length ? '# แชทล่าสุดในงาน\n' + chat.reverse().map((m) => `- ${m.body}`).join('\n') : '',
    '',
    '# ข้อความปัจจุบันของแต่ละช่องทาง',
    ...live.map((p) => `## ${channelName(p.channel_id)} (${p.channel_id})${p.human_edited ? ' · คนแก้เองแล้ว' : ''}\n` +
      (p.copy_text ? `hook: ${p.hook ?? ''}\n${p.copy_text}` : '(ยังว่าง)')),
    '',
    '# งานของคุณ',
    opts.instruction
      ? `คนในทีมสั่งผ่านแชทว่า: "${opts.instruction}"\n` +
        `ถ้าเป็นคำสั่งให้แก้ข้อความ: decision = "write" และส่งเฉพาะช่องทางที่แก้ (ช่องที่แก้ได้: ${targetIds.join(', ')})\n` +
        `ถ้าเป็นคำถามหรือคุยเฉยๆ: decision = "reply" แล้วตอบใน note_to_team · channels = []`
      : `เขียนข้อความใหม่ให้ช่องทาง: ${targetIds.join(', ')} · ส่งครบทุกช่องในรายการนี้`,
    `ความยาว: Instagram ไม่เกิน ${LIMITS.instagram} ตัวอักษร · web_title ไม่เกิน ${LIMITS.web_title} · web_meta ไม่เกิน ${LIMITS.web_meta}`,
    'ช่อง web_title web_keyword web_meta ใช้กับ website เท่านั้น ช่องทางอื่นส่ง "" · first_comment ส่ง "" ถ้าไม่ใช้',
    'note_to_team: สรุปสั้นๆ 1-2 ประโยคถึงทีมว่าเขียนอะไรไป หรือตอบคำถาม',
  ].filter((l) => l !== '').join('\n');

  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  const key = images?.[0]?.url ?? item.source_url;
  if (key && isDirectImage(key)) content.push({ type: 'image', source: { type: 'url', url: key } });
  content.push({ type: 'text', text: brief });

  const res = await runClaude({
    supabase,
    kind: opts.kind ?? 'เขียนข้อความ',
    itemId,
    brandId: item.brand_id,
    instruction: opts.instruction ?? null,
    usedRefs: { brain: brain.refs, targets: targetIds },
    system: RULES + '\n\n' + brain.text,
    content,
    schema: WriteSchema,
    maxTokens: 16000,
    effort: 'medium',
  });
  if (!res.ok) return { ok: false, error: res.error };
  const out = res.data;
  const cite = out.used_refs.filter((r) => brain.refs[r]);
  const citeLine = cite.length ? `\nใช้: ${cite.join(' ')}` : '';

  // ข้อเสนอเข้าสมุด · รอ Bay ยืนยันเสมอ (Q-104)
  if (out.notebook_proposals.length) {
    await db.from('notebook').insert(out.notebook_proposals.filter((p) => p.body.trim()).map((p) => ({
      brand_id: p.this_brand_only ? item.brand_id : null,
      body: p.body.trim(),
      source: 'agent เสนอ',
      reason: p.reason || null,
      from_item_id: itemId,
      request_id: res.requestId,
    })));
  }

  if (out.decision === 'ask') {
    const qs = out.questions.filter((q) => q.question.trim()).slice(0, 3);
    if (qs.length === 0) return { ok: false, error: 'agent บอกว่าจะถามแต่ไม่มีคำถาม · ลองสั่งใหม่' };
    await db.from('agent_questions').insert(qs.map((q) => ({
      item_id: itemId, request_id: res.requestId, question: q.question.trim(), choices: q.choices.filter(Boolean).slice(0, 5),
    })));
    await supabase.schema('content').rpc('post_ai_message', {
      p_item_id: itemId,
      p_body: `ขอถามก่อนเขียน ${qs.length} ข้อ:\n` + qs.map((q, i) => `${i + 1}. ${q.question}`).join('\n'),
      p_part: null,
    });
    return { ok: true, status: 'asked', message: `agent ขอถามก่อน ${qs.length} ข้อ` };
  }

  if (out.decision === 'reply') {
    await supabase.schema('content').rpc('post_ai_message', { p_item_id: itemId, p_body: out.note_to_team || 'รับทราบ', p_part: null });
    return { ok: true, status: 'replied', message: 'agent ตอบในแชทแล้ว' };
  }

  // เขียนลงเฉพาะช่องที่อนุญาต · ช่องที่คนแก้เองและไม่ได้ขอ ไม่แตะ
  const written: string[] = [];
  for (const c of out.channels) {
    const p = targets.find((t) => t.channel_id === c.channel);
    if (!p || !c.copy_text.trim()) continue;
    const web = c.channel === 'website';
    const { error } = await db.from('placements').update({
      hook: c.hook.trim() || null,
      copy_text: c.copy_text.trim(),
      first_comment: c.first_comment.trim() || null,
      web_title: web ? c.web_title.trim() || null : null,
      web_keyword: web ? c.web_keyword.trim() || null : null,
      web_meta: web ? c.web_meta.trim() || null : null,
      human_edited: false,
      ai_copy_text: c.copy_text.trim(),
      ai_request_id: res.requestId,
    }).eq('id', p.id);
    if (error) return { ok: false, error: `บันทึก ${channelName(c.channel)} ไม่ได้: ${error.message}` };
    written.push(channelName(c.channel));
  }
  if (written.length === 0) return { ok: false, error: 'agent ไม่ได้เขียนช่องทางไหนเลย · ลองสั่งใหม่' };

  await supabase.schema('content').rpc('post_ai_message', {
    p_item_id: itemId,
    p_body: `เขียน ${written.join(' · ')} แล้ว${out.note_to_team ? `\n${out.note_to_team}` : ''}${citeLine}` +
      (out.notebook_proposals.length ? `\nเสนอเข้าสมุดความคิด ${out.notebook_proposals.length} ข้อ · รอ Bay ยืนยัน` : ''),
    p_part: null,
  });

  // ร่างเสร็จ + ภาพครบ → ส่งถึง Bay ตรวจเลย ไม่มีขั้นคนเกลา (Q-09b)
  if (item.stage === 'ไอเดีย') await db.from('items').update({ stage: 'กำลังทำ' }).eq('id', itemId);
  const imgs = images?.length ?? 0;
  const imagesReady = item.format === 'ข้อความล้วน' || (item.format === 'ภาพเดี่ยว' ? imgs === 1 : imgs >= 2);
  const allWritten = live.every((p) => p.copy_text || written.includes(channelName(p.channel_id)));
  if (['ไอเดีย', 'กำลังทำ'].includes(item.stage) && imagesReady && allWritten) {
    const { error } = await supabase.schema('content').rpc('submit_for_review', { p_item_id: itemId });
    if (!error) return { ok: true, status: 'submitted', message: `เขียน ${written.join(' · ')} แล้ว และส่งตรวจเลย` };
  }
  return {
    ok: true, status: 'written',
    message: `เขียน ${written.join(' · ')} แล้ว` + (imagesReady ? '' : ' · ยังรอภาพก่อนส่งตรวจ'),
  };
}

/** @AI ในแชท · ช่องทางที่ถูกเอ่ยชื่อตรงๆ = คนขอเอง เขียนทับได้แม้คนแก้แล้ว */
export function channelsNamedIn(text: string): string[] {
  const t = text.toLowerCase();
  const alias: Record<string, string[]> = {
    facebook: ['facebook', 'fb', 'เฟซ', 'เฟส'],
    instagram: ['instagram', 'ig', 'ไอจี', 'อินสตา'],
    website: ['website', 'web', 'blog', 'เว็บ', 'บล็อก', 'บทความ', 'seo'],
  };
  return PHASE1_CHANNELS.map((c) => c.id).filter((id) => alias[id].some((a) => new RegExp(`(^|[^a-z])${a}([^a-z]|$)`).test(t)));
}

// ── ไอเดียด่วน (Q-113–120) ────────────────────────────────────────────────────

const IdeaSchema = z.object({
  brand_id: z.string(),
  title: z.string(),
  hook: z.string(),
  key_message: z.string(),
  visual: z.string(),
  format: z.enum(['ข้อความล้วน', 'ภาพเดี่ยว', 'อัลบั้มภาพ']),
  channels: z.array(ChannelId),
  planned_on: z.string(),
  product_ids: z.array(z.string()),
  pillar_id: z.string(),
  questions: z.array(z.object({ question: z.string(), choices: z.array(z.string()) })),
  understanding: z.string(),
});
export type IdeaDraft = z.infer<typeof IdeaSchema>;

export async function parseIdea(supabase: Supa, text: string, imageUrls: string[]) {
  const [{ data: brands }, { data: products }, { data: pillars }] = await Promise.all([
    supabase.schema('catalog').from('brands').select('id,name'),
    supabase.schema('catalog').from('products').select('id,brand_id,collection,name_th,name_en').neq('status', 'เลิกขาย'),
    supabase.schema('content').from('pillars').select('id,brand_id,name').eq('active', true),
  ]);
  const today = todayBangkok();
  const prompt = [
    `วันนี้คือ ${today} (เวลาไทย)`,
    `ไอเดียจาก Bay: "${text}"`,
    `ภาพที่แนบมา: ${imageUrls.length} ภาพ${imageUrls.length ? ' · ' + imageUrls.join(' , ') : ''}`,
    '',
    '# แบรนด์',
    ...(brands ?? []).map((b) => `${b.id} · ${b.name}`),
    '',
    '# สินค้า (id · แบรนด์ · รุ่น · ชื่อ)',
    ...(products ?? []).map((p) => `${p.id} · ${p.brand_id} · ${p.collection} · ${p.name_th ?? ''} ${p.name_en ?? ''}`),
    '',
    '# Pillar ที่ใช้อยู่ (id · แบรนด์ · ชื่อ)',
    ...(pillars ?? []).map((p) => `${p.id} · ${p.brand_id} · ${p.name}`),
    '',
    '# แปลงไอเดียเป็นชิ้นงาน',
    '- brand_id: เลือกจากรายการ · ไม่ระบุให้ใช้แบรนด์ ฌ เฌอ',
    '- product_ids: เฉพาะรุ่นที่ไอเดียพูดถึงชัดเจน · ไม่แน่ใจอย่าเดา ให้ถามใน questions · ไม่มีก็ []',
    '- format: ภาพ 0 = ข้อความล้วน · 1 = ภาพเดี่ยว · 2 ขึ้นไป = อัลบั้มภาพ',
    '- channels: มีภาพ = facebook + instagram · ข้อความล้วนห้ามลง instagram (ใช้ facebook) · ถ้าพูดถึงเว็บ บล็อก บทความ หรือ SEO เพิ่ม website',
    '- planned_on: "วันนี้" = วันนี้ · ระบุวันก็ใช้วันนั้น · ไม่ระบุ = พรุ่งนี้ · รูปแบบ YYYY-MM-DD',
    '- pillar_id: ใส่เมื่อเข้ากับ pillar ของแบรนด์นั้นชัดเจน ไม่งั้น ""',
    '- title สั้น · hook ประโยคเปิดที่หยุดคนดู · key_message สิ่งที่อยากให้คนจำ · visual อธิบายภาพ',
    '- questions: ถ้าไอเดียอ้างสิ่งที่ระบบไม่มีข้อมูล (เช่น รุ่นนี้ mid century ตรงไหน) ถาม 1-2 ข้อพร้อมตัวเลือก · ห้ามเดา · ไม่มีก็ []',
    '- understanding: สรุป 1 ประโยคว่าเข้าใจว่าอะไร',
  ].join('\n');

  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  const img = imageUrls.find(isDirectImage);
  if (img) content.push({ type: 'image', source: { type: 'url', url: img } });
  content.push({ type: 'text', text: prompt });

  const res = await runClaude({
    supabase, kind: 'ไอเดียด่วน', instruction: text, usedRefs: { images: imageUrls },
    system: RULES, content, schema: IdeaSchema, maxTokens: 4000, effort: 'low',
  });
  if (!res.ok) return res;

  // กันรหัสที่ AI แต่งขึ้นเอง · ใช้ได้เฉพาะที่มีจริงในระบบ
  const d = res.data;
  const brandIds = new Set((brands ?? []).map((b) => b.id));
  if (!brandIds.has(d.brand_id)) d.brand_id = (brands ?? []).find((b) => b.name === 'ฌ เฌอ')?.id ?? (brands ?? [])[0]?.id ?? '';
  d.product_ids = d.product_ids.filter((id) => (products ?? []).some((p) => p.id === id && p.brand_id === d.brand_id));
  if (!(pillars ?? []).some((p) => p.id === d.pillar_id && p.brand_id === d.brand_id)) d.pillar_id = '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.planned_on)) d.planned_on = today;
  if (d.format === 'ข้อความล้วน') d.channels = d.channels.filter((c) => c !== 'instagram');
  d.channels = [...new Set(d.channels)];
  if (d.channels.length === 0) d.channels = ['facebook'];
  return { ok: true as const, data: d, requestId: res.requestId };
}

// ── สัมภาษณ์ brand model (Q-107) ─────────────────────────────────────────────

const InterviewSchema = z.object({
  kind: z.enum(['question', 'draft']),
  question: z.string(),
  choices: z.array(z.string()),
  draft: z.string(),
});

export async function interviewStep(supabase: Supa, sectionId: string) {
  const db = supabase.schema('content');
  const { data: sec } = await db.from('brand_sections').select('id,brand_id,kind,topic,guide,body').eq('id', sectionId).maybeSingle();
  if (!sec) return { ok: false as const, error: 'ไม่พบหัวข้อ' };
  const [{ data: brand }, { data: others }, { data: turns }] = await Promise.all([
    supabase.schema('catalog').from('brands').select('name').eq('id', sec.brand_id).maybeSingle(),
    db.from('brand_sections').select('topic,body').eq('brand_id', sec.brand_id).neq('id', sectionId).not('confirmed_at', 'is', null),
    db.from('interview_turns').select('role,body').eq('section_id', sectionId).order('created_at'),
  ]);
  const bayTurns = (turns ?? []).filter((t) => t.role === 'Bay').length;
  const prompt = [
    `# สัมภาษณ์ Bay (เจ้าของ) เพื่อเขียน ${sec.kind === 'model' ? 'brand model' : 'brand book'} ของแบรนด์ ${brand?.name ?? ''}`,
    `หัวข้อ: ${sec.topic}${sec.guide ? ` · ${sec.guide}` : ''}`,
    sec.body ? `ฉบับปัจจุบัน: ${sec.body}` : '',
    others?.length ? '# หัวข้ออื่นที่ Bay ยืนยันแล้ว\n' + others.map((o) => `- ${o.topic}: ${o.body}`).join('\n') : '',
    turns?.length ? '# บทสัมภาษณ์หัวข้อนี้\n' + turns.map((t) => `${t.role}: ${t.body}`).join('\n') : '',
    '',
    '# งานของคุณ',
    '- ถามทีละ 1 ข้อ สั้น เป็นกันเอง ภาษาพูด · ให้ตัวเลือก 2-4 ข้อที่แตะตอบได้ (Bay พิมพ์เองก็ได้)',
    `- Bay ตอบไปแล้ว ${bayTurns} ข้อ · พอเขียนได้แล้ว (ปกติ 2-3 ข้อ ไม่เกิน 5) ให้ kind = "draft" แล้วเขียนหัวข้อนี้ 2-5 ประโยค ใช้คำของ Bay เป็นหลัก ห้ามแต่งเพิ่ม`,
    '- kind = "question": ใส่ question + choices · draft = ""',
    '- kind = "draft": ใส่ draft · question = "" · choices = []',
  ].filter(Boolean).join('\n');

  const res = await runClaude({
    supabase, kind: 'สัมภาษณ์', brandId: sec.brand_id, instruction: sec.topic, usedRefs: { section: sectionId },
    system: 'คุณคือนักวางกลยุทธ์แบรนด์ที่กำลังสัมภาษณ์เจ้าของแบรนด์เฟอร์นิเจอร์ไทย · ฟังมากกว่าพูด · ไม่แต่งสิ่งที่เจ้าของไม่ได้พูด',
    content: [{ type: 'text', text: prompt }], schema: InterviewSchema, maxTokens: 3000, effort: 'low',
  });
  if (!res.ok) return res;
  const d = res.data;
  await db.from('interview_turns').insert({
    section_id: sectionId,
    role: 'AI',
    body: d.kind === 'draft' ? 'ร่าง: ' + d.draft : d.question,
    choices: d.kind === 'draft' ? [] : d.choices.slice(0, 4),
    request_id: res.requestId,
  });
  return { ok: true as const, data: d };
}

// ── แฟ้มคู่แข่ง (H16) ─────────────────────────────────────────────────────────

const SwipeSchema = z.object({ summary: z.string(), hook_type: z.string() });

/** สรุปโพสต์คู่แข่งจากข้อความที่ทีมแปะ · agent เปิดลิงก์ Facebook/IG เองไม่ได้ */
export async function summarizeSwipe(supabase: Supa, swipeId: string) {
  const db = supabase.schema('content');
  const { data: s } = await db.from('swipes').select('id,brand_id,url,competitor,seen_text,note').eq('id', swipeId).maybeSingle();
  if (!s) return { ok: false as const, error: 'ไม่พบโพสต์ในแฟ้ม' };
  if (!s.seen_text?.trim() && !s.note?.trim()) {
    return { ok: false as const, error: 'แปะข้อความ/แคปชันที่เห็นในโพสต์ก่อน · agent เปิดลิงก์ Facebook/IG เองไม่ได้' };
  }
  const res = await runClaude({
    supabase, kind: 'สรุปคู่แข่ง', brandId: s.brand_id, instruction: s.url, usedRefs: { swipe: swipeId },
    system: 'คุณคือนักการตลาดคอนเทนต์ของแบรนด์เฟอร์นิเจอร์ไทย · สรุปโพสต์ของคู่แข่งให้ทีมเรียนรู้ · สรุปจากข้อความที่ให้มาเท่านั้น ห้ามเดาสิ่งที่ไม่เห็น',
    content: [{ type: 'text', text: [
      `คู่แข่ง: ${s.competitor ?? '-'}`, `ลิงก์: ${s.url}`,
      `ข้อความในโพสต์:\n${s.seen_text ?? '-'}`, s.note ? `ทีมสังเกตว่า: ${s.note}` : '',
      '',
      'summary: 2-3 ประโยค เขาเล่นเรื่องอะไร ขายอะไร ทำไมน่าสนใจ และเราหยิบอะไรไปใช้ได้',
      'hook_type: ชนิดของ hook สั้นๆ เช่น "ตั้งคำถาม" "ตัวเลข" "เปรียบเทียบก่อน-หลัง" "เล่าเรื่องลูกค้า" "ขัดความเชื่อ"',
    ].filter(Boolean).join('\n') }],
    schema: SwipeSchema, maxTokens: 2000, effort: 'low',
  });
  if (!res.ok) return res;
  await db.from('swipes').update({ summary: res.data.summary, hook_type: res.data.hook_type, request_id: res.requestId }).eq('id', swipeId);
  return { ok: true as const };
}

// ── ไอเดียจาก agent สัปดาห์นี้ (H19) ───────────────────────────────────────────

const IdeasSchema = z.object({
  ideas: z.array(z.object({ title: z.string(), hook: z.string(), reason: z.string(), product_ids: z.array(z.string()) })),
});

/** คิด 3 ไอเดียจาก สินค้าที่ไม่ได้พูดถึง + แฟ้มคู่แข่ง + brand model */
export async function suggestIdeas(
  supabase: Supa, brandId: string, weekOf: string, stale: { id: string; name: string; last: string | null }[],
) {
  const db = supabase.schema('content');
  const [brain, { data: brand }, { data: swipes }, { data: recent }] = await Promise.all([
    loadBrain(supabase, brandId, []),
    supabase.schema('catalog').from('brands').select('name').eq('id', brandId).maybeSingle(),
    db.from('swipes').select('competitor,summary,hook_type').is('archived_at', null).not('summary', 'is', null)
      .order('created_at', { ascending: false }).limit(8),
    db.from('items').select('title,hook').eq('brand_id', brandId).order('created_at', { ascending: false }).limit(15),
  ]);
  const pool = stale.slice(0, 20);
  const res = await runClaude({
    supabase, kind: 'คิดไอเดีย', brandId, usedRefs: { brain: brain.refs, products: pool.map((p) => p.id) },
    system: RULES + '\n\n' + brain.text,
    content: [{ type: 'text', text: [
      `# คิดไอเดียคอนเทนต์ 3 ชิ้นสำหรับแบรนด์ ${brand?.name ?? ''} สัปดาห์นี้`,
      '',
      '# สินค้าที่ไม่ได้พูดถึงนาน (id · ชื่อ · ลงล่าสุด)',
      ...(pool.length ? pool.map((p) => `${p.id} · ${p.name} · ${p.last ?? 'ไม่เคย'}`) : ['(ไม่มี)']),
      '',
      '# สรุปโพสต์คู่แข่งที่ทีมเก็บไว้',
      ...(swipes?.length ? swipes.map((s) => `- ${s.competitor ?? '?'} · ${s.hook_type ?? ''} · ${s.summary}`) : ['(ยังไม่มี)']),
      '',
      '# ชิ้นที่ทำไปแล้วล่าสุด (อย่าซ้ำ)',
      ...(recent?.length ? recent.map((r) => `- ${r.hook || r.title}`) : ['(ยังไม่มี)']),
      '',
      '# งานของคุณ',
      '- 3 ไอเดีย · อย่างน้อย 2 ไอเดียหยิบสินค้าจากรายการด้านบน · ใส่ product_ids เฉพาะ id ในรายการ',
      '- title สั้น · hook ประโยคเปิดที่หยุดคนดู · reason 1 ประโยคว่าทำไมควรทำสัปดาห์นี้',
      '- ห้ามอ้างสเปกที่ไม่รู้ · ห้ามสัญญาโปรโมชัน',
    ].join('\n') }],
    schema: IdeasSchema, maxTokens: 4000, effort: 'low',
  });
  if (!res.ok) return res;
  const valid = new Set(pool.map((p) => p.id));
  const rows = res.data.ideas.slice(0, 3).filter((i) => i.title.trim()).map((i) => ({
    brand_id: brandId, week_of: weekOf, title: i.title.trim(), hook: i.hook.trim() || null, reason: i.reason.trim() || null,
    product_ids: i.product_ids.filter((id) => valid.has(id)), request_id: res.requestId,
  }));
  const { error } = await db.from('idea_suggestions').insert(rows);
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}
