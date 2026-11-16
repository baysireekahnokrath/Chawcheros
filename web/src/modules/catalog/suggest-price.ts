/**
 * ราคาแนะนำสำหรับ "ขนาดใหม่" ของรุ่นที่มีอยู่แล้ว
 *
 * โจทย์จาก Bay (2026-11-16)
 *   "Phoenix Coffee table ถ้าเปลี่ยนขนาดมาแบบนี้แล้ว ราคาเท่าไหร่ดี
 *    เทียบบัญญัติไตรยางศ์ให้เลย"
 *
 * ★ บัญญัติไตรยางศ์เปล่า ๆ ใช้กับเฟอร์นิเจอร์ไม่ได้ และพิสูจน์ได้ด้วยตัวมันเอง
 *   โต๊ะกลางฟีนิกซ์ W120 D90 ราคา 45,000
 *     หารตามพื้นที่  → W120 D60 ได้ 30,000
 *     หารตามด้านยาว → W120 D60 ได้ 45,000
 *   ตัวเดียวกัน ต่างกัน 15,000 แค่เปลี่ยนว่าหารด้วยอะไร
 *
 *   เหตุผลคือของที่หายไปตอนย่อขนาดมีแค่ "ท็อป" · เฟรม ขา เชื่อม พ่นสี ประกอบ
 *   แพ็ก ส่ง เท่าเดิมหมด · ราคาจึงเป็น  คงที่ + แปรตามขนาด  ไม่ใช่สัดส่วนล้วน
 *
 * ★ ถ้ารุ่นนั้นมีหลายขนาดอยู่แล้ว ไม่ต้องสมมติอะไรเลย
 *   ถอดเส้นตรง  ราคา = a + b × ขนาด  ออกมาจากราคาจริงที่ขายอยู่
 *   a คือส่วนคงที่ที่ของจริงบอกเอง · แม่นกว่าการเดาทุกกรณี
 *   เหลือขนาดเดียวค่อยใช้ค่าสมมติ และต้องบอกคนใช้ว่านี่คือค่าสมมติ
 *
 * ไฟล์นี้เป็นตรรกะล้วน ไม่มี import ของจริง · ทดสอบด้วย
 *   node --experimental-strip-types scripts/suggest-price.test.mts
 */

/** ขนาดหนึ่งชุด · ค่าที่ไม่รู้ปล่อย null ได้ */
export type Dim = { w: number | null; d: number | null; h: number | null };

/** ตัวที่มีอยู่แล้วในรุ่นเดียวกัน เอาไว้ใช้เป็นหลักฐานตั้งราคา */
export type Point = Dim & { retail: number; label?: string };

/** ย่อขนาดให้เหลือตัวเลขเดียวที่ใช้เทียบกันได้ */
export type Basis = 'พื้นที่' | 'ความกว้าง';

/**
 * หมวดไหนคิดด้วยอะไร
 *
 * โซฟา ม้านั่ง เตียง — ความลึกแทบไม่เปลี่ยน คนสั่งเปลี่ยนความกว้าง
 *   ของที่เพิ่มคือที่นั่งกับโครง ซึ่งโตตามความกว้างตรง ๆ
 * โต๊ะ ตู้ ชั้น — ท็อปคือของที่แพงที่สุดและโตตามพื้นที่
 */
export function basisFor(category: string): Basis {
  const c = (category ?? '').trim();
  if (/โซฟา|ที่นั่ง|เดย์เบด|ม้านั่ง|สตูล|อาร์มแชร์|เลาจ์|เก้าอี้|เบาะ|recliner/i.test(c)) {
    return 'ความกว้าง';
  }
  return 'พื้นที่';
}

/** ค่าที่เอาไปเข้าสูตร · คืน null ถ้าขนาดไม่พอจะคิด */
export function sizeValue(dim: Dim, basis: Basis): number | null {
  if (basis === 'ความกว้าง') return dim.w && dim.w > 0 ? dim.w : null;
  if (!dim.w || !dim.d || dim.w <= 0 || dim.d <= 0) return null;
  return dim.w * dim.d;
}

/** ปัดให้เป็นตัวเลขที่พูดกับลูกค้าได้ · หลักพันเมื่อเกินหมื่น ไม่งั้นหลักร้อย */
export function roundPrice(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0;
  const step = n >= 10_000 ? 1_000 : 100;
  return Math.round(n / step) * step;
}

export type Suggestion = {
  /** ราคาเต็มรวม VAT ที่แนะนำ ปัดแล้ว */
  price: number;
  /** ก่อนปัด · เอาไว้โชว์ว่าปัดไปเท่าไหร่ */
  raw: number;
  basis: Basis;
  /** 'ถอดจากราคาจริง' = เชื่อถือได้ · 'สมมติส่วนคงที่' = เดา ต้องบอกคน */
  method: 'ถอดจากราคาจริง' | 'สมมติส่วนคงที่';
  /** ส่วนคงที่เป็น % ของราคาตัวที่ใหญ่ที่สุดที่ใช้อ้างอิง */
  fixedPct: number;
  /** จุดที่เอามาใช้คิด เรียงตามขนาด */
  used: Point[];
  /** เตือนเมื่อขนาดใหม่อยู่นอกช่วงที่มีข้อมูล */
  warn: string;
  /** อธิบายเป็นประโยคเดียว ใช้โชว์ใต้ตัวเลข */
  how: string;
};

/** สัดส่วนล้วน ๆ แบบบัญญัติไตรยางศ์ · เก็บไว้โชว์เทียบให้เห็นว่าต่ำไปแค่ไหน */
export function proportional(points: Point[], target: Dim, basis: Basis): number | null {
  const ref = pickRef(points, basis);
  if (!ref) return null;
  const x = sizeValue(target, basis);
  const x0 = sizeValue(ref, basis);
  if (!x || !x0) return null;
  return ref.retail * (x / x0);
}

/** ตัวอ้างอิงหลัก = ตัวที่ใหญ่ที่สุดที่มีราคา (ปกติคือรุ่นมาตรฐาน) */
function pickRef(points: Point[], basis: Basis): Point | null {
  let best: Point | null = null;
  let bestX = -1;
  for (const p of points) {
    const x = sizeValue(p, basis);
    if (x === null || !(p.retail > 0)) continue;
    if (x > bestX) { best = p; bestX = x; }
  }
  return best;
}

/** สัดส่วนที่ถือว่า "คงที่" เมื่อมีขนาดเดียวให้อ้างอิง */
export const DEFAULT_FIXED = 0.6;

/**
 * ราคาแนะนำของขนาดใหม่
 *
 * @param points ตัวที่มีอยู่แล้วในรุ่น+หมวด+เกรดเดียวกัน
 * @param target ขนาดใหม่ที่อยากได้
 * @param fixed  สัดส่วนคงที่ที่ใช้เมื่อมีจุดเดียว (0-1) · ค่าตั้งต้น 0.6
 */
export function suggestPrice(
  points: Point[],
  target: Dim,
  basis: Basis,
  fixed: number = DEFAULT_FIXED,
): Suggestion | null {
  const x = sizeValue(target, basis);
  if (!x) return null;

  // เอาเฉพาะจุดที่คิดได้จริง และรวมขนาดซ้ำให้เหลือค่าเฉลี่ยจุดเดียว
  const byX = new Map<number, { sum: number; n: number; p: Point }>();
  for (const p of points) {
    const px = sizeValue(p, basis);
    if (px === null || !(p.retail > 0)) continue;
    const slot = byX.get(px);
    if (slot) { slot.sum += p.retail; slot.n += 1; }
    else byX.set(px, { sum: p.retail, n: 1, p });
  }
  if (byX.size === 0) return null;

  const used = [...byX.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, v]) => ({ ...v.p, retail: v.sum / v.n }));

  const xs = [...byX.keys()].sort((a, b) => a - b);
  const lo = xs[0], hi = xs[xs.length - 1];
  const warn =
    x > hi * 1.3 ? 'ขนาดใหม่ใหญ่กว่าทุกตัวที่มีข้อมูลมาก — ตัวเลขนี้เป็นการคาดนอกช่วง'
    : x < lo * 0.5 ? 'ขนาดใหม่เล็กกว่าทุกตัวที่มีข้อมูลมาก — ตัวเลขนี้เป็นการคาดนอกช่วง'
    : '';

  // ── มีหลายขนาด → ถอดเส้นตรงจากของจริง ────────────────────────────────
  if (byX.size >= 2) {
    const n = used.length;
    const sx = xs.reduce((s, v) => s + v, 0);
    const sy = used.reduce((s, p) => s + p.retail, 0);
    const sxx = xs.reduce((s, v) => s + v * v, 0);
    const sxy = used.reduce((s, p, i) => s + xs[i] * p.retail, 0);
    const den = n * sxx - sx * sx;
    if (den !== 0) {
      const b = (n * sxy - sx * sy) / den;
      const a = (sy - b * sx) / n;
      // ใหญ่ขึ้นต้องไม่ถูกลง และของแถมฟรีไม่มี — ข้อมูลเพี้ยนก็ถอยไปใช้ค่าสมมติ
      if (b > 0 && a >= 0) {
        const raw = a + b * x;
        const atHi = a + b * hi;
        return {
          price: roundPrice(raw), raw, basis, method: 'ถอดจากราคาจริง',
          fixedPct: atHi > 0 ? Math.round((a / atHi) * 100) : 0,
          used, warn,
          how: `ถอดจากราคาจริง ${byX.size} ขนาดในรุ่นนี้ · ส่วนคงที่ประมาณ ` +
               `${atHi > 0 ? Math.round((a / atHi) * 100) : 0}% ของตัวใหญ่สุด`,
        };
      }
    }
  }

  // ── มีขนาดเดียว (หรือข้อมูลเพี้ยน) → คงที่ + แปรผัน ตามค่าที่ตั้งไว้ ──
  const f = Math.min(Math.max(fixed, 0), 1);
  const ref = used[used.length - 1];
  const x0 = sizeValue(ref, basis)!;
  const raw = ref.retail * (f + (1 - f) * (x / x0));
  return {
    price: roundPrice(raw), raw, basis, method: 'สมมติส่วนคงที่',
    fixedPct: Math.round(f * 100), used, warn,
    how: `รุ่นนี้มีขนาดเดียวให้เทียบ · สมมติว่าค่าคงที่ ${Math.round(f * 100)}% ` +
         `ที่เหลือแปรตาม${basis} — ปรับตัวเลขนี้ได้`,
  };
}

/**
 * แกะขนาดจากข้อความที่คนพิมพ์
 *
 * รองรับที่เจอจริง · "60*120 cm" · "W120 D60 H40" · "200 cm" · "1.00m"
 * · "120x90x40" · "กว้าง 200 ลึก 45"
 *
 * ★ เขียนแบบ "60*120" ตัวไหนคือกว้าง
 *   ของจริงลูกค้าเขียนลึกก่อนบ้าง กว้างก่อนบ้าง · ยึดว่า "ตัวใหญ่กว่าคือกว้าง"
 *   เพราะโต๊ะกลางกับตู้ไม่มีรุ่นไหนลึกกว่ากว้าง · และหน้าเว็บให้สลับได้อยู่แล้ว
 */
export function parseSize(text: string): Dim {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  const out: Dim = { w: null, d: null, h: null };
  if (!t) return out;

  /**
   * ★ "cm" ลงท้ายด้วย m · เทียบแบบ /m$/ จะอ่าน 200 cm เป็น 2 เมตร = 20,000 ซม.
   *   แล้วตกช่วงที่รับได้ กลายเป็นหาขนาดไม่เจอเฉย ๆ · ต้องเทียบทั้งคำเท่านั้น
   */
  const num = (s: string, unit: string) => {
    const v = parseFloat(s);
    if (!Number.isFinite(v)) return null;
    const u = (unit ?? '').trim().toLowerCase();
    return u === 'm' || u === 'm.' || u === 'เมตร' ? v * 100 : v;
  };

  /**
   * รูปแบบที่บอกชัดว่าตัวไหนคืออะไร มาก่อนเสมอ
   *
   * ★ ห้ามใช้ \b หน้าคำไทย · JS ถือว่าอักษรไทยไม่ใช่ word char ขอบคำจึงไม่เกิด
   *   "กว้าง 200 ลึก 45" ที่ขึ้นต้นบรรทัดจะไม่แมตช์เลย — ใช้ lookbehind แทน
   */
  const label = /(?<![A-Za-z฀-๿])(w|d|h|กว้าง|ลึก|สูง)\s*[:=]?\s*(\d+(?:\.\d+)?)\s*(cm|ซม\.?|mm|มม\.?|m\.?|เมตร)?/gi;
  let m: RegExpExecArray | null;
  let got = false;
  while ((m = label.exec(t))) {
    const v = num(m[2], m[3] ?? '');
    if (v === null) continue;
    const k = m[1].toLowerCase();
    if (k === 'w' || k === 'กว้าง') { out.w = v; got = true; }
    else if (k === 'd' || k === 'ลึก') { out.d = v; got = true; }
    else if (k === 'h' || k === 'สูง') { out.h = v; got = true; }
  }
  if (got) return out;

  // 60*120 · 120x90x40 · 60 x 100 cm
  const chain = /(\d+(?:\.\d+)?)\s*[x×*]\s*(\d+(?:\.\d+)?)(?:\s*[x×*]\s*(\d+(?:\.\d+)?))?/i;
  const c = chain.exec(t);
  if (c) {
    const metre = /\d\s*(?:m|เมตร)\.?(?![a-z฀-๿])/i.test(t)
      && !/\d\s*(?:cm|mm|ซม|มม)/i.test(t);
    const unit = metre ? 'm' : '';
    const a = num(c[1], unit)!, b = num(c[2], unit)!;
    const third = c[3] ? num(c[3], unit) : null;
    if (third !== null) { out.w = a; out.d = b; out.h = third; }
    else { out.w = Math.max(a, b); out.d = Math.min(a, b); }
    return out;
  }

  // เลขตัวเดียว = ความกว้าง · "Krasa Tv Cabinet 200 cm" · "Emu Bench 1.00m."
  const one = /(\d+(?:\.\d+)?)\s*(cm|ซม\.?|m\.?|เมตร)?(?![฀-๿\w])/i.exec(t);
  if (one) {
    const v = num(one[1], one[2] ?? '');
    if (v !== null && v >= 20 && v <= 500) out.w = v;
  }
  return out;
}

/** ข้อความขนาดแบบที่ใบราคาใช้ */
export const dimText = (d: Dim) =>
  [d.w && `W${d.w}`, d.d && `D${d.d}`, d.h && `H${d.h}`].filter(Boolean).join(' ');
