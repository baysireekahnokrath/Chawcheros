/**
 * คิดให้ว่า "ขนาดเท่านี้ ต่อกันยังไงได้บ้าง"
 *
 * โจทย์จาก Bay (2026-11-12)
 *   "ทากะ ทุกรุ่น (214 ไม่มีในใบราคา → ให้เลือกเอง)
 *    ต้องฉลาดไปคิดให้ผม ว่าจะต่อกันยังไงให้ได้ขนาดนี้ โซฟา กับ เดย์เบด"
 *
 * คนขายเขียน "taka 214" เพราะวัดพื้นที่มาได้ 214 ซม. ไม่ได้หมายถึงรุ่นที่ชื่อ 214
 * ของเดิมบอกแค่ "ไม่มีในใบราคา เลือกเอง" ซึ่งเท่ากับโยนงานกลับไปให้คนถาม
 *
 * ★ ต่อเฉพาะในรุ่นเดียวกัน · ไม่เอาทากะไปต่อกับฟีนิกซ์
 * ★ ต่อเฉพาะของที่วางเรียงกันเป็นแถวได้ · หมอน ที่พักหัว โต๊ะ ตู้ ไม่นับความกว้าง
 * ★ ไม่ตัดสินใจแทนคน · คืนทางเลือกพร้อมตัวเลขให้เลือก และบอกตรง ๆ ถ้าต่อไม่ได้พอดี
 */

import type { Product } from './match';

/**
 * หมวดที่วางเรียงกันเป็นแถวแล้วนับความกว้างรวมได้
 *
 * ★ ต้องรับหมวดที่ขึ้นต้นว่า "N ที่นั่ง" ด้วย
 *   ทากะลงโมดูลตัวต่อไว้เป็นหมวด "1 ที่นั่ง 1 แขน" (W90) กับ "1 ที่นั่ง ไม่มีแขน" (W83)
 *   ซึ่งคือชิ้นที่เอามาต่อกันจริง ๆ · ถ้าไม่รับ จะเหลือแต่ตัวสำเร็จรูปแล้วต่ออะไรไม่ได้เลย
 */
const SEATING = new Set([
  'โซฟา', 'เดย์เบด', 'อาร์มแชร์', 'เลาจ์แชร์', 'สตูล', 'ม้านั่ง', 'เก้าอี้', 'Recliner',
]);
const isSeating = (cat: string) => SEATING.has(cat) || /ที่นั่ง/.test(cat);

export type FitPiece = { p: Product; qty: number };
export type Fit = {
  pieces: FitPiece[];
  /** ความกว้างรวม ซม. */
  width: number;
  /** ห่างจากที่ขอกี่ ซม. · ลบคือแคบกว่า */
  diff: number;
  /** ลึกสุดของชุด · เดย์เบดลึกกว่าตัวโซฟา */
  depth: number;
  /** ราคาเต็มรวม และราคาหลังลด ของเกรดที่ถูกที่สุดในแต่ละชิ้น */
  retail: number;
  sale: number;
};

const cheapest = (p: Product) =>
  p.variants.reduce<{ retail: number; sale: number }>((best, v) => {
    const r = v.retail ?? v.sale ?? 0;
    const s = v.sale ?? v.retail ?? 0;
    return !best.retail || r < best.retail ? { retail: r, sale: s } : best;
  }, { retail: 0, sale: 0 });

/** ของที่เอามาต่อกันได้ในรุ่นนี้ · ตัดของซ้ำขนาดเดียวกันออก เหลือตัวที่ถูกสุด */
export function modulesOf(products: Product[], collection: string): Product[] {
  const by = new Map<string, Product>();
  for (const p of products) {
    if (p.collection !== collection || !isSeating(p.category) || !p.w) continue;
    const k = `${p.category}|${p.w}|${p.d}`;
    const cur = by.get(k);
    if (!cur || cheapest(p).retail < cheapest(cur).retail) by.set(k, p);
  }
  return [...by.values()].sort((a, b) => (b.w ?? 0) - (a.w ?? 0));
}

/**
 * หาชุดที่ความกว้างรวมใกล้ที่สุด
 *
 * @param target  ความกว้างที่ต้องการ ซม.
 * @param tol     ยอมห่างได้กี่ ซม. (ค่าตั้งต้น 12)
 * @param maxPieces  ต่อได้มากสุดกี่ชิ้น (ค่าตั้งต้น 3)
 */
export function fitWidth(
  mods: Product[],
  target: number,
  { tol = 12, maxPieces = 3, limit = 6 } = {},
): Fit[] {
  if (!mods.length || !(target > 0)) return [];
  const out: Fit[] = [];
  const seen = new Set<string>();

  const add = (picked: Product[]) => {
    const width = picked.reduce((s, p) => s + (p.w ?? 0), 0);
    const diff = width - target;
    if (Math.abs(diff) > tol) return;
    const key = picked.map((p) => p.key).sort().join('//');
    if (seen.has(key)) return;
    seen.add(key);

    // ยุบชิ้นซ้ำให้เป็นจำนวน
    const by = new Map<string, FitPiece>();
    for (const p of picked) {
      const hit = by.get(p.key);
      if (hit) hit.qty++; else by.set(p.key, { p, qty: 1 });
    }
    const pieces = [...by.values()];
    let retail = 0, sale = 0;
    for (const x of pieces) {
      const c = cheapest(x.p);
      retail += c.retail * x.qty;
      sale += c.sale * x.qty;
    }
    out.push({
      pieces, width, diff,
      depth: Math.max(0, ...picked.map((p) => p.d ?? 0)),
      retail, sale,
    });
  };

  /* ไล่ทุกชุดที่เป็นไปได้ · โมดูลมีไม่กี่ตัวต่อรุ่น ไล่ตรง ๆ เร็วกว่าคิดสูตร */
  const walk = (start: number, picked: Product[], width: number) => {
    if (picked.length) add(picked);
    if (picked.length >= maxPieces) return;
    for (let i = start; i < mods.length; i++) {
      const w = mods[i].w ?? 0;
      if (width + w > target + tol) continue;   // กว้างเกินไปแล้ว ข้าม
      picked.push(mods[i]);
      walk(i, picked, width + w);               // i ไม่ +1 · ซื้อซ้ำตัวเดิมได้
      picked.pop();
    }
  };
  walk(0, [], 0);

  out.sort((a, b) =>
    Math.abs(a.diff) - Math.abs(b.diff) ||
    a.pieces.reduce((s, x) => s + x.qty, 0) - b.pieces.reduce((s, x) => s + x.qty, 0) ||
    a.sale - b.sale);
  return out.slice(0, limit);
}

/**
 * ชื่อชิ้นแบบสั้น · ต้องมีความลึกด้วย
 * ฟีนิกซ์มี "โซฟา 125" (เดย์เบด ลึก 166) กับ "สตูล 125" (ลึก 91) กว้างเท่ากันแต่คนละตัว
 */
export const pieceName = (p: Product) =>
  [p.category, p.w && `${p.w}${p.d ? `×${p.d}` : ''}`].filter(Boolean).join(' ');

/** ข้อความสั้น ๆ อธิบายชุด · "โซฟา 230×96 + เดย์เบด 125×166 = 355 ซม." */
export function fitText(f: Fit): string {
  const parts = f.pieces.map((x) =>
    (x.qty > 1 ? `${pieceName(x.p)} ×${x.qty}` : pieceName(x.p)));
  return `${parts.join(' + ')} = ${f.width} ซม.`;
}
