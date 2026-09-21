/**
 * อ่านไฟล์ราคาจาก Airtable แล้วแปลงเป็นแถวรอตรวจ
 *
 * ฟังก์ชันนี้ตั้งใจให้เป็นฟังก์ชันเปล่าๆ ไม่แตะฐานข้อมูล ไม่แตะเครือข่าย
 * เพราะอยากทดสอบมันด้วยไฟล์จริง 751 แถวได้โดยไม่ต้องมีฐานข้อมูล
 *
 * จับคอลัมน์จาก "ชื่อหัวตาราง" ไม่ใช่ "ลำดับคอลัมน์"
 * ปีหน้าถ้า Airtable สลับคอลัมน์หรือแทรกคอลัมน์ใหม่ ไฟล์นี้ยังอ่านได้
 */

export type ParsedRow = {
  source_row_no: number;
  brand: string | null;
  category: string | null;
  collection: string | null;
  sub_category: string | null;
  wood: string | null;
  wood_colour: string | null;
  material_grade: string | null;
  width_cm: number | null;
  depth_cm: number | null;
  height_cm: number | null;
  seat_height_cm: number | null;
  legacy_nnsku: string | null;
  legacy_fullname: string | null;
  list_price_incl_vat: number | null;
  discount_pct: number | null;
  ontop_pct: number | null;
};

export type Problem = { row: number; message: string };

export type ParseResult = {
  rows: ParsedRow[];
  problems: Problem[];
  /** หัวตารางที่หาไม่เจอ — ถ้ามีแม้แต่อันเดียวถือว่าไฟล์ผิดรูปแบบ */
  missingColumns: string[];
};

/** หัวตารางที่ต้องมี → ชื่อช่องในฐานข้อมูล */
const COLUMNS = {
  'Full name': 'legacy_fullname',
  Brand: 'brand',
  Category: 'category',
  'Sub Category 1': 'sub_category',
  'Collection Name': 'collection',
  'Wood (ประเภทไม้)': 'wood',
  'Wood Colour (สีไม้)': 'wood_colour',
  'วัสดุหุ้ม (Upholstery Material)': 'material_grade',
  'กว้าง (W)': 'width_cm',
  'ลึก (D)': 'depth_cm',
  'สูง (H)': 'height_cm',
  'NNSKU#': 'legacy_nnsku',
  'Retail Price include VAT': 'list_price_incl_vat',
  PercentDiscount: 'discount_pct',
  PercentOntop: 'ontop_pct',
} as const;

const REQUIRED = Object.keys(COLUMNS);

/**
 * แยก CSV ตามมาตรฐาน RFC 4180
 *
 * ไฟล์ปี 2026 ไม่มีเครื่องหมายคำพูดเลยสักตัว แยกด้วยจุลภาคเฉยๆ ก็ได้
 * แต่วันที่มีคนพิมพ์จุลภาคในชื่อสินค้า Airtable จะใส่คำพูดครอบให้ทันที
 * แล้วการแยกแบบง่ายๆ จะพังเงียบๆ — เขียนให้ถูกตั้งแต่แรกถูกกว่ามาไล่ทีหลัง
 */
export function splitCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  // ตัด BOM ที่ Excel/Airtable ชอบใส่ไว้หน้าไฟล์
  const s = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  for (let i = 0; i < s.length; i++) {
    const c = s[i];

    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; }   // "" = คำพูดจริงหนึ่งตัว
        else inQuotes = false;
      } else field += c;
      continue;
    }

    if (c === '"') { inQuotes = true; continue; }
    if (c === ',') { row.push(field); field = ''; continue; }
    if (c === '\r') continue;
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue; }
    field += c;
  }

  // บรรทัดสุดท้ายที่ไม่ได้ลงท้ายด้วยการขึ้นบรรทัดใหม่
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }

  return rows;
}

const clean = (v: string | undefined): string | null => {
  const t = (v ?? '').trim();
  return t === '' ? null : t;
};

/** "W55" · "D50 " · "55" → 55 */
const dim = (v: string | undefined): number | null => {
  const m = (v ?? '').match(/(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : null;
};

/**
 * "H72 (46)" → สูง 72 · สูงที่นั่ง 46
 * ความสูงที่นั่งของโซฟาซ่อนอยู่ในวงเล็บของช่องความสูง ไม่ได้แยกช่องไว้
 */
const heightPair = (v: string | undefined): { h: number | null; seat: number | null } => {
  const s = v ?? '';
  const h = s.match(/(\d+(?:\.\d+)?)/);
  const seat = s.match(/\(\s*(\d+(?:\.\d+)?)\s*\)/);
  return { h: h ? Number(h[1]) : null, seat: seat ? Number(seat[1]) : null };
};

/** "B 34900.00" → 34900 · "30%" → 30 */
const num = (v: string | undefined): number | null => {
  const m = (v ?? '').replace(/,/g, '').match(/(-?\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : null;
};

export function parsePriceCsv(text: string): ParseResult {
  const table = splitCsv(text).filter((r) => r.some((c) => c.trim() !== ''));
  if (table.length === 0) {
    return { rows: [], problems: [], missingColumns: REQUIRED };
  }

  const header = table[0].map((h) => h.trim());
  const at: Record<string, number> = {};
  for (const name of REQUIRED) at[name] = header.indexOf(name);

  const missingColumns = REQUIRED.filter((name) => at[name] === -1);
  if (missingColumns.length > 0) return { rows: [], problems: [], missingColumns };

  const get = (r: string[], name: string) => r[at[name]];

  const rows: ParsedRow[] = [];
  const problems: Problem[] = [];

  table.slice(1).forEach((r, i) => {
    const rowNo = i + 1;                       // นับแบบเดียวกับที่คนเปิดไฟล์เห็น
    const { h, seat } = heightPair(get(r, 'สูง (H)'));

    const parsed: ParsedRow = {
      source_row_no: rowNo,
      brand: clean(get(r, 'Brand')),
      category: clean(get(r, 'Category')),
      collection: clean(get(r, 'Collection Name')),
      sub_category: clean(get(r, 'Sub Category 1')),
      wood: clean(get(r, 'Wood (ประเภทไม้)')),
      wood_colour: clean(get(r, 'Wood Colour (สีไม้)')),
      material_grade: clean(get(r, 'วัสดุหุ้ม (Upholstery Material)')),
      width_cm: dim(get(r, 'กว้าง (W)')),
      depth_cm: dim(get(r, 'ลึก (D)')),
      height_cm: h,
      seat_height_cm: seat,
      legacy_nnsku: clean(get(r, 'NNSKU#')),
      legacy_fullname: clean(get(r, 'Full name')),
      list_price_incl_vat: num(get(r, 'Retail Price include VAT')),
      discount_pct: num(get(r, 'PercentDiscount')),
      ontop_pct: num(get(r, 'PercentOntop')),
    };

    // รุ่นหนึ่งรุ่น = Collection + หมวด ขาดอย่างใดอย่างหนึ่งจัดกลุ่มไม่ได้
    if (!parsed.collection || !parsed.category) {
      problems.push({
        row: rowNo,
        message: `ไม่มี ${!parsed.collection ? 'Collection Name' : 'Category'} — จัดกลุ่มไม่ได้ ข้ามแถวนี้`,
      });
      return;
    }
    if (parsed.list_price_incl_vat === null) {
      problems.push({ row: rowNo, message: 'ไม่มีราคา — เก็บไว้ให้ตรวจ แต่จะยังตั้งราคาไม่ได้' });
    }

    rows.push(parsed);
  });

  return { rows, problems, missingColumns: [] };
}
