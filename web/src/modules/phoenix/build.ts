import type { PriceRow } from '@/modules/pricing/queries';

/**
 * ขนาดจริงของแบบเทคนิคแต่ละรหัส หน่วยมิลลิเมตร [กว้าง, ลึก]
 *
 * ดึงออกมาจาก Phoenix data sheet ของโรงงาน · รูปอยู่ที่ /plans/phoenix/{รหัส}.png
 * ★ ส่วนนี้สร้างด้วย docs/tools/extract-phoenix-plans.py อย่าแก้ด้วยมือ
 *   ต้นฉบับอยู่ที่ docs/source/phoenix-plans.json
 *
 * ความกว้างในไฟล์นี้คือความกว้างรวม · ตระกูลที่มีโต๊ะข้าง โต๊ะอยู่ในตัวเลขแล้ว
 */
export const PLAN_MM: Record<string, [number, number]> = {
  'PHX-CL100X166': [1000, 1660],
  'PHX-CL100X180': [1000, 1800],
  'PHX-CL125X166': [1250, 1660],
  'PHX-CR100X166': [1000, 1660],
  'PHX-CR100X180': [1000, 1800],
  'PHX-CR125X166': [1250, 1660],
  'PHX-HEADREST': [620, 210],
  'PHX-STOOL': [1250, 910],
  'PHX150-2AR': [1500, 960],
  'PHX150L': [1500, 960],
  'PHX150NA': [1500, 960],
  'PHX150R': [1500, 960],
  'PHX170-2AR': [1700, 960],
  'PHX170L': [1700, 960],
  'PHX170NA': [1700, 960],
  'PHX170R': [1700, 960],
  'PHX190-2AR': [1900, 960],
  'PHX190L': [1900, 960],
  'PHX190LA-T': [1900, 960],
  'PHX190LT': [1900, 960],
  'PHX190NA': [1900, 960],
  'PHX190R': [1900, 960],
  'PHX190RA-T': [1900, 960],
  'PHX190RT': [1900, 960],
  'PHX210-2AR': [2100, 960],
  'PHX210CNC-L': [2100, 960],
  'PHX210CNC-R': [2100, 960],
  'PHX210L': [2100, 960],
  'PHX210LA-T': [2100, 960],
  'PHX210LT': [2100, 960],
  'PHX210NA': [2100, 960],
  'PHX210R': [2100, 960],
  'PHX210RA-T': [2100, 960],
  'PHX210RT': [2100, 960],
  'PHX230-2AR': [2300, 960],
  'PHX230CNC-L': [2300, 960],
  'PHX230CNC-R': [2300, 960],
  'PHX230L': [2300, 960],
  'PHX230LA-T': [2300, 960],
  'PHX230LT': [2300, 960],
  'PHX230NA': [2300, 960],
  'PHX230R': [2300, 960],
  'PHX230RA-T': [2300, 960],
  'PHX230RT': [2300, 960],
  'PHX250-2AR': [2500, 960],
  'PHX250CNC-L': [2500, 960],
  'PHX250CNC-R': [2500, 960],
  'PHX250L': [2500, 960],
  'PHX250LA-T': [2500, 960],
  'PHX250LT': [2500, 960],
  'PHX250NA': [2500, 960],
  'PHX250R': [2500, 960],
  'PHX250RA-T': [2500, 960],
  'PHX250RT': [2500, 960],
  'PHX270LA-T': [2700, 960],
  'PHX270LT': [2700, 960],
  'PHX270RA-T': [2700, 960],
  'PHX270RT': [2700, 960],
  'PHX290LA-T': [2900, 960],
  'PHX290LT': [2900, 960],
  'PHX290RA-T': [2900, 960],
  'PHX290RT': [2900, 960],
};

export const planSrc = (code: string) => `/plans/phoenix/${code}.png`;
export const hasPlan = (code: string) => code in PLAN_MM;

/**
 * แปลงแถวใบราคาของฟีนิกซ์ ให้เป็นรายการสำหรับหน้าจัดชุด
 *
 * ★ ใช้ข้อมูลชุดเดียวกับใบราคาและ data sheet
 *   ไม่มีตารางใหม่ ไม่มีวิวใหม่ · อ่านจาก pricing.v_price_list ที่มี RLS คุมอยู่แล้ว
 *
 * ★ รวม "ตัวโซฟา 230" กับ "ตัวโซฟา 230 + โต๊ะข้าง" เป็นแถวเดียว
 *   ใบราคาแยกสองแถวเพราะราคาต่างกัน แต่คนเลือกคิดเป็นตัวเดียวแล้วค่อยบอกว่าจะเอาโต๊ะไหม
 *   ราคาผูกกับ "มีโต๊ะ / ไม่มีโต๊ะ" อย่างเดียว · เลือกแขนแบบไหนราคาเท่ากันหมด
 */

export type Cell = { full: number | null; sale: number | null; disc: number };
export type Extra = Cell & { label: string };
/** แบบเทคนิคหนึ่งรหัส · w, d หน่วยมิลลิเมตร ตามที่วัดจากไฟล์โรงงาน */
export type Variant = { code: string; w: number; d: number; name: string };

export type Item = {
  cat: string;
  label: string;
  code: string;
  w: number | null;
  d: number | null;
  h: number | null;
  /** ราคาแบบไม่มีโต๊ะ เรียงตามเกรด */
  cells: (Cell | null)[];
  /** ราคาแบบมีโต๊ะ · null = รุ่นนี้ไม่มีแบบมีโต๊ะในใบราคา */
  cellsT: (Cell | null)[] | null;
  /** ตัวเลือกที่ไม่ใช่เกรดผ้า เช่น ท็อปหิน / ท็อปไม้ */
  extra: Extra[];
  /** แบบของตัวโซฟาที่ไม่มีโต๊ะ */
  arm: Partial<Record<'both' | 'R' | 'L' | 'none', Variant>>;
  /** แบบของตัวโซฟาที่มีโต๊ะ */
  tbl: Partial<Record<'R' | 'L' | 'noneR' | 'noneL', Variant>>;
  /** แบบของของที่ไม่ใช่ตัวโซฟา เช่น เดย์เบดซ้าย/ขวา */
  draw: Variant[];
};

export const GRADES = ['ผ้า A', 'ผ้า B', 'ผ้า C', 'หนังแท้', 'หนังแท้ (ออย)'];
export const COLLECTION = 'ฟีนิกซ์';

const num = (v: number | null | undefined) => (v == null ? null : Math.round(v));
const g = (v: number | null) => (v == null ? 'ไม่ระบุ' : String(v));

type Raw = {
  cat: string; subs: string[];
  w: number | null; d: number | null; h: number | null;
  cells: (Cell | null)[]; extra: Extra[];
};

/** ราคาที่มีอยู่ของสองแถว ไม่ขัดกัน = เป็นสินค้าตัวเดียวกันที่ลงไว้ซ้ำ */
function compatible(a: Raw, b: Raw) {
  for (let i = 0; i < GRADES.length; i++) {
    const x = a.cells[i], y = b.cells[i];
    if (x && y && (x.full !== y.full || x.sale !== y.sale)) return false;
  }
  return true;
}

function labelOf(r: Raw): string {
  const { cat, w, d } = r;
  if (cat === 'โซฟา') {
    for (const s of r.subs) {
      const m = /^3RT \((\d+)\)/.exec(s) || /^(\d+) cm with Table/.exec(s);
      if (m) return `ตัวโซฟา ${m[1]} + โต๊ะข้าง`;
    }
    for (const s of r.subs) {
      const m = /^3S \((\d+)\)/.exec(s);
      if (m) return `ตัวโซฟา ${m[1]} ซม.`;
    }
    for (const s of r.subs) {
      const m = /^DAYBED-R\/L \((\d+)\)/.exec(s);
      if (m) return `ตัวโซฟา ${m[1]} เปิดแขนข้างเดียว`;
    }
    if (r.subs.some((s) => s === 'เดย์เบด' || s === 'CL (125*166)')) return `เดย์เบด ${g(w)}×${g(d)}`;
    if (r.subs.some((s) => s.startsWith('DAYBED เอียง'))) return `เดย์เบดเอียง ${g(w)}×${g(d)}`;
    if (r.subs.includes('L-shape')) return `ชุดตัวแอล ${g(w)} ซม.`;
    return `ตัวโซฟา ${g(w)} ซม.`;
  }
  const by: Record<string, string> = {
    'สตูล': `สตูล ${g(w)}×${g(d)}`,
    'ที่พักหัว': `ที่พักหัว ${g(w)}×${g(d)}`,
    'หมอน': `หมอน ${g(w)}×${g(w)}`,
    'โต๊ะกลาง': `โต๊ะกลาง ${g(w)}×${g(d)}`,
    'ตู้เก็บของ': `ตู้เก็บของ ${g(w)} ซม.`,
  };
  return by[cat] ?? `${cat} ${g(w)}`;
}

const V = (code: string, name: string): Variant | undefined =>
  hasPlan(code) ? { code, name, w: PLAN_MM[code][0], d: PLAN_MM[code][1] } : undefined;

const CAT_ORDER: Record<string, number> = {
  'โซฟา': 0, 'สตูล': 1, 'ที่พักหัว': 2, 'หมอน': 3, 'โต๊ะกลาง': 4, 'ตู้เก็บของ': 5,
};

export function buildPhoenix(rows: PriceRow[]): Item[] {
  /* ---- 1 · จับกลุ่มตาม หมวด + รูปทรง + ขนาด ---- */
  const byKey = new Map<string, Raw>();
  for (const r of rows) {
    if ((r.รุ่น ?? '').trim() !== COLLECTION) continue;
    const cat = (r.หมวด ?? '').trim();
    const sub = (r.รูปทรง ?? '').trim();
    const w = num(r.กว้าง), d = num(r.ลึก), h = num(r.สูง);
    const key = [cat, sub, w, d, h].join('|');
    let e = byKey.get(key);
    if (!e) { e = { cat, subs: [sub], w, d, h, cells: Array(GRADES.length).fill(null), extra: [] };
              byKey.set(key, e); }
    const cell: Cell = {
      full: num(r.ราคาเต็มรวม_vat),
      sale: num(r.ราคาขายรวม_vat),
      disc: Math.round(r.ส่วนลดปกติ_pct ?? 0),
    };
    const mat = (r.เกรดวัสดุ ?? '').trim();
    const gi = GRADES.indexOf(mat);
    if (gi >= 0) e.cells[gi] = cell;
    else e.extra.push({ ...cell, label: mat || (r.ไม้ ?? '').trim() || 'แบบเดียว' });
  }

  /* ---- 2 · รวมแถวที่เป็นสินค้าตัวเดียวกัน ----
     ใบราคาลงของตัวเดียวกันซ้ำจริง เช่น "3RT (170)" กับ "170 cm with Table"
     แถวหนึ่งมีผ้า A อีกแถวมีอีกสี่เกรด · ถ้าไม่รวมจะเห็นช่องว่างเต็มไปหมด */
  const bySig = new Map<string, Raw[]>();
  for (const e of byKey.values()) {
    const sig = [e.cat, e.w, e.d, e.h].join('|');
    const list = bySig.get(sig) ?? [];
    const hit = list.find((x) => compatible(x, e));
    if (hit) {
      e.cells.forEach((c, i) => { if (c && !hit.cells[i]) hit.cells[i] = c; });
      hit.extra.push(...e.extra);
      hit.subs.push(...e.subs);
    } else { list.push(e); bySig.set(sig, list); }
  }
  const raws = [...bySig.values()].flat();

  /* ---- 3 · รวมความกว้างเดียวกันของตัวโซฟา ให้เหลือแถวเดียว ---- */
  const widthOf = (lab: string) => {
    const m = /^ตัวโซฟา (\d+)(?: ซม\.| \+ โต๊ะข้าง)$/.exec(lab);
    return m ? +m[1] : null;
  };
  const items: Item[] = [];
  const done = new Set<number>();
  const labelled = raws.map((r) => ({ r, lab: labelOf(r) }));

  for (const { r, lab } of labelled) {
    const w = r.cat === 'โซฟา' ? widthOf(lab) : null;
    if (w == null) {
      items.push({
        cat: r.cat, label: lab, code: '', w: r.w, d: r.d, h: r.h,
        cells: r.cells, cellsT: null, extra: r.extra,
        arm: {}, tbl: {},
        draw: drawsFor(lab),
      });
      continue;
    }
    if (done.has(w)) continue;
    done.add(w);
    const group = labelled.filter((x) => x.r.cat === 'โซฟา' && widthOf(x.lab) === w);
    const base = group.find((x) => x.lab.endsWith('ซม.'))?.r;
    const tbl = group.find((x) => x.lab.includes('โต๊ะข้าง'))?.r;
    const src = base ?? tbl!;
    const arm = {
      both: V(`PHX${w}-2AR`, 'แขนสองข้าง'),
      R: V(`PHX${w}R`, 'แขนขวา'),
      L: V(`PHX${w}L`, 'แขนซ้าย'),
      none: V(`PHX${w}NA`, 'ไม่มีแขน'),
    };
    const tv = {
      R: V(`PHX${w}RA-T`, 'แขนขวา + โต๊ะข้าง'),
      L: V(`PHX${w}LA-T`, 'แขนซ้าย + โต๊ะข้าง'),
      noneR: V(`PHX${w}RT`, 'ไม่มีแขน + โต๊ะข้างขวา'),
      noneL: V(`PHX${w}LT`, 'ไม่มีแขน + โต๊ะข้างซ้าย'),
    };
    items.push({
      cat: 'โซฟา', label: `ตัวโซฟา ${w} ซม.`,
      code: arm.both?.code ?? tv.R?.code ?? `PHX${w}`,
      w: src.w, d: src.d, h: src.h,
      cells: (base ?? tbl!).cells,
      cellsT: tbl ? tbl.cells : null,
      extra: [], arm, tbl: tv, draw: [],
    });
  }

  items.sort((a, b) => {
    const ca = CAT_ORDER[a.cat] ?? 9, cb = CAT_ORDER[b.cat] ?? 9;
    if (ca !== cb) return ca - cb;
    const ga = a.label.startsWith('ตัวโซฟา') ? 0 : a.label.startsWith('เดย์เบด') ? 1 : 2;
    const gb = b.label.startsWith('ตัวโซฟา') ? 0 : b.label.startsWith('เดย์เบด') ? 1 : 2;
    if (ga !== gb) return ga - gb;
    if ((b.w ?? 0) !== (a.w ?? 0)) return (b.w ?? 0) - (a.w ?? 0);
    return a.label.localeCompare(b.label, 'th');
  });
  return items;
}

/** แบบของของที่ไม่ใช่ตัวโซฟา · เดย์เบดมีซ้าย/ขวา ที่เหลือมีแบบเดียว */
function drawsFor(label: string): Variant[] {
  const m = /^เดย์เบด (\d+)×(\d+)$/.exec(label);
  if (m) {
    return [
      V(`PHX-CR${m[1]}X${m[2]}`, 'เดย์เบดด้านขวา'),
      V(`PHX-CL${m[1]}X${m[2]}`, 'เดย์เบดด้านซ้าย'),
    ].filter(Boolean) as Variant[];
  }
  if (label === 'สตูล 125×91') return [V('PHX-STOOL', 'สตูล')].filter(Boolean) as Variant[];
  if (label === 'ที่พักหัว 62×21') return [V('PHX-HEADREST', 'ที่พักหัว')].filter(Boolean) as Variant[];
  return [];
}

/* ---------- ตัวช่วยที่หน้าจอกับชุดทดสอบใช้ร่วมกัน ---------- */

export type Pick = {
  arm: 'both' | 'one' | 'none';
  side: 'R' | 'L';
  tbl: boolean;
  v: number;
};

export const isSofa = (it: Item) =>
  Object.keys(it.arm).length > 0 || Object.keys(it.tbl).length > 0;

/**
 * แบบที่เลือกอยู่ · คืน undefined ถ้าไฟล์โรงงานไม่มีรหัสนั้น
 * ไม่มีแบบ "แขนสองข้าง + โต๊ะ" ในไฟล์โรงงาน
 */
export function variantOf(it: Item, p: Pick): Variant | undefined {
  if (!isSofa(it)) return it.draw.length ? it.draw[Math.min(p.v, it.draw.length - 1)] : undefined;
  if (p.tbl && p.arm === 'both') return undefined;
  if (p.tbl) return it.tbl[p.arm === 'none' ? (`none${p.side}` as const) : p.side];
  return it.arm[p.arm === 'one' ? p.side : p.arm];
}

export const canPick = (it: Item, arm: Pick['arm'], tbl: boolean, side: Pick['side']) =>
  !!variantOf(it, { arm, tbl, side, v: 0 });

/** ราคาของบรรทัดนั้น · มีโต๊ะใช้ชุดราคาที่มีโต๊ะ · แขนไม่มีผลกับราคา */
export function cellOf(it: Item, p: Pick, kind: 'g' | 'e', ci: number): Cell | null {
  if (kind === 'e') return it.extra[ci] ?? null;
  const arr = p.tbl && it.cellsT ? it.cellsT : it.cells;
  return arr?.[ci] ?? null;
}

export function variantName(it: Item, p: Pick): string {
  if (!isSofa(it)) return variantOf(it, p)?.name ?? '';
  const side = p.side === 'R' ? 'ขวา' : 'ซ้าย';
  if (p.arm === 'both') return 'แขนสองข้าง';
  if (p.arm === 'none') return p.tbl ? `ไม่มีแขน + โต๊ะข้าง${side}` : 'ไม่มีแขน';
  return p.tbl ? `แขน${side} + โต๊ะข้าง` : `แขน${side}`;
}
