/**
 * เขียนคำตอบจากข้อมูลในระบบ · โค้ดเขียน ไม่ใช่ AI (LR-24)
 * ทุกตัวเลข วันที่ เลขงาน ชื่อสินค้า มาจากฐานข้อมูลตรงๆ · ทุกคำตอบบอกที่มา (LR-16 · LR-25)
 * ข้อมูลมาจาก 2 ที่: ระบบ (ลงในเว็บ) และชีต (ดึงจาก Google Sheet · 0035) · ระบบชนะถ้าเลขซ้ำ
 */
import { call } from './db';
import type { Intent } from './intent';

const TH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const MAX_ROWS = 10;
export const LEAD_DAYS = 45;   // Bay 2026-11-02 · "งานสั่งผลิตไม่เกิน 45 วัน"

function todayBkk(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date());
}
function addDays(iso: string, n: number) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function daysFromToday(iso: string) {
  return Math.round((Date.parse(iso + 'T00:00:00Z') - Date.parse(todayBkk() + 'T00:00:00Z')) / 864e5);
}
export function thDate(iso: string | null | undefined) {
  if (!iso) return 'ยังไม่ระบุ';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return `${d} ${TH[m - 1]} ${String((y + 543) % 100).padStart(2, '0')}`;
}
function stamp(iso: string | null | undefined) {
  if (!iso) return '';
  const t = new Date(iso);
  const time = new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' }).format(t);
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(t);
  return ` · อัปเดต ${thDate(day)} ${time}`;
}
const src = (s: string, updated?: string | null) => `\n— ดูจาก: ${s}${stamp(updated)}`;
const qty = (n: number | null) => (n == null ? '—' : Number.isInteger(Number(n)) ? String(Number(n)) : String(n));
const baht = (n: number | null | undefined) => (n == null ? null : Number(n).toLocaleString('th-TH', { maximumFractionDigits: 2 }));

export type Flags = {
  see_price: boolean; see_customer: boolean; see_money: boolean; see_address: boolean;
  customer_draft: boolean; draft_polite: 'ค่ะ' | 'ครับ'; can_slip: boolean; can_photo: boolean;
};
export type Ctx = { groupId: string; flags: Flags };

type Order = {
  source: 'ระบบ' | 'ชีต'; order_no: string; label?: string | null; wo: string | null; doc_status: string | null;
  required_finish_on: string | null; promised_delivery_on: string | null; delivery_text: string | null;
  items_text?: string | null; updated_at: string | null;
  photos?: number; photo_last?: string | null;
  customer_name?: string | null; total_sales?: number | null; balance?: number | null; delivery_text_full?: string | null;
  lines: { line_no: number; description: string; note: string | null; qty: number | null; unit_price: number | null }[];
};
type DueRow = {
  order_no: string; wo: string | null; due_on: string; due_kind: 'ต้องเสร็จ' | 'ส่ง';
  first_item: string | null; item_count: number; source: string; customer_name?: string | null;
};
type StockRow = { kind: string; item: string; location: string | null; status: string | null; units: number | null; source: string; exact?: boolean };
type PriceList = { hidden?: boolean; exact: boolean; total: number;
  items: { name: string; list_price: number | null; disc_pct: number | null; price: number | null; approved: boolean }[] };
type Clearance = {
  hidden?: boolean;
  exact?: boolean;
  expires_on: string | null; expired: boolean; updated_at: string | null; total: number;
  items: { name: string; retail: number | null; disc: string | null; price: number | null }[];
};

const woText = (o: { wo: string | null }) => {
  const w = (o.wo ?? '').trim();
  if (!w || /^รอ/.test(w)) return 'ยังไม่ออก w/o' + (w && w !== 'รอ' ? ` (${w})` : '');
  if (/^\d+\s*\/\s*\d+$/.test(w)) return `ส่งเข้าผลิตแล้ว (w/o ${w.replace(/\s/g, '')})`;
  return `w/o: ${w}`;                    // s/s · ออก S/S ฯลฯ ตามที่ชีตเขียน ไม่ตีความเอง
};
const shortItem = (s: string | null) => (s ?? '').replace(/^ฌ\s*เฌอ\s*\|\s*/, '').split(/·|\|/)[0].replace(/\s+/g, ' ').trim().slice(0, 50);
const fromWhere = (o: { source: string }, what: string) => (o.source === 'ชีต' ? `Google Sheet · ${what}` : `ระบบ · ${what}`);
const bls = (s: string | null) => {
  const x = (s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return /^\d/.test(x) ? 'BLS' + x : x;
};

export const HELP =
  'ผมช่วยได้ครับ · พิมพ์ @Team Bay ตามด้วย\n' +
  '• เลข BLS → รายละเอียด ราคา w/o วันส่ง\n' +
  '• "สัปดาห์นี้ต้องส่งอะไรบ้าง" / "งานไหนเลยกำหนด"\n' +
  '• ชื่อรุ่น ชื่อผ้า ชื่อหนัง + "มีในสต็อกไหม"\n' +
  '• "ราคา kiwi armchair" (ราคามาตรฐาน) · "clearance ขุนทอง"\n' +
  '• "ผลิตกี่วัน"\n' +
  '• ส่งรูปสลิป (กี่รูปก็ได้) แล้วพิมพ์ "@Team Bay สลิป" ภายใน 10 นาที (กลุ่มที่เปิดไว้)\n' +
  '• ส่งรูปงานเสร็จ (กี่รูปก็ได้) แล้วพิมพ์ "@Team Bay งานเสร็จ BLS3230" ภายใน 10 นาที\n' +
  'ถามหลายเรื่องในข้อความเดียวได้ · ผมตอบจากระบบและชีตเท่านั้น ไม่ตัดสินแทนทีมครับ';

export type Rendered = { answer: string; dataUsed: string; status: 'ตอบแล้ว' | 'ตอบไม่ได้' | 'ส่งต่อทีม' };

/** ข้อความพร้อมส่งลูกค้า · โค้ดเขียนตัวเลขและวันที่ (LR-24) · คนก๊อปไปส่งเอง (กฎ AI 1) */
function draft(o: Order, p: 'ค่ะ' | 'ครับ', ask: 'status' | 'dates') {
  const who = 'คุณลูกค้า';
  const st = (o.photos ?? 0) > 0 ? `ผลิตเสร็จแล้ว อยู่ระหว่างเตรียมจัดส่ง${p}`
    : /^\d+\s*\/\s*\d+$/.test((o.wo ?? '').trim()) ? `อยู่ระหว่างการผลิต${p}`
    : `อยู่ระหว่างเตรียมเข้าการผลิต${p}`;
  const safe = o.delivery_text && o.delivery_text !== 'ดูในชีต' ? o.delivery_text : null;
  const ship = o.promised_delivery_on ? `กำหนดส่งวันที่ ${thDate(o.promised_delivery_on)}${p}`
    : safe ? `กำหนดส่ง ${safe}${p}` : `ทางเราจะแจ้งวันส่งให้ทราบอีกครั้ง${p}`;
  const body = ask === 'dates' ? `ออเดอร์ ${o.order_no} ${ship}` : `ออเดอร์ ${o.order_no} ตอนนี้${st}\n${ship}`;
  return `\n\n📋 ก็อปส่งลูกค้า\nสวัสดี${p} ${who}\n${body}\nหากมีความคืบหน้า ทางเราจะแจ้งให้ทราบ${p} ขอบคุณ${p} 🙏`;
}

async function one(it: Intent, ctx: Ctx): Promise<Rendered> {
  const f = ctx.flags;
  switch (it.intent) {
    case 'help':
      return { answer: HELP, dataUsed: '—', status: 'ตอบแล้ว' };

    case 'secret':
      return { answer: 'ข้อมูลนี้ไม่มีในห้องนี้ครับ (ต้นทุน กำไร' + (f.see_customer ? '' : ' ข้อมูลลูกค้า') + ')\nทีม CC ดูได้ในระบบครับ', dataUsed: '—', status: 'ตอบไม่ได้' };

    case 'handoff':
      return {
        answer: `รับเรื่องครับ${it.order_no ? ` (${bls(it.order_no)})` : ''}\nเรื่องนี้ต้องให้ทีม CC ตัดสิน รบกวนทีม CC ช่วยตอบด้วยครับ`,
        dataUsed: '—', status: 'ส่งต่อทีม',
      };

    case 'lead_time':
      return it.rush
        ? { answer: `งานสั่งผลิตมาตรฐานไม่เกิน ${LEAD_DAYS} วันครับ\nลูกค้ารีบ · รบกวนทีม ASE ช่วยตอบว่าเร็วสุดทำได้กี่วันครับ`, dataUsed: '—', status: 'ส่งต่อทีม' }
        : { answer: `งานสั่งผลิตมาตรฐานไม่เกิน ${LEAD_DAYS} วันครับ\n(ถ้าลูกค้ารีบ ถามว่า "รีบ ได้เร็วสุดกี่วัน" ผมจะส่งต่อทีม ASE)`, dataUsed: '—', status: 'ตอบแล้ว' };

    case 'order_detail':
    case 'order_dates':
    case 'order_status': {
      if (!it.order_no) return { answer: 'ขอเลข BLS ด้วยครับ เช่น "BLS3230 รายละเอียด"', dataUsed: '—', status: 'ตอบไม่ได้' };
      const o = await call<Order | null>('room_order', { p_order_no: it.order_no, p_group_id: ctx.groupId });
      if (!o) {
        return { answer: `ยังไม่มี ${bls(it.order_no)} ทั้งในระบบและในชีตครับ\nเลขถูกไหมครับ`, dataUsed: 'room_order', status: 'ตอบไม่ได้' };
      }
      const cust = o.customer_name ? ` · ${o.customer_name}` : '';
      const head = `${o.order_no}${o.label ? ` (${o.label})` : ''}${cust}`;
      const money = o.total_sales != null || o.balance != null
        ? `\n💰 ยอดขาย ${baht(o.total_sales) ?? '—'} · ค้าง ${baht(o.balance) ?? '—'} (ตามชีต)` : '';
      const pics = (o.photos ?? 0) > 0 ? `\n📷 มีรูปงานเสร็จ ${o.photos} รูป (ล่าสุด ${thDate(o.photo_last?.slice(0, 10))})` : '';
      const addr = o.delivery_text_full && o.delivery_text_full !== o.delivery_text ? `\n📍 ${o.delivery_text_full}` : '';
      const d2 = (k: 'status' | 'dates') => (f.customer_draft ? draft(o, f.draft_polite, k) : '');
      const warn = o.doc_status === 'ยกเลิก' ? '\n⚠️ ออเดอร์นี้ถูกยกเลิกแล้ว' : o.doc_status === 'ร่าง' ? '\n⚠️ ยังเป็นใบร่าง ยังไม่ยืนยัน' : '';
      const ship = o.promised_delivery_on
        ? `กำหนดส่ง ${thDate(o.promised_delivery_on)}${(() => { const d = daysFromToday(o.promised_delivery_on!); return d < 0 ? ` (เลยมา ${-d} วัน)` : d === 0 ? ' (วันนี้)' : ` (อีก ${d} วัน)`; })()}`
        : `กำหนดส่ง ${o.delivery_text ?? 'ยังไม่ระบุ'}`;
      const finish = o.required_finish_on ? `\nต้องผลิตเสร็จ ${thDate(o.required_finish_on)}` : '';

      if (it.intent === 'order_dates') {
        return { answer: `${head}${warn}${finish}\n${ship}${addr}` + src(fromWhere(o, 'กำหนดส่ง'), o.updated_at) + d2('dates'), dataUsed: 'room_order', status: 'ตอบแล้ว' };
      }
      if (it.intent === 'order_status') {
        return {
          answer: `${head} · ${woText(o)}${warn}${finish}\n${ship}${pics}${money}`
            + ((o.photos ?? 0) > 0 ? '' : '\nยังไม่มีรูปงานเสร็จในระบบครับ')
            + src(fromWhere(o, 'ช่อง w/o'), o.updated_at) + d2('status'),
          dataUsed: 'room_order', status: 'ตอบแล้ว',
        };
      }
      let body: string;
      if (o.lines.length > 0) {
        body = o.lines.slice(0, MAX_ROWS).map((l, i) => {
          const price = baht(l.unit_price);
          return `${i + 1}. ${l.description}${l.note ? `\n   📝 ${l.note}` : ''}\n   จำนวน ${qty(l.qty)}${price ? ` · ราคา/หน่วย ${price}` : ''}`;
        }).join('\n');
        if (o.lines.length > MAX_ROWS) body += `\n…และอีก ${o.lines.length - MAX_ROWS} รายการ`;
      } else if (o.items_text) {
        body = o.items_text.split('\n').slice(0, MAX_ROWS).map((x) => '• ' + x).join('\n') + '\n(ยังไม่มีใบ PO ในชีต · ใช้ช่องรายการแทน)';
      } else {
        body = '(ยังไม่มีรายการ)';
      }
      const what = o.source === 'ชีต' ? (o.lines.length ? 'ใบ PO + Order Tracking' : 'Order Tracking') : 'ออเดอร์';
      return { answer: `${head} · ${woText(o)}${warn}\n${body}\n${ship}${addr}${money}${pics}` + src(fromWhere(o, what), o.updated_at) + d2('status'), dataUsed: 'room_order', status: 'ตอบแล้ว' };
    }

    case 'orders_due':
    case 'orders_overdue': {
      const today = todayBkk();
      const days = Math.min(Math.max(Math.round(it.days ?? 7), 0), 60);
      const over = it.intent === 'orders_overdue';
      const [rows, undated] = await Promise.all([
        over ? call<DueRow[]>('room_orders_overdue', { p_group_id: ctx.groupId })
          : call<DueRow[]>('room_orders_due', { p_from: today, p_to: addDays(today, days), p_group_id: ctx.groupId }),
        call<number>('room_orders_undated'),
      ]);
      const head = over ? 'งานที่เลยกำหนด (ย้อน 30 วัน)' : days === 0 ? 'งานวันนี้' : `งานใน ${days} วันข้างหน้า`;
      const note = undated > 0 ? `\n(อีก ${undated} งานในชีตเขียนกำหนดส่งเป็นข้อความ เช่น "ปลายเดือน" จึงไม่นับรวม)` : '';
      if (rows.length === 0) return { answer: `${head}\nไม่มีครับ${note}` + src('ระบบ + Google Sheet'), dataUsed: 'room_orders', status: 'ตอบแล้ว' };
      const list = rows.slice(0, MAX_ROWS).map((r) => {
        const d = daysFromToday(r.due_on);
        const late = d < 0 ? ` (เลย ${-d} วัน)` : '';
        const more = r.item_count > 1 ? ` +${r.item_count - 1}` : '';
        return `• ${thDate(r.due_on)} ${r.due_kind}${late} · ${r.order_no}${r.customer_name ? ` (${r.customer_name})` : ''} · ${shortItem(r.first_item)}${more} · ${woText(r)}`;
      }).join('\n');
      const more = rows.length > MAX_ROWS ? `\n…และอีก ${rows.length - MAX_ROWS} งาน` : '';
      const done = over ? '\nระบบยังไม่รู้ว่างานไหนส่งแล้ว ทีมช่วยยืนยันได้ครับ' : '';
      return { answer: `${head} (${rows.length} งาน)\n${list}${more}${done}${note}` + src('ระบบ + Google Sheet'), dataUsed: 'room_orders', status: 'ตอบแล้ว' };
    }

    case 'stock': {
      const q = (it.query ?? '').trim();
      if (!q) return { answer: 'ขอชื่อรุ่น ชื่อผ้า หรือชื่อหนังด้วยครับ เช่น "Koontong มีในสต็อกไหม"', dataUsed: '—', status: 'ตอบไม่ได้' };
      const rows = await call<StockRow[]>('room_stock', { p_query: q });
      if (rows.length === 0) return { answer: `ไม่มีรุ่น "${q}" ในสต็อกเลยครับ (ทั้งชีตและระบบ) · ลองพิมพ์แค่ชื่อรุ่น เช่น "kiwi"`, dataUsed: 'room_stock', status: 'ตอบไม่ได้' };
      const near = rows.some((r) => r.exact === false) ? `ไม่เจอ "${q}" ตรงทุกคำ · ใกล้เคียงที่สุด:\n` : '';
      const list = rows.slice(0, MAX_ROWS).map((r) => {
        if (r.kind === 'วัสดุ') return `• ${r.item} · ${r.units != null ? `คงเหลือ ${qty(r.units)}` : r.status ?? '—'}`;
        if (r.source === 'ชีต') return `• ${r.item}\n   คงเหลือ ${qty(r.units)}${r.location ? ` · ${r.location}` : ''}`;
        return `• ${r.item}\n   ${qty(r.units)} ตัว · ${r.location} · ${r.status}`;
      }).join('\n');
      const more = rows.length > MAX_ROWS ? `\n…และอีก ${rows.length - MAX_ROWS} รายการ` : '';
      return { answer: near + list + more + src('สต็อก (ระบบ + Google Sheet)'), dataUsed: 'room_stock', status: 'ตอบแล้ว' };
    }

    case 'product_price': {
      const q = (it.query ?? '').trim();
      if (!q) return { answer: 'ขอชื่อรุ่นด้วยครับ เช่น "ราคา kiwi armchair"', dataUsed: '—', status: 'ตอบไม่ได้' };
      const p = await call<PriceList | null>('room_price', { p_query: q, p_group_id: ctx.groupId });
      if (p?.hidden) return { answer: 'กลุ่มนี้ไม่ได้เปิดให้ดูราคาครับ · ถามในกลุ่ม PO ได้ครับ', dataUsed: '—', status: 'ตอบไม่ได้' };
      if (!p || p.items.length === 0) return { answer: `ไม่มีรุ่น "${q}" ในไฟล์ราคาครับ · ลองพิมพ์แค่ชื่อรุ่น เช่น "ราคา kiwi"`, dataUsed: 'room_price', status: 'ตอบไม่ได้' };
      const near = p.exact ? '' : `ไม่เจอ "${q}" ตรงทุกคำในไฟล์ราคา · ใกล้เคียงที่สุด:\n`;
      const list = p.items.slice(0, 8).map((x) => {
        const name = x.name.replace(/^ฌ\s*เฌอ\s*\|\s*/, '').replace(/\s+/g, ' ');
        const sale = x.price != null && x.disc_pct ? ` · ลด ${Number(x.disc_pct)}% เหลือ ${baht(x.price)}` : '';
        return `• ${name}\n   ราคาเต็ม ${baht(x.list_price) ?? '—'}${sale}${x.approved ? '' : ' (ไฟล์ราคา ยังไม่ผ่านการตรวจ)'}`;
      }).join('\n');
      const more = p.total > 8 ? `\n…และอีก ${p.total - 8} แบบ (ระบุผ้า/ไม้/ขนาดให้แคบลงได้)` : '';
      const cl = await call<Clearance | null>('room_clearance', { p_query: q, p_group_id: ctx.groupId });
      const clear = cl && !cl.hidden && !cl.expired && cl.exact && cl.items.length
        ? `\n\n🏷 มีใน Clearance ด้วย ${cl.items.length} รายการ · ถาม "clearance ${q}"` : '';
      return { answer: near + list + more + clear + src('ไฟล์ราคา Standard Price 2026'), dataUsed: 'room_price', status: 'ตอบแล้ว' };
    }

    case 'clearance': {
      const c = await call<Clearance>('room_clearance', { p_query: it.query ?? '', p_group_id: ctx.groupId });
      if (c.hidden) return { answer: 'กลุ่มนี้ไม่ได้เปิดให้ดูราคาครับ · ถามในกลุ่ม PO ได้ครับ', dataUsed: '—', status: 'ตอบไม่ได้' };
      if (c.expired) return { answer: `ราคา Clearance หมดอายุแล้วครับ (ถึง ${thDate(c.expires_on)})\nรอราคาชุดใหม่จากทีม CC ครับ`, dataUsed: 'room_clearance', status: 'ตอบไม่ได้' };
      if (c.items.length === 0) return { answer: `ไม่มีรุ่น "${it.query ?? ''}" ในรายการ Clearance ครับ · ถามราคาปกติได้ เช่น "ราคา ${it.query ?? ''}"`, dataUsed: 'room_clearance', status: 'ตอบไม่ได้' };
      const list = c.items.slice(0, MAX_ROWS).map((x) =>
        `• ${x.name.replace(/\s+/g, ' ')}\n   เต็ม ${baht(x.retail) ?? '—'} · ลด ${x.disc ?? '—'} · เหลือ ${baht(x.price) ?? '—'}`).join('\n');
      return { answer: `${c.exact === false ? `ไม่เจอ "${it.query ?? ''}" ตรงทุกคำ · ใกล้เคียงที่สุด:\n` : ''}ราคา Clearance (ถึง ${thDate(c.expires_on)})\n${list}` + src('Google Sheet · Clearance Sales 2026', c.updated_at), dataUsed: 'room_clearance', status: 'ตอบแล้ว' };
    }

    default:
      return { answer: 'เรื่องนี้ผมยังตอบไม่ได้ครับ\n\n' + HELP, dataUsed: '—', status: 'ตอบไม่ได้' };
  }
}

const NUM = ['①', '②', '③', '④'];

/** หลายเรื่องในข้อความเดียว · ตอบทีละข้อตามลำดับที่ถาม */
export async function render(items: Intent[], ctx: Ctx): Promise<Rendered> {
  const outs = await Promise.all(items.map((it) => one(it, ctx)));
  if (outs.length === 1) return outs[0];
  const status = outs.some((o) => o.status === 'ส่งต่อทีม') ? 'ส่งต่อทีม'
    : outs.every((o) => o.status === 'ตอบไม่ได้') ? 'ตอบไม่ได้' : 'ตอบแล้ว';
  return {
    answer: outs.map((o, i) => `${NUM[i]} ${o.answer}`).join('\n\n'),
    dataUsed: [...new Set(outs.map((o) => o.dataUsed))].join(','),
    status,
  };
}
