/**
 * เขียนคำตอบจากข้อมูลในระบบ · โค้ดเขียน ไม่ใช่ AI (LR-24)
 * ทุกตัวเลข วันที่ เลขงาน ชื่อสินค้า มาจากฐานข้อมูลตรงๆ · ทุกคำตอบบอกที่มา (LR-16 · LR-25)
 * ตอบสั้น อ่านบนมือถือ (LR-17)
 */
import { call } from './db';
import type { Intent } from './intent';

const TH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const MAX_ROWS = 10;

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
  return ` · ข้อมูลแก้ล่าสุด ${thDate(day)} ${time}`;
}
const src = (s: string, updated?: string | null) => `\n— ดูจาก: ${s}${stamp(updated)}`;
const qty = (n: number) => (Number.isInteger(Number(n)) ? String(Number(n)) : String(n));

type Order = {
  order_no: string; wo: string | null; doc_status: string;
  required_finish_on: string | null; promised_delivery_on: string | null; updated_at: string;
  lines: { line_no: number; description: string; note: string | null; qty: number }[];
};
type DueRow = {
  order_no: string; wo: string | null; required_finish_on: string; promised_delivery_on: string | null;
  first_item: string | null; item_count: number;
};
type StockRow = { kind: string; item: string; location: string | null; status: string; units: number };

const woText = (o: { wo: string | null }) => (o.wo ? `ส่งเข้าผลิตแล้ว (w/o ${o.wo})` : 'ยังไม่ออก w/o');
const shortItem = (s: string | null) => (s ?? '').replace(/^ฌ\s*เฌอ\s*\|\s*/, '').split('·')[0].trim();

export const HELP =
  'ผมช่วยได้ครับ · พิมพ์ @Team Bay ตามด้วย\n' +
  '• เลข BLS → รายละเอียดงาน\n' +
  '• "BLS… ส่งวันไหน" / "ถึงไหนแล้ว"\n' +
  '• "สัปดาห์นี้ต้องเสร็จอะไรบ้าง" / "งานไหนเลยกำหนด"\n' +
  '• ชื่อรุ่นหรือชื่อผ้า + "มีในสต็อกไหม"\n' +
  'ผมตอบจากระบบเท่านั้น ไม่ตัดสินแทนทีมครับ';

export type Rendered = { answer: string; dataUsed: string; status: 'ตอบแล้ว' | 'ตอบไม่ได้' | 'ส่งต่อทีม' };

export async function render(it: Intent): Promise<Rendered> {
  switch (it.intent) {
    case 'help':
      return { answer: HELP, dataUsed: '—', status: 'ตอบแล้ว' };

    case 'secret':
      return {
        answer: 'ข้อมูลนี้ไม่มีในห้องนี้ครับ ผมเห็นได้แค่ข้อมูลงานผลิตและสต็อก\nทีม CC ดูได้ในระบบครับ',
        dataUsed: '—', status: 'ตอบไม่ได้',
      };

    case 'handoff':
      return {
        answer: `รับเรื่องครับ${it.order_no ? ` (${it.order_no.toUpperCase()})` : ''}\nเรื่องนี้ต้องให้ทีม CC ตัดสิน รบกวนทีม CC ช่วยตอบด้วยครับ`,
        dataUsed: '—', status: 'ส่งต่อทีม',
      };

    case 'order_detail':
    case 'order_dates':
    case 'order_status': {
      if (!it.order_no) return { answer: 'ขอเลข BLS ด้วยครับ เช่น "BLS3230 รายละเอียด"', dataUsed: '—', status: 'ตอบไม่ได้' };
      const o = await call<Order | null>('room_order', { p_order_no: it.order_no });
      if (!o) {
        return {
          answer: `ยังไม่มี ${it.order_no.toUpperCase()} ในระบบครับ\n(ออเดอร์ต้องลงในระบบก่อน ผมถึงจะเห็น)`,
          dataUsed: 'room_order', status: 'ตอบไม่ได้',
        };
      }
      const cancelled = o.doc_status === 'ยกเลิก' ? '\n⚠️ ออเดอร์นี้ถูกยกเลิกแล้ว' : '';
      const draft = o.doc_status === 'ร่าง' ? '\n⚠️ ยังเป็นใบร่าง ยังไม่ยืนยัน' : '';
      if (it.intent === 'order_dates') {
        const d = o.required_finish_on ? daysFromToday(o.required_finish_on) : null;
        const rel = d === null ? '' : d < 0 ? ` ⚠️ เลยมาแล้ว ${-d} วัน` : d === 0 ? ' (วันนี้)' : ` (อีก ${d} วัน)`;
        return {
          answer: `${o.order_no}${cancelled}${draft}\nต้องผลิตเสร็จ ${thDate(o.required_finish_on)}${rel}\nกำหนดส่ง ${thDate(o.promised_delivery_on)}` +
            src('ออเดอร์ · วันต้องผลิตเสร็จ · กำหนดส่ง', o.updated_at),
          dataUsed: 'room_order', status: 'ตอบแล้ว',
        };
      }
      if (it.intent === 'order_status') {
        return {
          answer: `${o.order_no} · ${woText(o)}${cancelled}${draft}\nต้องผลิตเสร็จ ${thDate(o.required_finish_on)} · กำหนดส่ง ${thDate(o.promised_delivery_on)}\n` +
            'ระบบยังไม่มีข้อมูลว่ากำลังผลิตหรือเสร็จแล้วครับ' + src('ออเดอร์ · ช่อง w/o', o.updated_at),
          dataUsed: 'room_order', status: 'ตอบแล้ว',
        };
      }
      const lines = o.lines.length === 0 ? '(ยังไม่มีรายการ)' : o.lines.slice(0, MAX_ROWS).map((l, i) =>
        `${i + 1}. ${l.description}${l.note ? `\n   📝 ${l.note}` : ''}\n   จำนวน ${qty(l.qty)}`).join('\n');
      const more = o.lines.length > MAX_ROWS ? `\n…และอีก ${o.lines.length - MAX_ROWS} รายการ` : '';
      return {
        answer: `${o.order_no} · ${woText(o)}${cancelled}${draft}\n${lines}${more}` + src('ออเดอร์ · รายการ (ไม่มีราคา)', o.updated_at),
        dataUsed: 'room_order', status: 'ตอบแล้ว',
      };
    }

    case 'orders_due':
    case 'orders_overdue': {
      const today = todayBkk();
      const days = Math.min(Math.max(Math.round(it.days ?? 7), 0), 60);
      const rows = it.intent === 'orders_overdue'
        ? await call<DueRow[]>('room_orders_overdue')
        : await call<DueRow[]>('room_orders_due', { p_from: today, p_to: addDays(today, days) });
      const head = it.intent === 'orders_overdue'
        ? 'งานที่เลยวันต้องผลิตเสร็จ (ย้อน 30 วัน)'
        : days === 0 ? 'งานต้องผลิตเสร็จวันนี้' : `งานต้องผลิตเสร็จใน ${days} วันนี้`;
      if (rows.length === 0) return { answer: `${head}\nไม่มีครับ` + src('ออเดอร์ที่ยืนยันแล้ว'), dataUsed: 'room_orders', status: 'ตอบแล้ว' };
      const list = rows.slice(0, MAX_ROWS).map((r) => {
        const d = daysFromToday(r.required_finish_on);
        const late = d < 0 ? ` (เลย ${-d} วัน)` : '';
        const more = r.item_count > 1 ? ` +${r.item_count - 1}` : '';
        return `• ${thDate(r.required_finish_on)}${late} · ${r.order_no} · ${shortItem(r.first_item)}${more} · ${woText(r)}`;
      }).join('\n');
      const more = rows.length > MAX_ROWS ? `\n…และอีก ${rows.length - MAX_ROWS} งาน` : '';
      const note = it.intent === 'orders_overdue' ? '\nระบบยังไม่รู้ว่างานไหนเสร็จแล้ว ทีม ASE ช่วยยืนยันได้ครับ' : '';
      return {
        answer: `${head} (${rows.length} งาน)\n${list}${more}${note}` + src('ออเดอร์ · วันต้องผลิตเสร็จ'),
        dataUsed: 'room_orders', status: 'ตอบแล้ว',
      };
    }

    case 'stock': {
      const q = (it.query ?? '').trim();
      if (!q) return { answer: 'ขอชื่อรุ่นหรือชื่อผ้าด้วยครับ เช่น "Emu ผ้าเทา มีในสต็อกไหม"', dataUsed: '—', status: 'ตอบไม่ได้' };
      const rows = await call<StockRow[]>('room_stock', { p_query: q });
      if (rows.length === 0) {
        return { answer: `หา "${q}" ไม่เจอในสต็อกครับ ลองพิมพ์ชื่อรุ่นหรือชื่อผ้าอีกที`, dataUsed: 'room_stock', status: 'ตอบไม่ได้' };
      }
      const list = rows.slice(0, MAX_ROWS).map((r) =>
        r.kind === 'วัสดุ' ? `• ${r.item} · ${r.status}` : `• ${r.item}\n   ${r.units} ตัว · ${r.location} · ${r.status}`).join('\n');
      const more = rows.length > MAX_ROWS ? `\n…และอีก ${rows.length - MAX_ROWS} รายการ` : '';
      return { answer: list + more + src('สต็อก · คลังวัสดุ'), dataUsed: 'room_stock', status: 'ตอบแล้ว' };
    }

    default:
      return { answer: 'เรื่องนี้ผมยังตอบไม่ได้ครับ\n\n' + HELP, dataUsed: '—', status: 'ตอบไม่ได้' };
  }
}
