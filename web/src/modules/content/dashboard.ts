/**
 * ข้อมูลหน้าแรกคอนเทนต์ (R5 · ก5) · ฝั่งเซิร์ฟเวอร์เท่านั้น
 * ทุกกล่องคำนวณจากข้อมูลที่มีอยู่แล้ว ไม่เก็บตัวเลขสำเร็จ (A10)
 */
import { createClient } from '@/lib/supabase/server';
import type { AgentQuestion, NotebookEntry, Stage } from './types';

export type DashItem = { id: string; title: string; hook: string | null; stage: Stage };
export type Waiting = DashItem & { submitted_at: string | null; next_on: string | null };
export type DayRow = { date: string; items: (DashItem & { channels: string[]; risk: boolean })[] };
export type Mention = { id: string; item_id: string; item: string; body: string; created_at: string; unread: boolean };
export type PillarShare = { id: string; name: string; color: string; now: number; prev: number };
export type StaleProduct = { id: string; name: string; last: string | null };
export type Swipe = {
  id: string; url: string; competitor: string | null; seen_text: string | null; note: string | null;
  summary: string | null; hook_type: string | null; created_at: string;
};
export type Suggestion = {
  id: string; brand_id: string; title: string; hook: string | null; reason: string | null;
  product_ids: string[]; status: 'เสนอ' | 'เอา' | 'ไม่เอา';
};

const addDays = (s: string, n: number) => {
  const [y, m, d] = s.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
};
export const todayBangkok = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date());
/** วันจันทร์ของสัปดาห์ (ไอเดียจาก agent เป็นชุดรายสัปดาห์) */
export const mondayOf = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return addDays(s, -((dow + 6) % 7));
};

export async function getDashboard(me: string, brandId: string | null) {
  const supabase = await createClient();
  const db = supabase.schema('content');
  const today = todayBangkok();
  const monthStart = today.slice(0, 8) + '01';
  const prevStart = (() => { const [y, m] = today.split('-').map(Number); return m === 1 ? `${y - 1}-12-01` : `${y}-${String(m - 1).padStart(2, '0')}-01`; })();

  const [
    { data: items }, { data: placements }, { data: versions }, { data: questions }, { data: notes },
    { data: mentions }, { data: reads }, { data: pillars }, { data: links }, { data: products },
    { data: swipes }, { data: ideas },
  ] = await Promise.all([
    db.from('items').select('id,title,hook,stage,brand_id,pillar_id,owner_id,created_by,updated_at')
      .in('format', ['ข้อความล้วน', 'ภาพเดี่ยว', 'อัลบั้มภาพ']).neq('stage', 'พับไว้'),
    db.from('placements').select('item_id,channel_id,planned_on,published_at').is('skipped_reason', null),
    db.from('item_versions').select('item_id,submitted_at').order('submitted_at', { ascending: false }),
    db.from('agent_questions').select('id,item_id,question,choices,answer,answered_at,created_at').is('answered_at', null).order('created_at'),
    db.from('notebook').select('id,brand_id,body,source,status,reason,from_item_id,created_at').eq('status', 'รอยืนยัน').order('created_at'),
    db.from('messages').select('id,item_id,body,created_at').contains('mentions', [me])
      .gte('created_at', addDays(today, -30)).order('created_at', { ascending: false }).limit(20),
    db.from('message_reads').select('item_id,last_read_at').eq('user_id', me),
    db.from('pillars').select('id,brand_id,name,color,active'),
    db.from('item_models').select('item_id,product_id'),
    supabase.schema('catalog').from('products').select('id,brand_id,collection,name_th').neq('status', 'เลิกขาย'),
    db.from('swipes').select('id,brand_id,url,competitor,seen_text,note,summary,hook_type,created_at')
      .is('archived_at', null).order('created_at', { ascending: false }).limit(6),
    db.from('idea_suggestions').select('id,brand_id,title,hook,reason,product_ids,status')
      .eq('week_of', mondayOf(today)).order('created_at'),
  ]);

  const inBrand = <T extends { brand_id: string | null }>(x: T) => !brandId || x.brand_id === brandId || x.brand_id === null;
  const its = (items ?? []).filter((i) => !brandId || i.brand_id === brandId);
  const byId = new Map(its.map((i) => [i.id, i]));
  const pls = (placements ?? []).filter((p) => byId.has(p.item_id));
  const dash = (i: typeof its[number]): DashItem => ({ id: i.id, title: i.title, hook: i.hook, stage: i.stage as Stage });

  // H1 รอตรวจ · รอนานสุดก่อน
  const submitted = new Map<string, string>();
  for (const v of versions ?? []) if (!submitted.has(v.item_id)) submitted.set(v.item_id, v.submitted_at);
  const nextOn = (id: string) => pls.filter((p) => p.item_id === id && p.planned_on && !p.published_at)
    .map((p) => p.planned_on as string).sort()[0] ?? null;
  const waiting: Waiting[] = its.filter((i) => i.stage === 'รอตรวจ')
    .map((i) => ({ ...dash(i), submitted_at: submitted.get(i.id) ?? i.updated_at, next_on: nextOn(i.id) }))
    .sort((a, b) => (a.submitted_at ?? '').localeCompare(b.submitted_at ?? ''));

  // H2 agent ถาม · พร้อมชื่องาน
  const asks = ((questions ?? []) as AgentQuestion[]).filter((q) => byId.has(q.item_id))
    .map((q) => ({ ...q, item: byId.get(q.item_id)!.hook || byId.get(q.item_id)!.title }));

  // H5 7 วันข้างหน้า · เสี่ยง = อีก ≤ 2 วันจะลงแต่ยังไม่ผ่านตรวจ
  const week: DayRow[] = Array.from({ length: 7 }, (_, n) => {
    const date = addDays(today, n);
    const ids = [...new Set(pls.filter((p) => p.planned_on === date).map((p) => p.item_id))];
    return {
      date,
      items: ids.map((id) => {
        const i = byId.get(id)!;
        const ch = pls.filter((p) => p.item_id === id && p.planned_on === date);
        const done = ['พร้อมโพสต์', 'โพสต์แล้ว'].includes(i.stage);
        return { ...dash(i), channels: ch.map((p) => p.channel_id), risk: n <= 2 && !done && ch.some((p) => !p.published_at) };
      }),
    };
  });

  // @ถึงฉัน
  const lastRead = new Map((reads ?? []).map((r) => [r.item_id, r.last_read_at as string]));
  const mine: Mention[] = (mentions ?? []).filter((m) => byId.has(m.item_id)).map((m) => ({
    id: m.id, item_id: m.item_id, body: m.body, created_at: m.created_at,
    item: byId.get(m.item_id)!.hook || byId.get(m.item_id)!.title,
    unread: !lastRead.get(m.item_id) || m.created_at > lastRead.get(m.item_id)!,
  }));

  // H9 สัดส่วน pillar เดือนนี้ เทียบเดือนก่อน · นับชิ้นงานที่มีวันลงในเดือนนั้น
  const countIn = (from: string, to: string) => {
    const c = new Map<string, number>();
    const seen = new Set<string>();
    for (const p of pls) {
      if (!p.planned_on || p.planned_on < from || p.planned_on >= to || seen.has(p.item_id)) continue;
      seen.add(p.item_id);
      const k = byId.get(p.item_id)!.pillar_id ?? '';
      c.set(k, (c.get(k) ?? 0) + 1);
    }
    return c;
  };
  const nextMonth = (() => { const [y, m] = today.split('-').map(Number); return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`; })();
  const now = countIn(monthStart, nextMonth);
  const prev = countIn(prevStart, monthStart);
  const share: PillarShare[] = [
    ...(pillars ?? []).filter((p) => inBrand(p) && (p.active || now.has(p.id) || prev.has(p.id)))
      .map((p) => ({ id: p.id, name: p.name, color: p.color, now: now.get(p.id) ?? 0, prev: prev.get(p.id) ?? 0 })),
    { id: '', name: 'ไม่ผูก pillar', color: 'var(--border)', now: now.get('') ?? 0, prev: prev.get('') ?? 0 },
  ].filter((p) => p.now || p.prev || p.id);

  // H10 สินค้าที่ไม่มีคอนเทนต์เกิน 60 วัน · ไม่เคยมีเลยขึ้นก่อน
  const lastOf = new Map<string, string>();
  for (const l of links ?? []) {
    const d = pls.filter((p) => p.item_id === l.item_id && p.planned_on).map((p) => p.planned_on as string).sort().pop();
    if (d && (!lastOf.get(l.product_id) || d > lastOf.get(l.product_id)!)) lastOf.set(l.product_id, d);
  }
  const cutoff = addDays(today, -60);
  const stale: StaleProduct[] = (products ?? []).filter(inBrand)
    .map((p) => ({ id: p.id, name: `${p.collection}${p.name_th ? ` ${p.name_th}` : ''}`, last: lastOf.get(p.id) ?? null }))
    .filter((p) => !p.last || p.last < cutoff)
    .sort((a, b) => (a.last ?? '').localeCompare(b.last ?? ''));

  // Q-125 งานของฉัน (การตลาด)
  const mineItems = its.filter((i) => i.created_by === me || i.owner_id === me);
  const bounced = mineItems.filter((i) => i.stage === 'ตีกลับแก้').map(dash);
  const doing = mineItems.filter((i) => ['ไอเดีย', 'กำลังทำ'].includes(i.stage)).map(dash);

  return {
    today,
    waiting,
    asks,
    notebook: (notes ?? []) as NotebookEntry[],
    week,
    mentions: mine,
    share,
    stale,
    staleTotal: stale.length,
    swipes: ((swipes ?? []).filter(inBrand)) as Swipe[],
    ideas: ((ideas ?? []).filter((i) => !brandId || i.brand_id === brandId)) as Suggestion[],
    bounced,
    doing,
  };
}
