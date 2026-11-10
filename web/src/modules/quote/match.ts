/**
 * จับคู่บรรทัดที่ลูกค้าเขียน กับแถวในใบราคา
 *
 * ★ ไม่เดาแทนคน
 *   คืน "ผู้เข้าชิง" พร้อมคะแนน แล้วให้คนกดเลือก · เจอตัวเดียวชัด ๆ ถึงจะเลือกให้ล่วงหน้า
 *   เจอหลายขนาด (สตูลขอนไม้มี Size S กับ Size L) ต้องถามเสมอ
 *   ไม่เจอเลยก็บอกตรง ๆ ว่าไม่เจอ ดีกว่าเดาผิดแล้วราคาผิด
 *
 * ★ ใบราคาเก็บวัสดุเป็น "เกรด" (ผ้า A/B/C หนังแท้) ไม่ใช่ชื่อผ้าจริง
 *   ลูกค้าเขียนมาว่า "PVC SM Wheat" ซึ่งเป็นชื่อผ้าจริง ระบบจึงเทียบเกรดให้ไม่ได้
 *   ต้องให้คนเลือกเกรดเอง · ข้อความที่ลูกค้าเขียนจะถูกยกไปใส่บรรทัดวัสดุในใบเสนอราคา
 */

import type { PriceRow } from '@/modules/pricing/queries';

export type Variant = {
  variant_id: string;
  grade: string;          // เกรดวัสดุ หรือ '' ถ้าสินค้าไม่คิดตามเกรด
  retail: number | null;   // ราคาเต็มรวม VAT
  sale: number | null;     // ราคาหลังส่วนลดปกติ รวม VAT
  disc: number;
};

export type Product = {
  key: string;
  /** ชื่อเต็มแบบที่ใช้ในใบเสนอราคา บรรทัดแรก */
  head: string;
  /** บรรทัดสอง · วัสดุและขนาด */
  sub: string;
  collection: string;
  category: string;
  en: string;
  size: string;
  w: number | null; d: number | null; h: number | null;
  wood: string;
  image: string | null;
  variants: Variant[];
};

const clean = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();
const norm = (s: string) =>
  clean(s).toLowerCase().replace(/[()[\]{}.,]/g, ' ').replace(/\s+/g, ' ').trim();

/** W180 D44.5 H45 → ข้อความขนาดแบบที่ใบเสนอราคาใช้ */
export const sizeText = (w: number | null, d: number | null, h: number | null) =>
  [w && `W${w}`, d && `D${d}`, h && `H${h}`].filter(Boolean).join(' ');

/** รวมแถวใบราคาเป็น "สินค้า" หนึ่งตัวที่มีหลายเกรด */
export function buildProducts(rows: PriceRow[]): Product[] {
  const by = new Map<string, Product>();
  for (const r of rows) {
    const w = r.กว้าง, d = r.ลึก, h = r.สูง;
    const key = [clean(r.รุ่น), clean(r.หมวด), clean(r.รูปทรง), w, d, h,
                 clean(r.ไม้), clean(r.สีไม้)].join('|');
    let p = by.get(key);
    if (!p) {
      const bare = clean(r.ชื่ออังกฤษ).replace(/^\(|\)$/g, '');
      const en = bare ? `(${bare})` : '';
      const wood = [clean(r.ไม้), clean(r.สีไม้)].filter(Boolean).join(' ');
      p = {
        key,
        head: clean(`ฌ เฌอ | ${clean(r.หมวด)} ${clean(r.รูปทรง)} ${clean(r.รุ่น)} ${en}`),
        sub: '',
        collection: clean(r.รุ่น), category: clean(r.หมวด), en,
        size: sizeText(w, d, h), w, d, h, wood,
        image: clean(r.รูป) || null,
        variants: [],
      };
      by.set(key, p);
    }
    p.variants.push({
      variant_id: r.variant_id,
      grade: clean(r.เกรดวัสดุ),
      retail: r.ราคาเต็มรวม_vat,
      sale: r.ราคาขายรวม_vat,
      disc: Math.round(r.ส่วนลดปกติ_pct ?? 0),
    });
  }
  for (const p of by.values()) {
    p.variants.sort((a, b) => (a.retail ?? 0) - (b.retail ?? 0));
    p.sub = clean([p.wood, p.size && `ขนาด ${p.size} cm`].filter(Boolean).join(' | '));
  }
  return [...by.values()];
}

export type Hit = { p: Product; score: number; why: string };

/**
 * น้ำหนักของคำ · คำที่หายากบอกอะไรได้มากกว่าคำที่โผล่ทุกแถว
 *
 * ★ เคสที่ทำให้ต้องมีตรงนี้
 *   ลูกค้าเขียน "Emu Bench 1.00m." ซึ่งไม่มีในใบราคา
 *   คำว่า emu โผล่ในสินค้า ~50 ตัว ส่วน bench โผล่ 4 ตัว
 *   ถ้านับทุกคำเท่ากัน ของอีมูจะยึดรายชื่อจนไม่เห็นม้านั่งสักตัว
 *   ทั้งที่ม้านั่งคือสิ่งที่ลูกค้าหมายถึง
 */
const idfCache = new WeakMap<Product[], Map<string, number>>();
function idfOf(products: Product[]): Map<string, number> {
  const hit = idfCache.get(products);
  if (hit) return hit;
  const df = new Map<string, number>();
  for (const p of products) {
    const seen = new Set(norm([p.en, p.collection, p.category, p.wood].join(' ')).split(' '));
    for (const w of seen) if (w.length > 1) df.set(w, (df.get(w) ?? 0) + 1);
  }
  const n = Math.max(1, products.length);
  const idf = new Map<string, number>();
  for (const [w, c] of df) idf.set(w, Math.log(1 + n / c));
  idfCache.set(products, idf);
  return idf;
}

/**
 * หาผู้เข้าชิงจากข้อความที่ลูกค้าเขียน
 *
 * คะแนน · ชื่ออังกฤษตรงทั้งก้อนได้มากสุด ลงมาเป็นตรงทีละคำ
 * ขนาดที่ลูกค้าเขียน (เช่น 1.00m.) ถ้าตรงกับความกว้างจะได้แต้มเพิ่ม
 */
export function matchLine(text: string, products: Product[], limit = 8): Hit[] {
  const q = norm(text);
  if (!q) return [];
  const words = q.split(' ').filter((w) => w.length > 1);

  /** ความกว้างที่ลูกค้าเขียน · "1.00m." = 100 ซม. · "180 cm" = 180 ซม.
   *  ★ อ่านจากข้อความดิบ ไม่ใช่ตัวที่ normalize แล้ว · norm() เปลี่ยนจุดเป็นช่องว่าง
   *    "1.55m." จึงกลายเป็น "1 55m" แล้วอ่านได้ 55 เมตร */
  const raw = clean(text);
  const mm = /(\d+(?:\.\d+)?)\s*(m\b|m\.|เมตร|cm\b|ซม)/i.exec(raw);
  // ไม่มีหน่วยก็เดาได้ · คนเขียน "Koontong Sideboard 120" หมายถึง 120 ซม.
  // จำกัดช่วง 40-400 กันไปชนตัวเลขที่เป็นส่วนหนึ่งของชื่อรุ่น
  const bare = !mm && [...raw.matchAll(/\b(\d{2,3})\b/g)]
    .map((x) => +x[1]).filter((n) => n >= 40 && n <= 400).pop();
  const wantW = mm
    ? Math.round(+mm[1] * (/^(m\b|m\.|เมตร)/i.test(mm[2]) ? 100 : 1))
    : (bare || null);

  const idf = idfOf(products);
  const weightOf = (w: string) => idf.get(w) ?? Math.log(1 + products.length);
  const totalW = words.reduce((s, w) => s + weightOf(w), 0) || 1;

  const out: Hit[] = [];
  for (const p of products) {
    const hay = norm([p.en, p.collection, p.category, p.wood].join(' '));
    let score = 0;
    const why: string[] = [];

    const enN = norm(p.en);
    if (enN && q.includes(enN)) { score += 60; why.push('ชื่ออังกฤษตรงทั้งชื่อ'); }

    let hitWords = 0, hitW = 0;
    for (const w of words) if (hay.includes(w)) { hitWords++; hitW += weightOf(w); }
    if (words.length) {
      score += Math.round((hitW / totalW) * 45);
      if (hitWords) why.push(`ตรง ${hitWords}/${words.length} คำ`);
    }

    if (wantW != null && p.w != null) {
      if (Math.abs(p.w - wantW) <= 2) { score += 25; why.push(`กว้าง ${p.w} ตรงกับที่ขอ`); }
      else score -= 3;   // ไม่ตรงก็ยังอยากให้เห็น · ของที่ลูกค้าขออาจไม่มีในใบราคา
    }

    if (score > 0) out.push({ p, score, why: why.join(' · ') });
  }

  out.sort((a, b) => b.score - a.score || (a.p.collection < b.p.collection ? -1 : 1));

  // อย่าให้รุ่นเดียวกันยึดรายชื่อทั้งหมด · คนเลือกอยากเห็นทางเลือกที่ต่างกัน
  // แต่ตัวที่ความกว้างตรงกับที่ลูกค้าขอ ต้องไม่โดนตัดทิ้งไม่ว่ากรณีไหน
  const exact = (h: Hit) => wantW != null && h.p.w != null && Math.abs(h.p.w - wantW) <= 2;
  const seen = new Map<string, number>();
  const keep: Hit[] = [], spill: Hit[] = [];
  for (const h of out) {
    if (exact(h)) { keep.push(h); continue; }
    const k = `${h.p.collection}|${h.p.category}`;
    const n = seen.get(k) ?? 0;
    seen.set(k, n + 1);
    (n < 2 ? keep : spill).push(h);
  }
  return [...keep, ...spill].slice(0, limit);
}

/** เลือกให้ล่วงหน้าได้ไหม · ชัดเจนพอเมื่อที่หนึ่งนำที่สองขาดลอย */
export function confident(hits: Hit[]): boolean {
  if (!hits.length || hits[0].score < 60) return false;
  return hits.length === 1 || hits[0].score - hits[1].score >= 20;
}
