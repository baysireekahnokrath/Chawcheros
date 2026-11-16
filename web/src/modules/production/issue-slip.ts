/**
 * คิดใบขอเบิกวัตถุดิบจากสูตร · ตามสูตรที่ถอดมาจากโปรแกรม COST ของโรงงาน
 *
 * ★ สูตรที่โรงงานใช้จริง (ตรวจกับใบที่ระบบเขาปรินต์ออกมาแล้วตรง)
 *
 *     จำนวนที่ต้องเบิก  =  จำนวนที่ใช้  ÷  Rec_  ÷  ตัวหาร#2
 *        (หน่วยเบิก)        (หน่วย Cost)
 *
 *   Rec_       ค่าได้เนื้อ · เผื่อของเสียตอนตัด · 1.0 ไม่เผื่อ · 0.6 เผื่อ 40%
 *   ตัวหาร#2   ตัวแปลงหน่วย · ฟองน้ำ 27.8 ตร.ฟุต/แผ่น · ผ้า 10.75 ตร.ฟุต/หลา
 *
 *   พิสูจน์กับใบจริงของ SE-04
 *     ใย 200 กรัม 94.9 ตร.ฟุต ÷ 0.9 ÷ 17.5 = 6.03 → ใบปรินต์ว่า "6 หลา" ✓
 *
 * ★ สิ่งที่ยังไม่รู้และต้องถามโรงงาน
 *   ปัดเศษยังไง · ของที่นับเป็นชิ้น (ตัว แผ่น แผง) เห็นบนใบเป็นจำนวนเต็มหมด
 *   เดาว่าปัดขึ้น แต่ยังไม่ได้ยืนยัน → คืนทั้งเลขดิบและเลขที่ปัดแล้ว ให้คนเทียบเอง
 *
 * ไฟล์นี้เป็นตรรกะล้วน ไม่มี import ของจริง · ทดสอบด้วย
 *   node --experimental-strip-types scripts/issue-slip.test.mts
 */

export type Line = {
  item: number; name: string;
  unit: string; unit1: string;
  net: number; rec: number; rec1: number;
  groupId: string; depId: number;
  hide: boolean; c1: boolean; c2: boolean;
};

/** หน่วยที่นับเป็นชิ้น เบิกครึ่งชิ้นไม่ได้ */
const WHOLE = new Set(['ตัว', 'แผ่น', 'แผง', 'อัน', 'เส้น', 'ขา', 'ชุด', 'หัว', 'ใบ', 'ม้วน', 'ลูก', 'เม็ด']);

export const isWholeUnit = (unit: string) => WHOLE.has((unit ?? '').trim());

export type Calc = {
  /** เลขดิบก่อนปัด */
  raw: number;
  /** เลขที่น่าจะอยู่บนใบจริง */
  issue: number;
  /** ปัดขึ้นหรือปัดทศนิยม */
  how: 'ปัดขึ้น' | 'ทศนิยม 2 ตำแหน่ง';
};

/** จำนวนที่ต้องเบิกของบรรทัดนี้ ต่อสินค้า 1 ตัว */
export function issueQty(l: Pick<Line, 'net' | 'rec' | 'rec1' | 'unit1'>, qty = 1): Calc {
  const rec = l.rec > 0 ? l.rec : 1;
  const rec1 = l.rec1 > 0 ? l.rec1 : 1;
  const raw = (l.net / rec / rec1) * (qty > 0 ? qty : 1);
  if (isWholeUnit(l.unit1)) return { raw, issue: Math.ceil(raw - 1e-9), how: 'ปัดขึ้น' };
  return { raw, issue: Math.round(raw * 100) / 100, how: 'ทศนิยม 2 ตำแหน่ง' };
}

export type SlipRow = Line & Calc & { no: number };

/**
 * บรรทัดที่ขึ้นใบเบิกของแผนกหนึ่ง
 *
 * ★ ของที่ติ๊ก "ไม่แสดงในใบเบิก" ไม่ขึ้น — เทปใส กระดาษลูกฟูก TAG
 *   พวกนี้สโตร์ไม่จ่ายรายงาน ตรงกับบรรทัด "รายการข้อมูลที่ไม่คิด COST" ท้ายใบจริง
 */
export function slipFor(lines: Line[], depId: number, qty = 1): SlipRow[] {
  return lines
    .filter((l) => l.depId === depId && !l.hide)
    .sort((a, b) => a.item - b.item)
    .map((l, i) => ({ ...l, ...issueQty(l, qty), no: i + 1 }));
}

/** ของที่ถูกตัดออกจากใบ · โชว์ท้ายใบเหมือนของจริง */
export function hiddenFor(lines: Line[], depId: number): Line[] {
  return lines.filter((l) => l.depId === depId && l.hide).sort((a, b) => a.item - b.item);
}

/** แผนกที่มีของให้เบิกจริงในสูตรนี้ เรียงตามลำดับงาน */
export function depsUsed(lines: Line[]): number[] {
  const s = new Set(lines.filter((l) => !l.hide).map((l) => l.depId));
  return [...s].filter((d) => d > 0).sort((a, b) => a - b);
}

/** นับบรรทัดต่อแผนก เอาไว้โชว์บนปุ่มเลือกแผนก */
export function countByDep(lines: Line[]): Map<number, number> {
  const m = new Map<number, number>();
  for (const l of lines) if (!l.hide) m.set(l.depId, (m.get(l.depId) ?? 0) + 1);
  return m;
}

/** ข้อความอธิบายการคิดของบรรทัดหนึ่ง · ใช้โชว์ตอนกางดู */
export function explain(l: Line, qty = 1): string {
  const parts = [`${l.net} ${l.unit}`];
  if (l.rec !== 1) parts.push(`÷ ${l.rec} (Rec_)`);
  if (l.rec1 !== 1) parts.push(`÷ ${l.rec1} (ตัวหาร#2)`);
  if (qty > 1) parts.push(`× ${qty} ตัว`);
  const c = issueQty(l, qty);
  return `${parts.join(' ')} = ${c.raw.toFixed(2)} ${l.unit1} → ${c.how} ${c.issue}`;
}
