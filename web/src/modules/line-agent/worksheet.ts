/**
 * ชุด C · ใบงานผลิต · BLS ใหม่ที่มีใบ PO ในชีต → บอทส่งเข้ากลุ่มที่เปิด "รับใบงาน" (กลุ่ม PO)
 * ไม่มีราคา ไม่มีข้อมูลลูกค้า · ส่งครั้งเดียวต่อ BLS (ฐานข้อมูลกันซ้ำ) · ครั้งแรกไม่ส่งของเก่า
 * push = นับโควตา LINE · จำกัดรอบละ 5 ใบ กันส่งท่วมกลุ่ม
 */
import { call } from './db';
import { lineSecrets, push } from './line';
import { thDate } from './render';

type Pending = {
  bls: string; delivery_text: string | null; delivery_on: string | null;
  lines: { line_no: number; name: string; spec: string | null; note: string | null; qty: number | null }[];
};

export function worksheetText(w: Pending) {
  const lines = (w.lines ?? []).map((l, i) =>
    `${i + 1}. ${l.name}${l.spec ? `\n   ${l.spec}` : ''}${l.note ? `\n   📝 ${l.note}` : ''}\n   จำนวน ${l.qty ?? '—'}`).join('\n');
  const due = w.delivery_on ? thDate(w.delivery_on) : (w.delivery_text ?? 'ยังไม่ระบุ');
  return `🧾 ใบงานผลิต ${w.bls}\n${lines}\nกำหนดส่ง ${due}\n— จากใบ PO ใน Google Sheet · Team Bay ส่งอัตโนมัติ`;
}

export async function pushWorksheets(): Promise<number> {
  const keys = lineSecrets();
  if (!keys) return 0;
  const pending = await call<Pending[]>('worksheets_pending');
  if (pending.length === 0) return 0;
  const rooms = await call<string[]>('worksheet_rooms');
  let sent = 0;
  for (const w of pending.slice(0, 5)) {
    const errs: string[] = [];
    for (const to of rooms) {
      const r = await push(keys.token, to, worksheetText(w));
      if (!r.ok) errs.push(r.error ?? 'ส่งไม่ได้');
    }
    await call('worksheet_sent', { p_bls: w.bls, p_rooms: rooms.length - errs.length, p_error: errs.join(' · ') || null });
    sent++;
  }
  return sent;
}
