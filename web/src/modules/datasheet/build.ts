import type { PriceRow } from '@/modules/pricing/queries';

/**
 * รวมแถวใบราคาให้เป็น data sheet
 *
 * ★ ทำไมไม่สร้างวิวใหม่ในฐานข้อมูล
 *   data sheet ไม่มีข้อมูลที่ใบราคาไม่มี มันคือใบราคาที่ยุบเกรดวัสดุทิ้ง
 *   แล้วเหลือ "1 แถว = 1 โมดูล" แทน "1 แถว = 1 ตัวสินค้า"
 *   ใช้ pricing.v_price_list ที่มี RLS คุมอยู่แล้ว ไม่ต้องเปิดสิทธิ์ใหม่
 *   และไม่มีทางที่ data sheet จะเห็นของที่ใบราคาเห็นไม่ได้
 *
 * ★ ไม่มีราคาสักช่องในนี้ ตั้งใจ
 *   data sheet โรงงาน (Phoenix/koontong) ไม่ใส่ราคา เพราะราคาเปลี่ยนบ่อยกว่าขนาด
 *   แผ่นที่ไม่มีราคาส่งให้ดีลเลอร์หรือสถาปนิกได้เลย ไม่ต้องกลัวหลุด
 */

export type Module = {
  code: string;
  sub: string;
  w: number | null;
  d: number | null;
  h: number | null;
  seatH: number | null;
  /**
   * ความลึกช่วงหลังของโซฟาตัว L
   *
   * ★ ตัวเลขนี้ไม่มีในฐานข้อมูล · ใบราคากระดาษเขียนไว้ในวงเล็บ ("D162 (90)")
   *   แต่ตอน import เข้าระบบ เหลือแค่เลขแรก
   *   ตรงนี้จึงเอาความลึกของโซฟาตรงในรุ่นเดียวกันมาใช้แทน ซึ่งคือตัวเดียวกัน
   *   ทากะได้ 90 · ขุนทองได้ 80 ตรงกับที่ใบราคากระดาษเขียนไว้
   *   รุ่นที่ไม่มีโซฟาตรงให้เทียบ (เช่น สวอน) จะเป็น null แล้ววาดเป็นกรอบรวมแทน
   *   ไม่เดาเอง
   */
  backD: number | null;
  /** true = รหัสนี้ชนกับแถวอื่น ระบบต้องต่อท้ายให้ต่าง */
  ambiguous: boolean;
  mats: string[];
  woods: string[];
  colours: string[];
  variants: number;
};

/**
 * ★ ไม่มีคำอธิบายจากเว็บอยู่ในนี้ ตั้งใจ
 *   ไฟล์นี้ทำอย่างเดียวคือจัดกลุ่มกับตั้งรหัส · คำอธิบายเป็นเรื่องของหน้าจอ
 *   แยกแล้วเทสต์รันได้ด้วย node ตรง ๆ ไม่ต้องคอมไพล์ก่อน
 */
export type Group = { cat: string; mods: Module[]; image: string | null };

/** สองแถวในใบราคาที่ระบบตั้งชื่อแยกให้ไม่ได้ · ต้องให้คนดูตัดสิน */
export type Ambiguous = { cat: string; codes: string[]; subs: string[] };

export type Sheet = {
  th: string;
  en: string;
  prefix: string;
  /** true = รหัสมาจาก data sheet โรงงานจริง · false = รหัสที่เราเสนอ */
  codeReal: boolean;
  groups: Group[];
  variants: number;
  modules: number;
  /** แถวที่แยกชื่อไม่ออก · ให้หน้าจอเตือนได้ ไม่ต้องรอคนสังเกตเอง */
  ambiguous: Ambiguous[];
};

/* ---------------------------------------------------------------- รหัสสินค้า */

/** ตัวย่อที่มาจาก data sheet โรงงานจริง */
const REAL_PREFIX: Record<string, string> = { 'ฟีนิกซ์': 'PHX', 'ขุนทอง': 'KT' };

/** ตัวย่อที่เราเสนอ · ยังไม่ได้ยืนยันกับโรงงาน */
const PREFIX: Record<string, string> = {
  'ทากะ': 'TK', 'สวอน': 'SW', 'อีมู': 'EMU', 'พัฟฟิน': 'PF', 'นางแอ่น': 'NA',
  'อัญชัน': 'AC', 'นกแก้ว': 'NK', 'กระเรียน': 'KR', 'โอมุ': 'OM', 'อินทรี': 'IS',
  'กระสา': 'KS', 'ขมิ้น': 'KM', 'นางนวล': 'NN', 'ฮูก': 'HK', 'นางนวล / กระสา': 'NNKS',
  'ฟลามิงโก้': 'FL', 'กระทา': 'KTA', 'กีวี่': 'KW', 'ขอนไม้': 'KN', 'นกยูง': 'NY',
  'กางเขน': 'KK', 'มินิเนส': 'MN', 'เบิร์ด': 'BD', 'เนส': 'NS', 'โอบ': 'OB',
  'กระตั้ว': 'KTU', 'กีวี่ โซฟา': 'KWS', 'ฟลามิงโก': 'FLS', 'ดิน': 'DN',
  'ชิน': 'CH', 'ฌ เฌอ': 'CC',
};

const CAT_SUFFIX: Record<string, string> = {
  'โซฟา': '', 'สตูล': '-ST', 'อาร์มแชร์': '-AC', 'เลาจ์แชร์': '-LC', 'โคซี่แชร์': '-CZ',
  'เก้าอี้': '-CH', 'เตียง': '-BED', 'ที่พักหัว': '-HR', 'หมอน': '-PL',
  'โต๊ะกลาง': '-CT', 'โต๊ะข้าง': '-SDT', 'โต๊ะข้างเตียง': '-NT', 'โต๊ะทานข้าว': '-DT',
  'ม้านั่ง': '-BN', 'ตู้เก็บของ': '-SB', 'ชั้นวางทีวี': '-TV', 'ชั้นวางหนังสือ': '-BS',
  'Recliner': '-RC', 'ศาลเจ้า (ตี่จู่เอี๊ยะ)': '-SH',
  '1 ที่นั่ง 1 แขน': '-1R', '1 ที่นั่ง ไม่มีแขน': '-1NA', '3 ที่นั่ง ไม่มีแขน': '-3NA',
};

const SUB_TAG: Record<string, string> = {
  '2 ที่นั่ง': '2S', '3 ที่นั่ง': '3S', '1 ที่นั่ง': '1S', 'เดย์เบด': 'DB', 'L-shape': 'L',
  'Size S': 'S', 'Size M': 'M', 'Size L': 'L', 'Size XL': 'XL',
  '3 ฟุต': '3F', '3.5 ฟุต': '35F', '5 ฟุต': '5F', '6 ฟุต': '6F',
  '3.5 ฟุต (เฉพาะฐานเตียง)': '35F-BASE', '5 ฟุต (เฉพาะฐานเตียง)': '5F-BASE',
  '6 ฟุต (เฉพาะฐานเตียง)': '6F-BASE',
  'พนักสูง': 'HB', 'พนักเตี้ย': 'LB', 'ม้านั่ง': 'BN',
};

const mm = (v: number | null) => (v == null ? '' : String(Math.round(v * 10)));
const cmv = (v: number | null) => (v == null ? '' : String(Math.round(v)));

/**
 * รุ่นที่ data sheet โรงงานใส่ความกว้างเป็นเซนติเมตร
 * ฟีนิกซ์: PHX150-2AR คือตัวกว้าง 1500 มม. · ขุนทอง: KT1400 คือ 1400 มม.
 * ที่เหลือไม่มีไฟล์โรงงาน ใช้มิลลิเมตรตามที่เราตั้งเอง
 */
const CM_COLLECTIONS = new Set(['ฟีนิกซ์']);

/**
 * คำไทยที่ต้องเก็บไว้ในรหัส
 *
 * ★ เคยตัดอักษรไทยทิ้งหมดแล้วเอาแต่ตัวเลข ผลคือชุดโต๊ะอาหารนางนวล/กระสา
 *   "พร้อมชุดเก้าอี้กีวี่ 2 ตัว" กับ "พร้อมชุดเก้าอี้อีมู 2 ตัว" ได้รหัสเดียวกัน
 *   ทั้งที่เป็นคนละชุด ต่างกัน 2,400 บาท · ระบบเลยต้องไปต่อท้ายด้วยความสูง
 *   ซึ่งไม่ได้บอกอะไรกับคนอ่านเลย
 */
const WORD_TAG: [RegExp, string][] = [
  [/กีวี่/, 'KW'], [/อีมู/, 'EMU'], [/ขุนทอง/, 'KT'], [/นางนวล/, 'NN'], [/กระสา/, 'KS'],
  [/ม้านั่ง/, 'BN'], [/เดย์เบด|daybed/i, 'DB'], [/เอียง/, 'SLT'],
  [/พนักสูง|high\s*back/i, 'HB'], [/พนักเตี้ย|low\s*back/i, 'LB'],
  [/ฐานเตียง/, 'BASE'], [/ไม่มีแขน/, 'NA'], [/ที่นั่ง|seat/i, 'S'], [/ฟุต/, 'F'],
];

/**
 * ทำ sub ภาษาไทยให้เป็นรหัสที่อ่านออก · เก็บคำสำคัญ + ตัวเลขที่ยังไม่ได้บอกไปแล้ว
 *
 * ★ ตัดตัวเลขที่ซ้ำกับขนาดของโมดูลเองออก
 *   "DAYBED เอียง W213 x D135 xH85" เคยได้รหัส PHX2130-21313585DB
 *   ซึ่งพูดความกว้างซ้ำสองรอบแล้วยังอ่านไม่ออก · ตอนนี้ได้ PHX2130-DBSLT
 */
function tagOf(sub: string, w: number | null, d: number | null, h: number | null): string {
  const direct = SUB_TAG[sub.trim()];
  if (direct !== undefined) return direct;
  const ascii = sub.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const words: string[] = [];
  for (const [re, tag] of WORD_TAG) if (re.test(sub) && !words.includes(tag)) words.push(tag);
  const known = new Set([w, d, h].filter((v): v is number => v != null).map(String));
  const raw = sub.match(/\d+(\.\d+)?/g) ?? [];
  const nums = raw.filter((n) => !known.has(n));
  const out = [...nums, ...words].join('');
  if (out) return out.slice(0, 10);
  // ชื่อมีแต่ตัวเลขที่ซ้ำกับขนาดของโมดูลเอง เช่น "150 cm" ของโต๊ะกว้าง 150
  // ความกว้างอยู่ในรหัสอยู่แล้ว (KS1500) ไม่ต้องต่อท้ายให้ยาวขึ้นเปล่า ๆ
  if (raw.length && !words.length) return '';
  return ascii.slice(0, 10);
}

/**
 * รหัสฟีนิกซ์กับขุนทองลอกมาจาก data sheet โรงงานตรง ๆ
 *
 * ★ สองโรงงานใช้หน่วยคนละอย่าง · เทียบกับไฟล์ PDF แล้วเป็นแบบนี้จริง
 *     ฟีนิกซ์ใช้เซนติเมตร · PHX150-2AR คือตัวกว้าง 1500 มม.
 *     ขุนทองใช้มิลลิเมตร  · KT1400 คือตัวกว้าง 1400 มม.
 *   เคยเขียนให้ฟีนิกซ์เป็นมิลลิเมตรทั้งคู่ ได้ PHX2300-2AR ซึ่งโรงงานอ่านไม่ออก
 *
 * ★ ความกว้างของตระกูลที่มีโต๊ะ คือความกว้างรวม โต๊ะอยู่ในนั้นแล้ว
 *   เคยบวก 40 เพิ่มเพราะอ่านแบบในไฟล์โรงงานว่าโต๊ะต่อออกมาจากที่นั่ง
 *   ผลคือชุด "3RT (230) + เดย์เบด 125" ได้ 395 ซม. ทั้งที่ของจริง 355
 *   ใบราคาเองก็เขียน L-shape W355 · ยึดตามนั้น
 */
function codeFor(coll: string, prefix: string, cat: string, sub: string,
                 w: number | null, d: number | null, h: number | null): string {
  if (coll === 'ฟีนิกซ์') {
    let m = /^3S \((\d+)\)/.exec(sub);
    if (m) return `PHX${+m[1]}-2AR`;
    m = /^3RT \((\d+)\)/.exec(sub);
    if (m) return `PHX${+m[1]}RA-T`;
    m = /^(\d+) cm with Table/.exec(sub);
    if (m) return `PHX${+m[1]}RA-T`;
    m = /^DAYBED-R\/L \((\d+)\)/.exec(sub);
    if (m) return `PHX${+m[1]}R`;
    if (cat === 'โซฟา' && (sub === 'เดย์เบด' || sub === 'CL (125*166)') && w && d)
      return `PHX-CR${Math.round(w)}X${Math.round(d)}`;
    if (cat === 'สตูล') return 'PHX-STOOL-' + ((w ?? 0) > 110 ? 'M' : 'S');
    if (cat === 'ที่พักหัว') return 'PHX-HEADREST' + ((d ?? 99) < 20 ? '-2' : '');
    if (cat === 'หมอน' && w) return `PHX-CUSHION-${Math.round(w)}`;
  }
  if (coll === 'ขุนทอง') {
    if (cat === 'โซฟา' && (sub === '2 ที่นั่ง' || sub === '3 ที่นั่ง') && w) return `KT${Math.round(w) * 10}`;
    if (cat === 'โซฟา' && sub === 'เดย์เบด' && w && d) return `KTC${Math.round(w)}X${Math.round(d)}`;
    if (cat === 'สตูล') return 'KT-STOOL';
  }
  const num = CM_COLLECTIONS.has(coll) ? cmv(w) : mm(w);
  let code = prefix + num + (CAT_SUFFIX[cat] ?? '-' + cat.slice(0, 2));
  const tag = tagOf(sub, w, d, h);
  if (tag) code += '-' + tag;
  return code;
}

/**
 * ชนกันเมื่อไหร่ ต่อท้ายด้วยความสูง เพราะที่ชนจริง ๆ ส่วนใหญ่คือรุ่นหัวเตียงสูง/เตี้ย
 * คืน hit มาด้วย เพราะ "ชนกัน" คือสัญญาณว่าใบราคามีสองแถวที่แยกกันไม่ออก
 */
function uniq(code: string, used: Set<string>, h: number | null): { code: string; hit: boolean } {
  if (!used.has(code)) { used.add(code); return { code, hit: false }; }
  if (h != null && !used.has(`${code}-H${Math.round(h)}`)) {
    const c = `${code}-H${Math.round(h)}`; used.add(c); return { code: c, hit: true };
  }
  let i = 2;
  while (used.has(`${code}-${i}`)) i++;
  used.add(`${code}-${i}`);
  return { code: `${code}-${i}`, hit: true };
}

/* ------------------------------------------------------------------ ชื่ออังกฤษ */

/** คำขึ้นต้นที่ชื่อสินค้าทุกชิ้นในรุ่นใช้ร่วมกัน · 'Nang Aaen Bed' + 'Nang Aaen Armchair' -> 'Nang Aaen' */
export function commonEnName(names: string[]): string {
  const parts = names.map((n) => n.replace(/[()]/g, '').trim()).filter(Boolean).map((n) => n.split(/\s+/));
  if (!parts.length) return '';
  if (parts.length === 1) return parts[0].join(' ');
  const out: string[] = [];
  const len = Math.min(...parts.map((p) => p.length));
  for (let i = 0; i < len; i++) {
    const w = parts[0][i];
    if (parts.every((p) => p[i].toLowerCase() === w.toLowerCase())) out.push(w);
    else break;
  }
  if (out.length) return out.join(' ');
  const first = parts.map((p) => p[0]);
  const count = new Map<string, number>();
  first.forEach((f) => count.set(f, (count.get(f) ?? 0) + 1));
  return [...count.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

/* ------------------------------------------------------------------- ตัวประกอบ */

const GRADE_ORDER = ['ผ้า A', 'ผ้า B', 'ผ้า C', 'หนังแท้', 'หนังแท้ (ออย)'];
const gradeRank = (g: string) => {
  const i = GRADE_ORDER.indexOf(g);
  return i === -1 ? GRADE_ORDER.length : i;
};

const push = (arr: string[], v: string | null) => {
  const s = (v ?? '').trim();
  if (s && !arr.includes(s)) arr.push(s);
};

/** ใบราคาเรียกชุดตัว L ว่า L-shape · สวอนเขียนยาวกว่านั้น แต่ขึ้นต้นเหมือนกัน */
const isLShape = (sub: string) => /l-?shape/i.test(sub);

/**
 * รายการแถวที่ตั้งชื่อแยกไม่ออก
 *
 * ★ ทำไมไม่ใช้ "ขนาดเท่ากัน" เป็นสัญญาณ
 *   ลองแล้วได้ false positive เพียบ · ฟีนิกซ์ W230 มีทั้งแบบมีโต๊ะ ไม่มีโต๊ะ และเปิดแขน
 *   ขนาดนอกเท่ากันหมดแต่เป็นคนละสินค้าจริง ๆ ไม่ควรเตือน
 *   ที่ควรเตือนคือแถวที่ "รุ่น + ความกว้าง + หมวด + รูปแบบ" เหมือนกันจนระบบ
 *   ต้องต่อท้ายรหัสให้ต่าง เช่น 3RT (170) กับ 170 cm with Table ซึ่งเป็นตัวเดียวกัน
 */
function findAmbiguous(groups: Group[]): Ambiguous[] {
  const out: Ambiguous[] = [];
  for (const g of groups) {
    const by = new Map<string, Module[]>();
    for (const m of g.mods) {
      const base = m.code.replace(/-(H\d+|\d+)$/, '');
      if (!by.has(base)) by.set(base, []);
      by.get(base)!.push(m);
    }
    for (const [, ms] of by) {
      if (ms.length < 2 || !ms.some((m) => m.ambiguous)) continue;
      out.push({ cat: g.cat, codes: ms.map((m) => m.code), subs: ms.map((m) => m.sub || '—') });
    }
  }
  return out;
}

/**
 * เติมความลึกช่วงหลังให้ชุดตัว L
 *
 * ★ เติมเฉพาะแถวที่ใบราคาบอกเองว่าเป็น L-shape เท่านั้น
 *   เคยเขียนเป็น "ลึกกว่าตัวที่ตื้นที่สุด" แล้วพัง: ทากะมีโซฟาตรงลึก 92
 *   กับอีกตัวลึก 90 ตัว 92 เลยโดนวาดเป็นตัว L ทั้งที่เป็นโซฟาตรงธรรมดา
 *   เดย์เบดของฟีนิกซ์ก็ลึก 166 แต่เป็นชิ้นสี่เหลี่ยมเดี่ยว ไม่ใช่ตัว L
 */
function fillBackDepth(groups: Group[]) {
  const sofa = groups.find((g) => g.cat === 'โซฟา');
  if (!sofa) return;
  const ls = sofa.mods.filter((m) => isLShape(m.sub));
  if (!ls.length) return;
  const shallowest = Math.min(
    ...sofa.mods.filter((m) => !isLShape(m.sub) && m.d != null).map((m) => m.d as number),
    Infinity,
  );
  if (!Number.isFinite(shallowest)) return;
  for (const m of ls) if (m.d != null && m.d > shallowest) m.backD = shallowest;
}

export function buildSheets(rows: PriceRow[]): Sheet[] {
  const byColl = new Map<string, PriceRow[]>();
  for (const r of rows) {
    const k = (r.รุ่น ?? '').trim();
    if (!byColl.has(k)) byColl.set(k, []);
    byColl.get(k)!.push(r);
  }

  const sheets: Sheet[] = [];
  for (const [coll, crs] of byColl) {
    const prefix = REAL_PREFIX[coll] ?? PREFIX[coll] ?? 'XX';
    const used = new Set<string>();

    const byCat = new Map<string, PriceRow[]>();
    for (const r of crs) {
      const k = (r.หมวด ?? '').trim();
      if (!byCat.has(k)) byCat.set(k, []);
      byCat.get(k)!.push(r);
    }

    const groups: Group[] = [];
    for (const [cat, catRows] of byCat) {
      const byMod = new Map<string, Module>();
      let image: string | null = null;
      for (const r of catRows) {
        if (!image && r.รูป) image = r.รูป;
        const sub = (r.รูปทรง ?? '').trim();
        const key = [sub, r.กว้าง, r.ลึก, r.สูง].join('|');
        let m = byMod.get(key);
        if (!m) {
          m = { code: '', sub, w: r.กว้าง, d: r.ลึก, h: r.สูง,
                seatH: r.สูงที่นั่ง, backD: null, ambiguous: false,
                mats: [], woods: [], colours: [], variants: 0 };
          byMod.set(key, m);
        }
        m.variants++;
        if (m.seatH == null) m.seatH = r.สูงที่นั่ง;
        push(m.mats, r.เกรดวัสดุ);
        push(m.woods, r.ไม้);
        push(m.colours, r.สีไม้);
      }
      const mods = [...byMod.values()];
      for (const m of mods) {
        m.mats.sort((a, b) => gradeRank(a) - gradeRank(b) || a.localeCompare(b, 'th'));
        const u = uniq(codeFor(coll, prefix, cat, m.sub, m.w, m.d, m.h), used, m.h);
        m.code = u.code;
        m.ambiguous = u.hit;
      }
      groups.push({ cat, mods, image });
    }

    fillBackDepth(groups);
    groups.sort((a, b) => a.cat.localeCompare(b.cat, 'th'));
    sheets.push({
      ambiguous: findAmbiguous(groups),
      th: coll,
      en: commonEnName(crs.map((r) => r.ชื่ออังกฤษ ?? '')),
      prefix,
      codeReal: coll in REAL_PREFIX,
      groups,
      variants: crs.length,
      modules: groups.reduce((n, g) => n + g.mods.length, 0),
    });
  }

  sheets.sort((a, b) => b.variants - a.variants || a.th.localeCompare(b.th, 'th'));
  return sheets;
}
