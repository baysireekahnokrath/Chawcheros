/**
 * แกะข้อความที่ลูกค้าส่งมา ให้กลายเป็นร่างใบเสนอราคา
 *
 * โจทย์จาก Bay (2026-11-10)
 *   "ผมอยากได้ว่า เมื่อผมได้รับ message แบบนี้จากลูกค้าปุ๊บ
 *    สามารถออก Quotation ได้ภายใน 10 นาทีเลยครับ"
 *
 * ข้อความจริงที่ใช้ออกแบบ
 *   สวัสดีค่าคุณบุ๊ก ขอใบเสนอราคาเพิ่มเติมอีก2โครงการค่ะ แยกกันสาขาละ1ใบค่ะ
 *   CLP
 *   Option1
 *   - Krata Lounge Chair PVC SM Wheat 3 ตัว
 *   Option2
 *   - Krata Lounge Chair PVC SM Wheat 2 ตัว
 *   - Khonmai Stool PVC SM Wheat 1 ตัว
 *   บริษัท อุรา กรุงเทพ คลินิก จำกัด (สาขา 00016) อาคาร... 10900
 *   MGB
 *   - Emu Bench 1.00m. PVC SM Wheat 2 ตัว
 *   ...
 *
 * ★ ตัวแกะนี้ไม่เดาราคาและไม่เดาสินค้า · หน้าที่มันคือแยกบรรทัดให้ถูก
 *   ว่าอันไหนเป็นหัวใบ อันไหนเป็นรายการ อันไหนเป็นที่อยู่ลูกค้า
 *   การจับคู่กับใบราคาอยู่ใน match.ts และคนเป็นคนกดยืนยันเสมอ
 */

export type DraftLine = {
  /** ข้อความดิบของบรรทัดนี้ เอาไว้โชว์ให้คนตรวจว่าแกะมาจากอะไร */
  raw: string;
  /** ชื่อสินค้าที่เดาได้ หลังตัดจำนวนกับวัสดุออก */
  name: string;
  /** คำที่น่าจะเป็นวัสดุ/สี เช่น PVC SM Wheat */
  spec: string;
  qty: number;
};

export type DraftDoc = {
  /** ชื่อย่อโครงการที่ลูกค้าเขียนไว้ เช่น CLP · MGB */
  title: string;
  /** ตัวเลือกในใบเดียวกัน เช่น Option1 / Option2 · ว่าง = ไม่มีตัวเลือก */
  option: string;
  lines: DraftLine[];
  customer: string;
  address: string;
  tel: string;
};

const NBSP = / /g;
const clean = (s: string) => s.replace(NBSP, ' ').replace(/\s+/g, ' ').trim();

/** บรรทัดรายการ · ขึ้นต้นด้วย - • * หรือเลขข้อ */
const BULLET = /^\s*(?:[-–—•*]|\d+[.)])\s*/;

/** จำนวน · "3 ตัว" "x3" "×3" "3 ชิ้น" "จำนวน 3"
 *  ★ ห้ามใช้ \b หลังคำไทย · JS ถือว่าอักษรไทยไม่ใช่ word char ขอบคำจึงไม่เกิด
 *    ของเดิมเขียน (?:ตัว|ชิ้น)\b แล้วไม่เจอ "3 ตัว" สักอัน */
const QTY = /(\d+)\s*(?:ตัว|ชิ้น|ชุด|อัน|pcs?|units?)(?![\u0E00-\u0E7F\w])|(?:\bx|×)\s*(\d+)\b/i;

/** หัวข้อตัวเลือก · "Option1" "Option 2" "ตัวเลือกที่ 1" */
const OPTION = /^(?:option|ตัวเลือก(?:ที่)?)\s*([0-9]+)$/i;

/** บรรทัดที่เป็นชื่อบริษัท/ที่อยู่ลูกค้า */
const COMPANY = /(บริษัท|ห้างหุ้นส่วน|หจก\.|บจก\.|คุณ|โครงการ)/;
const ADDRESSY = /(เลขที่|ถนน|แขวง|เขต|ตำบล|อำเภอ|จังหวัด|หมู่|ซอย|ชั้น|ห้อง|อาคาร|\b\d{5}\b)/;

/** เบอร์โทร · 08x-xxx-xxxx / 02-xxx-xxxx / 10 หลักติดกัน */
const TEL = /(0\d[\d\s-]{7,12}\d)/;

/** หัวใบ · บรรทัดสั้น ๆ ที่เป็นชื่อย่อโครงการ เช่น CLP, MGB, ชั้น 2 */
const isHeading = (s: string) =>
  s.length > 0 && s.length <= 24 && !BULLET.test(s) && !COMPANY.test(s) &&
  !ADDRESSY.test(s) && !OPTION.test(s) && !/[.!?]$/.test(s) &&
  !/(ค่ะ|ครับ|คะ|นะ|ขอ|สวัสดี)/.test(s);

/** ตัดจำนวนกับคำที่น่าจะเป็นวัสดุออกจากชื่อสินค้า */
function splitLine(raw: string): DraftLine {
  const body = clean(raw.replace(BULLET, ''));
  const m = QTY.exec(body);
  const qty = m ? +(m[1] ?? m[2]) : 1;
  let rest = m ? clean(body.slice(0, m.index) + ' ' + body.slice(m.index + m[0].length)) : body;

  // วัสดุมักเป็นท้ายบรรทัด · จับคำที่รู้จักไว้ก่อน ที่เหลือถือเป็นชื่อสินค้า
  const SPEC = /\b((?:PVC|PU|Fabric|Leather|ผ้า|หนัง|ไม้|Oak|Walnut|Teak)\b[\w\s().\/-]*)$/i;
  const sm = SPEC.exec(rest);
  const spec = sm ? clean(sm[1]) : '';
  if (sm) rest = clean(rest.slice(0, sm.index));

  return { raw: clean(raw), name: rest, spec, qty: qty > 0 ? qty : 1 };
}

/**
 * แกะข้อความทั้งก้อน · คืนร่างใบเสนอราคาหนึ่งใบต่อหนึ่งหัวข้อ/ตัวเลือก
 * ไม่มีหัวข้อเลยก็ได้ใบเดียว
 */
export function parseRequest(text: string): DraftDoc[] {
  const rows = (text ?? '').split(/\r?\n/).map(clean);
  const docs: DraftDoc[] = [];

  let title = '';
  let option = '';
  const made = new Map<string, DraftDoc>();
  const keyOf = () => `${title}|${option}`;

  const docFor = () => {
    const k = keyOf();
    let d = made.get(k);
    if (!d) {
      d = { title, option, lines: [], customer: '', address: '', tel: '' };
      made.set(k, d);
      docs.push(d);
    }
    return d;
  };
  /** ใบที่เปิดอยู่ทั้งหมดของหัวข้อนี้ · ที่อยู่ที่มาทีหลังใส่ให้ทุกตัวเลือก */
  const sameTitle = () => docs.filter((d) => d.title === title);

  for (const line of rows) {
    if (!line) continue;

    const opt = OPTION.exec(line);
    if (opt) { option = `Option ${opt[1]}`; docFor(); continue; }

    if (BULLET.test(line)) { docFor().lines.push(splitLine(line)); continue; }

    if (COMPANY.test(line) || ADDRESSY.test(line)) {
      const tel = TEL.exec(line)?.[1] ?? '';
      // ชื่อบริษัทอยู่หน้า ที่อยู่ตามหลัง · ตัดที่คำว่า "อาคาร" หรือ "เลขที่" ก่อน
      const cut = line.search(/(อาคาร|เลขที่|\d+\/\d+|\d+ หมู่)/);
      const name = cut > 0 ? clean(line.slice(0, cut)) : line;
      const addr = cut > 0 ? clean(line.slice(cut)) : '';
      for (const d of sameTitle()) {
        if (!d.customer) d.customer = name; else if (addr) d.address = clean(`${d.address} ${addr}`);
        if (!d.address && addr) d.address = addr;
        if (tel && !d.tel) d.tel = clean(tel);
      }
      if (!sameTitle().length) {
        const d = docFor();
        d.customer = name; d.address = addr; d.tel = clean(tel);
      }
      continue;
    }

    if (isHeading(line)) { title = line; option = ''; continue; }

    // บรรทัดทักทาย/คำสั่งอื่น ๆ ข้ามไป ไม่เดา
  }

  return docs.filter((d) => d.lines.length > 0);
}
