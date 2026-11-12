/**
 * ตัวใบเสนอราคา · ตัวเลขและเลขที่ใบ
 *
 * ยึดตามใบจริงที่ Bay ออกไปแล้ว (Quotation template 2026 · ชีต 20260901)
 *
 *   No. | รายการสินค้า                                   | สี | QTY | ราคา/หน่วย | จำนวนเงิน
 *   1   | ฌ เฌอ | ตู้เก็บของ ขุนทอง (Koontong Sideboard) |    |  1  |   44,600   |
 *       | ไม้โอ๊ค สีวอลนัท | ขนาด W120 D43.5 H79 cm       |    |     |   35,680   |  35,680
 *
 * ★ สองบรรทัดต่อหนึ่งรายการ · บรรทัดบนเป็นราคาเต็ม บรรทัดล่างเป็นราคาหลังลดกับยอดรวม
 *   เป็นรูปแบบเดียวกับคอลัมน์ Full name ในใบราคา แค่ตัดครึ่ง
 *
 * ★ VAT · ราคาในใบราคารวม VAT อยู่แล้ว
 *   ใบจริงของ Bay จึงเว้นช่อง VAT ว่าง และ Grand Total เท่ากับ Total
 *   ถ้าลูกค้าขอแบบแยก VAT ค่อยสลับเป็นโหมดถอด VAT ออกมาโชว์
 */

export type QuoteLine = {
  id: string;
  /** รหัสที่โชว์ในคอลัมน์ No. · ว่างได้ถ้าเป็นค่าขนส่ง */
  no: string;
  head: string;
  /** บรรทัดสอง · ไม้และขนาด */
  sub: string;
  /** บรรทัดสาม · วัสดุหุ้มที่ลูกค้าระบุ เช่น "PVC เลือกสีได้" · ใบจริงแยกบรรทัดนี้ออกมา */
  spec: string;
  colour: string;
  qty: number;
  retail: number | null;
  unit: number | null;
  image: string | null;
};

export type Quote = {
  no: string;
  date: string;
  customer: string;
  address: string;
  tel: string;
  line: string;
  project: string;
  deliverTo: string;
  deliverDate: string;
  note: string;
  salesperson: string;
  lines: QuoteLine[];
  /** true = ราคายังไม่รวม VAT ต้องบวก 7% ท้ายใบ */
  addVat: boolean;
};

export const BAHT = (n: number | null | undefined) =>
  n == null ? '' : n.toLocaleString('th-TH', { maximumFractionDigits: 0 });

/** ปีพุทธศักราช · ใบจริงเขียน 15/9/2569 */
export function thaiDate(d = new Date()): string {
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear() + 543}`;
}

/**
 * เลขที่ใบ · QUO + ปี ค.ศ. สองหลัก + เดือนสองหลัก + ลำดับสามหลัก
 * ใบจริง: QUO2609001 ลงวันที่ 15/9/2569 → 26 คือ ค.ศ. 2026 ไม่ใช่ พ.ศ.
 * (วันที่ในหัวใบเป็นปีพุทธ แต่เลขที่ใบเป็นปี ค.ศ. · คนละอย่างกัน)
 */
export function quoteNo(seq: number, d = new Date()): string {
  const yy = String(d.getFullYear() % 100).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `QUO${yy}${mm}${String(seq).padStart(3, '0')}`;
}

export type Totals = {
  sub: number;        // รวมก่อน VAT ถ้า addVat · ไม่งั้นคือยอดรวมตรง ๆ
  vat: number | null;
  grand: number;
  saved: number;      // ส่วนลดรวมเทียบราคาเต็ม
};

export function totalsOf(q: Quote): Totals {
  let amount = 0, retail = 0;
  for (const l of q.lines) {
    amount += (l.unit ?? 0) * l.qty;
    retail += (l.retail ?? l.unit ?? 0) * l.qty;
  }
  const saved = Math.round(retail - amount);
  if (!q.addVat) return { sub: Math.round(amount), vat: null, grand: Math.round(amount), saved };
  const sub = Math.round(amount / 1.07);
  const vat = Math.round(amount) - sub;
  return { sub, vat, grand: Math.round(amount), saved };
}

/** ตั้งเลขข้อให้ใหม่ทั้งใบ · ค่าขนส่งไม่เอาเลข */
export function renumber(lines: QuoteLine[]): QuoteLine[] {
  let n = 0;
  return lines.map((l) => (l.retail == null && l.unit == null
    ? { ...l, no: '' }
    : { ...l, no: String(++n) }));
}
