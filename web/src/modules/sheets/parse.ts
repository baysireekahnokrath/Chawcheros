/**
 * แปลงข้อมูลจากชีต → แถวสำหรับ sheets.* (0035) · ฟังก์ชันล้วน ไม่ต่ออะไรเลย ทดสอบง่าย
 *
 * หลัก: หาคอลัมน์จาก "ชื่อหัวตาราง" ไม่ใช่ตำแหน่ง (F1) · อ่านไม่ออก = ใส่ warnings ไม่เดา
 * ไม่อ่านคอลัมน์ข้อมูลลูกค้าและต้นทุนเลยสักช่อง (S4)
 */

export type Warn = string;

const TH_MARKS = /[ัิ-ฺ็-๎]/g;

/** "ิBLS3175" · "bls 3175" · "BLS3181A" → BLS3175 · null ถ้าไม่ใช่เลข BLS */
export function normBls(s: string | undefined | null): string | null {
  const x = (s ?? '').replace(TH_MARKS, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const m = x.match(/BLS(\d{3,5})([A-Z])?/) ?? x.match(/^(\d{3,5})([A-Z])?$/);
  return m ? `BLS${m[1]}${m[2] ?? ''}` : null;
}

export function num(s: string | undefined | null): number | null {
  const x = (s ?? '').replace(/[,฿\s]/g, '');
  if (!/^-?\d+(\.\d+)?$/.test(x)) return null;
  return Number(x);
}

const MONTHS: [RegExp, number][] = [
  [/^(ม\.?ค\.?|มกราคม|มกรา)/, 1], [/^(ก\.?พ\.?|กุมภาพันธ์|กุมภา)/, 2], [/^(มี\.?ค\.?|มีนาคม|มีนา)/, 3],
  [/^(เม\.?ย\.?|เมษายน|เมษา)/, 4], [/^(พ\.?ค\.?|พฤษภาคม|พฤษภา)/, 5], [/^(มิ\.?ย\.?|มิถุนายน|มิถุนา)/, 6],
  [/^(ก\.?ค\.?|กรกฎาคม|กรกฎา)/, 7], [/^(ส\.?ค\.?|สิงหาคม|สิงหา)/, 8], [/^(ก\.?ย\.?|กันยายน|กันยา)/, 9],
  [/^(ต\.?ค\.?|ตุลาคม|ตุลา)/, 10], [/^(พ\.?ย\.?|พฤศจิกายน|พฤศจิกา)/, 11], [/^(ธ\.?ค\.?|ธันวาคม|ธันวา)/, 12],
];

function year(y: string | undefined, fallback: number): number {
  if (!y) return fallback;
  let n = Number(y);
  if (y.length <= 2) n = n >= 60 ? 2500 + n : 2000 + n;   // 69 = พ.ศ. 2569 · 26 = ค.ศ. 2026
  if (n > 2400) n -= 543;
  return n;
}

function iso(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() !== m - 1) return null;
  return dt.toISOString().slice(0, 10);
}

/**
 * หาวันที่ชัดๆ ในข้อความกำหนดส่ง · ช่วงวัน "2-4/11/69" ใช้วันท้าย · ข้อความลอยๆ ("ปลายเดือน พ.ค.") = null
 * ปีที่ไม่ได้เขียน ใช้ปีของ refYear
 */
export function thaiDate(text: string | undefined | null, refYear = new Date().getFullYear()): string | null {
  const t = (text ?? '').replace(/\s+/g, ' ');
  // d/m/yy · d/m/yyyy (ใช้ / เท่านั้น · "2-4/11/69" = 4/11/69)
  const a = t.match(/(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{2,4})(?!\d)/);
  if (a) return iso(year(a[3], refYear), Number(a[2]), Number(a[1]));
  // d เดือนไทย [ปี]
  const re = /(\d{1,2})\s*([ก-๙.]+)\s*\.?\s*(\d{2,4})?/g;
  for (const m of t.matchAll(re)) {
    const mon = MONTHS.find(([r]) => r.test(m[2]));
    if (mon) return iso(year(m[3], refYear), mon[1], Number(m[1]));
  }
  return null;
}

/** วันที่แบบ d/m/yyyy (ช่องวันที่สั่งซื้อ) */
export function dmy(text: string | undefined | null): string | null {
  const a = (text ?? '').match(/^\s*(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s*$/);
  return a ? iso(year(a[3], 2026), Number(a[2]), Number(a[1])) : null;
}

function col(header: string[], ...names: string[]): number {
  const h = header.map((x) => (x ?? '').replace(/\s+/g, ' ').trim().toLowerCase());
  for (const n of names) {
    const i = h.indexOf(n.toLowerCase());
    if (i >= 0) return i;
  }
  return -1;
}

// ---------------------------------------------------------------------------
// ① Order Tracking · order2026
// ---------------------------------------------------------------------------
export type OrderRow = {
  bls: string; label: string | null; wo: string | null; ordered_on: string | null;
  delivery_text: string | null; delivery_on: string | null; items_text: string | null; sheet_rows: string;
};

export function parseOrders(values: string[][], refYear = new Date().getFullYear()) {
  const warnings: Warn[] = [];
  const header = values[0] ?? [];
  const c = {
    po: col(header, 'PO'), wo: col(header, 'w/o'), date: col(header, 'วันที่สั่งซื้อ'),
    items: col(header, 'รายการ'), due: col(header, 'กำหนดส่งของ'),
  };
  for (const [k, i] of Object.entries(c)) if (i < 0) throw new Error(`Order Tracking: หาคอลัมน์ "${k}" ไม่เจอ · หัวตารางเปลี่ยนหรือเปล่า`);

  type Acc = OrderRow & { _items: string[]; _first: number; _last: number };
  const byBls = new Map<string, Acc>();
  let cur: Acc | null = null;
  for (let r = 1; r < values.length; r++) {
    const row = values[r] ?? [];
    const cell = (i: number) => (row[i] ?? '').trim();
    const a = cell(c.po);
    if (a === 'PO' || cell(c.due) === 'กำหนดส่งของ') { cur = null; continue; }   // หัวตารางซ้ำท้ายชีต
    if (a) {
      const bls = normBls(a);
      if (!bls) { cur = null; continue; }    // Futon / MEMO / ORDER# · ยังไม่รองรับ (S4 หมวด ฉ)
      const label = /ซ่อม/.test(a) ? 'งานซ่อม' : null;
      cur = byBls.get(bls) ?? {
        bls, label, wo: null, ordered_on: null, delivery_text: null, delivery_on: null,
        items_text: null, sheet_rows: '', _items: [], _first: r + 1, _last: r + 1,
      };
      byBls.set(bls, cur);
    }
    if (!cur) continue;
    cur._last = r + 1;
    const wo = cell(c.wo);
    if (wo && !cur.wo) cur.wo = wo.replace(/^w\/?o\s*/i, '').replace(/\s+/g, ' ');
    const d = cell(c.date);
    if (d && !cur.ordered_on) {
      cur.ordered_on = dmy(d);
      if (!cur.ordered_on) warnings.push(`แถว ${r + 1} ${cur.bls}: วันที่สั่งซื้อ "${d}" อ่านไม่ออก`);
    }
    const due = cell(c.due);
    if (due && !cur.delivery_text) {
      cur.delivery_text = due;
      cur.delivery_on = thaiDate(due, refYear);
    }
    const it = cell(c.items);
    if (it) cur._items.push(it);
  }
  const rows: OrderRow[] = [...byBls.values()].map(({ _items, _first, _last, ...o }) => ({
    ...o, items_text: _items.length ? _items.join('\n') : null,
    sheet_rows: _first === _last ? String(_first) : `${_first}-${_last}`,
  }));
  return { rows, warnings };
}

// ---------------------------------------------------------------------------
// ② PO template · 1 แท็บ = 1 BLS
// ---------------------------------------------------------------------------
export type PoLine = {
  bls: string; line_no: number; name: string; spec: string | null; note: string | null;
  qty: number | null; unit_price: number | null; delivery_text: string | null; tab: string;
};

/** แท็บที่ใช้ได้ · ข้าม "PO (new template)" และแท็บก๊อป "(2)" ถ้ามีตัวจริงอยู่แล้ว */
export function poTabs(names: string[]): { tab: string; bls: string }[] {
  const out = new Map<string, string>();
  for (const t of names) {
    if (/template/i.test(t)) continue;
    const copy = /\(\d+\)\s*$/.test(t);
    const bls = normBls(t.replace(/\(\d+\)\s*$/, ''));
    if (!bls) continue;
    if (copy && out.has(bls)) continue;
    if (!copy || !out.has(bls)) out.set(bls, t);
  }
  return [...out].map(([bls, tab]) => ({ bls, tab }));
}

const SKIP_LINE = /^\s*(ค่าขนส่ง|ค่าแพ็ค|ค่าส่ง|ค่าติดตั้ง)/;

export function parsePoTab(bls: string, tab: string, v: string[][]): PoLine[] {
  // หาแถวหัวรายการ ("No.") และแถวจบ ("ชำระโดย")
  const start = v.findIndex((r) => (r[0] ?? '').trim().startsWith('No.'));
  if (start < 0) return [];
  let end = v.findIndex((r, i) => i > start && (r[0] ?? '').includes('ชำระโดย'));
  if (end < 0) end = v.length;
  // กำหนดส่ง · แถวที่มี "กำหนดส่ง" ในคอลัมน์ E แล้วแถวถัดไป
  const dueRow = v.findIndex((r) => (r[4] ?? '').includes('กำหนดส่ง'));
  const delivery = dueRow >= 0 ? (v[dueRow + 1]?.[4] ?? '').trim() || null : null;

  const lines: PoLine[] = [];
  let cur: PoLine | null = null;
  let extra: string[] = [];
  const flush = () => {
    if (cur && !SKIP_LINE.test(cur.name)) {
      cur.spec = extra[0] ?? null;
      cur.note = extra.slice(1).join(' · ') || null;
      lines.push(cur);
    }
    cur = null; extra = [];
  };
  for (let r = start + 1; r < end; r++) {
    const row = v[r] ?? [];
    const a = (row[0] ?? '').trim(), b = (row[1] ?? '').trim();
    if (/^\d+$/.test(a) && b) {
      flush();
      cur = { bls, line_no: Number(a), name: b.replace(/\s+/g, ' '), spec: null, note: null,
              qty: num(row[3]), unit_price: null, delivery_text: delivery, tab };
      if (num(row[5]) !== null) cur.unit_price = num(row[4]);
      continue;
    }
    if (!cur) continue;
    if (!a && !b && !(row[4] ?? '').trim()) { flush(); continue; }   // แถวว่าง = จบรายการ
    if (b) extra.push(b.replace(/\s+/g, ' '));
    if (num(row[5]) !== null && num(row[4]) !== null) cur.unit_price = num(row[4]);
  }
  flush();
  return lines;
}

// ---------------------------------------------------------------------------
// ③ สต็อก · เลือกแท็บวันที่ใหม่สุด (S1)
// ---------------------------------------------------------------------------
export function latestTab(names: string[], prefix: RegExp): string | null {
  let best: { t: string; k: number } | null = null;
  for (const t of names) {
    if (!prefix.test(t)) continue;
    const m = t.match(/(\d{1,2})-(\d{1,2})-(\d{2,4})/);
    if (!m) continue;
    const k = year(m[3], 2026) * 10000 + Number(m[2]) * 100 + Number(m[1]);
    if (!best || k > best.k) best = { t, k };
  }
  return best?.t ?? null;
}

export type StockRow = {
  row_no: number; product: string; brand: string | null; category: string | null; material: string | null;
  color: string | null; size: string | null; total: number | null; by_place: Record<string, string>; note: string | null;
};

export function parseStock(v: string[][]): { rows: StockRow[]; warnings: Warn[] } {
  const h = (v[0] ?? []).map((x) => (x ?? '').replace(/\s+/g, ' ').trim());
  const c = {
    product: col(h, 'Product Name'), brand: col(h, 'Brand'), cat: col(h, 'Categories'),
    material: col(h, 'Material'), color: col(h, 'Color'), size: col(h, 'ขนาด'), total: col(h, 'คงเหลือ'),
    note: col(h, 'หมายเหตุ'),
  };
  if (c.product < 0 || c.total < 0) throw new Error('สต็อก: หาคอลัมน์ "Product Name" หรือ "คงเหลือ" ไม่เจอ');
  // ★ คอลัมน์ที่อยู่ = หลัง "คงเหลือ" ถึงก่อน "หมายเหตุ" · หยุดก่อน Landing Cost เสมอ
  const stop = [c.note, col(h, 'Landing Cost'), col(h, 'Inventory Value'), h.length].filter((i) => i > c.total);
  const last = Math.min(...stop);
  const places: [number, string][] = [];
  for (let i = c.total + 1; i < last; i++) if (h[i] && !/cost|value|ต้นทุน|ราคา/i.test(h[i])) places.push([i, h[i]]);

  const rows: StockRow[] = [];
  for (let r = 1; r < v.length; r++) {
    const row = v[r] ?? [];
    const cell = (i: number) => (i >= 0 ? (row[i] ?? '').trim() : '');
    const product = cell(c.product);
    if (!product) continue;
    const by: Record<string, string> = {};
    for (const [i, name] of places) if (cell(i)) by[name] = cell(i);
    rows.push({
      row_no: r + 1, product, brand: cell(c.brand) || null, category: cell(c.cat) || null,
      material: cell(c.material) || null, color: cell(c.color) || null, size: cell(c.size) || null,
      total: num(cell(c.total)), by_place: by, note: cell(c.note) || null,
    });
  }
  return { rows, warnings: [] };
}

export type FabricRow = { group_name: string; name: string; stock_text: string | null; stock: number | null };

/** ผ้าวางเป็นกองเรียงข้างกัน · แถว 2 มี NO | ชื่อกอง | STOCK ซ้ำไปเรื่อยๆ */
export function parseFabric(v: string[][]): FabricRow[] {
  const head = v[1] ?? [];
  const blocks: { name: number; stock: number; group: string }[] = [];
  head.forEach((x, i) => {
    if ((x ?? '').trim().toUpperCase() === 'NO' && head[i + 1] && /stock/i.test(head[i + 2] ?? '')) {
      blocks.push({ name: i + 1, stock: i + 2, group: head[i + 1].trim() });
    }
  });
  const out = new Map<string, FabricRow>();
  for (let r = 2; r < v.length; r++) {
    for (const b of blocks) {
      const name = (v[r]?.[b.name] ?? '').replace(/\s+/g, ' ').trim();
      if (!name) continue;
      const st = (v[r]?.[b.stock] ?? '').trim();
      out.set(`${b.group}|${name}`, { group_name: b.group, name, stock_text: st || null, stock: num(st) });
    }
  }
  return [...out.values()];
}

// ---------------------------------------------------------------------------
// ④ Clearance
// ---------------------------------------------------------------------------
export type ClearanceRow = {
  row_no: number; full_name: string; code: string | null; collection: string | null; name_en: string | null;
  wood: string | null; wood_colour: string | null; upholstery: string | null; upholstery_colour: string | null;
  size: string | null; nnsku: string | null; retail: number | null; disc_pct: string | null; price: number | null;
};

export function parseClearance(v: string[][]): ClearanceRow[] {
  const h = (v[0] ?? []).map((x) => (x ?? '').replace(/\s+/g, ' ').trim());
  const find = (re: RegExp) => h.findIndex((x) => re.test(x));
  const c = {
    full: find(/^Full name/i), code: find(/โค้ดสินค้า/), coll: find(/Collection Name/i), en: find(/Product name english/i),
    wood: find(/^Wood \(/i), woodc: find(/Wood Colour/i), up: find(/^วัสดุหุ้ม/), upc: find(/^สีวัสดุหุ้ม/),
    w: find(/^กว้าง/), d: find(/^ลึก/), hh: find(/^สูง/), sku: find(/NNSKU/i),
    retail: find(/Retail Price/i), disc: find(/^% Discount/i), price: find(/Discount price/i),
  };
  if (c.full < 0 || c.price < 0) throw new Error('Clearance: หาคอลัมน์ "Full name" หรือ "Discount price" ไม่เจอ');
  const out: ClearanceRow[] = [];
  for (let r = 1; r < v.length; r++) {
    const row = v[r] ?? [];
    const cell = (i: number) => (i >= 0 ? (row[i] ?? '').replace(/\s+/g, ' ').trim() : '');
    const full = cell(c.full);
    if (!full) continue;
    out.push({
      row_no: r + 1, full_name: full, code: cell(c.code) || null, collection: cell(c.coll) || null,
      name_en: cell(c.en) || null, wood: cell(c.wood) || null, wood_colour: cell(c.woodc) || null,
      upholstery: cell(c.up) || null, upholstery_colour: cell(c.upc) || null,
      size: [cell(c.w), cell(c.d), cell(c.hh)].filter(Boolean).join(' ') || null,
      nnsku: cell(c.sku) || null, retail: num(cell(c.retail)), disc_pct: cell(c.disc) || null, price: num(cell(c.price)),
    });
  }
  return out;
}
