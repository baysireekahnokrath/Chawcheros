/**
 * ทดสอบตัวคิดราคาแนะนำของขนาดใหม่
 *   cd web && node --experimental-strip-types scripts/suggest-price.test.mts
 *
 * เคสตั้งต้นคือของจริงที่ Bay ถามมา 2026-11-16
 *   โต๊ะกลางฟีนิกซ์ W120 D90 = 45,000 (ไม้โอ๊ค) / 49,000 (หินสังเคราะห์)
 *   ลูกค้าขอ 60*120 กับ 60*100 — ควรขายเท่าไหร่
 */
// @ts-expect-error -- node --experimental-strip-types ต้องการนามสกุล .ts
import { DEFAULT_FIXED, basisFor, dimText, parseSize, proportional, roundPrice, sizeValue, suggestPrice } from '../src/modules/catalog/suggest-price.ts';
import type { Dim, Point } from '../src/modules/catalog/suggest-price.ts';

let pass = 0, fail = 0;
const ok = (name: string, got: unknown, want: unknown) => {
  const good = JSON.stringify(got) === JSON.stringify(want);
  if (good) pass++; else fail++;
  console.log(`${good ? 'ok  ' : 'FAIL'}  ${name}${good ? '' : `  got=${JSON.stringify(got)} want=${JSON.stringify(want)}`}`);
};

/* ── 1 · แกะขนาดจากข้อความที่คนพิมพ์จริง ───────────────────────────── */
ok('60*120 cm → ตัวใหญ่เป็นกว้าง', parseSize('Phoenix Coffee table 60*120 cm'),
   { w: 120, d: 60, h: null });
ok('60*100 cm', parseSize('Phoenix Coffee table 60*100 cm หินสีขาวจุด'),
   { w: 100, d: 60, h: null });
ok('W120 D90 H40 แบบมีป้ายกำกับ', parseSize('ขนาด W120 D90 H40 cm'),
   { w: 120, d: 90, h: 40 });
ok('กว้าง ลึก สูง ภาษาไทย', parseSize('กว้าง 200 ลึก 45 สูง 50'),
   { w: 200, d: 45, h: 50 });
ok('120x90x40 สามตัวเรียง', parseSize('120x90x40'), { w: 120, d: 90, h: 40 });
ok('เลขเดียว = ความกว้าง', parseSize('Krasa Tv Cabinet 200 cm walnut'),
   { w: 200, d: null, h: null });
ok('1.00m. แปลงเป็นเซนติเมตร', parseSize('Emu Bench 1.00m.'), { w: 100, d: null, h: null });
ok('ไม่มีเลข', parseSize('Taka Sofa walnut color'), { w: null, d: null, h: null });
ok('เลขที่ไม่ใช่ขนาด (ราคา) ไม่ถูกหยิบ', parseSize('HOF Sideboard 16000 บาท').w, null);
ok('dimText', dimText({ w: 120, d: 60, h: 40 }), 'W120 D60 H40');

/* ── 2 · หมวดไหนคิดด้วยอะไร ───────────────────────────────────────── */
ok('โต๊ะกลาง → พื้นที่', basisFor('โต๊ะกลาง'), 'พื้นที่');
ok('ตู้เก็บของ → พื้นที่', basisFor('ตู้เก็บของ'), 'พื้นที่');
ok('ชั้นวางทีวี → พื้นที่', basisFor('ชั้นวางทีวี'), 'พื้นที่');
ok('โซฟา → ความกว้าง', basisFor('โซฟา 3 ที่นั่ง'), 'ความกว้าง');
ok('ม้านั่ง → ความกว้าง', basisFor('ม้านั่ง'), 'ความกว้าง');
ok('เดย์เบด → ความกว้าง', basisFor('เดย์เบด'), 'ความกว้าง');
ok('สตูล → ความกว้าง', basisFor('สตูล'), 'ความกว้าง');
ok('พื้นที่ = กว้าง × ลึก', sizeValue({ w: 120, d: 90, h: 40 }, 'พื้นที่'), 10800);
ok('ไม่มีความลึก คิดพื้นที่ไม่ได้', sizeValue({ w: 120, d: null, h: null }, 'พื้นที่'), null);

/* ── 3 · โต๊ะกลางฟีนิกซ์ · มีขนาดเดียวในใบราคา ──────────────────────── */
const PHOENIX_OAK: Point[] = [{ w: 120, d: 90, h: 40, retail: 45000, label: 'ท็อปไม้โอ๊ค' }];

const p120x60 = suggestPrice(PHOENIX_OAK, { w: 120, d: 60, h: 40 }, 'พื้นที่')!;
const p100x60 = suggestPrice(PHOENIX_OAK, { w: 100, d: 60, h: 40 }, 'พื้นที่')!;

ok('120×60 ใช้วิธีสมมติ เพราะมีขนาดเดียว', p120x60.method, 'สมมติส่วนคงที่');
ok('120×60 ราคาแนะนำ', p120x60.price, 39000);
ok('100×60 ราคาแนะนำ', p100x60.price, 37000);
ok('เล็กลงต้องถูกลง', p100x60.price < p120x60.price, true);
ok('ส่วนคงที่ที่ใช้', p120x60.fixedPct, 60);

/* บัญญัติไตรยางศ์เปล่า ๆ ให้ตัวเลขต่ำกว่าเสมอ — นี่คือเหตุผลที่ไม่ใช้มันเดี่ยว ๆ */
ok('ไตรยางศ์พื้นที่ 120×60', Math.round(proportional(PHOENIX_OAK, { w: 120, d: 60, h: null }, 'พื้นที่')!), 30000);
ok('ไตรยางศ์พื้นที่ 100×60', Math.round(proportional(PHOENIX_OAK, { w: 100, d: 60, h: null }, 'พื้นที่')!), 25000);
ok('ไตรยางศ์ต่ำกว่าราคาแนะนำเสมอ', proportional(PHOENIX_OAK, { w: 120, d: 60, h: null }, 'พื้นที่')! < p120x60.price, true);

/* หินสังเคราะห์แพงกว่า 4,000 ที่ขนาดมาตรฐาน · ขนาดใหม่ต้องยังแพงกว่าไม้ */
const PHOENIX_STONE: Point[] = [{ w: 120, d: 90, h: 40, retail: 49000, label: 'ท็อปหินสังเคราะห์' }];
const s120x60 = suggestPrice(PHOENIX_STONE, { w: 120, d: 60, h: 40 }, 'พื้นที่')!;
const s100x60 = suggestPrice(PHOENIX_STONE, { w: 100, d: 60, h: 40 }, 'พื้นที่')!;
ok('หิน 120×60', s120x60.price, 42000);
ok('หิน 100×60', s100x60.price, 40000);
ok('หินยังแพงกว่าไม้ทุกขนาด', s120x60.price > p120x60.price && s100x60.price > p100x60.price, true);

/* ── 4 · รุ่นที่มีหลายขนาด ต้องถอดจากของจริง ไม่ใช่สมมติ ──────────── */
/* ตัวอย่างสมมติที่เส้นตรงลงตัว: ราคา = 10,000 + 100 × กว้าง */
const MULTI: Point[] = [
  { w: 180, d: 90, h: 80, retail: 28000 },
  { w: 200, d: 90, h: 80, retail: 30000 },
  { w: 220, d: 90, h: 80, retail: 32000 },
];
const m210 = suggestPrice(MULTI, { w: 210, d: 90, h: 80 }, 'ความกว้าง')!;
ok('มี 3 ขนาด → ถอดจากราคาจริง', m210.method, 'ถอดจากราคาจริง');
ok('แทรกกลางได้ตรงเส้น', m210.price, 31000);
ok('ส่วนคงที่ที่ถอดได้', m210.fixedPct, 31);
ok('ใช้ครบทุกจุด', m210.used.length, 3);
ok('ไม่เตือนเมื่ออยู่ในช่วง', m210.warn, '');

const m260 = suggestPrice(MULTI, { w: 300, d: 90, h: 80 }, 'ความกว้าง')!;
ok('นอกช่วงต้องเตือน', m260.warn.length > 0, true);

/* ขนาดซ้ำกันหลายเกรด ต้องยุบเป็นจุดเดียว ไม่ถ่วงน้ำหนักเกิน */
const DUP: Point[] = [
  { w: 180, d: 90, h: 80, retail: 28000 },
  { w: 180, d: 90, h: 80, retail: 30000 },
  { w: 220, d: 90, h: 80, retail: 34000 },
];
const d200 = suggestPrice(DUP, { w: 200, d: 90, h: 80 }, 'ความกว้าง')!;
ok('ขนาดซ้ำยุบเหลือ 2 จุด', d200.used.length, 2);
ok('ใช้ค่าเฉลี่ยของขนาดที่ซ้ำ', d200.used[0].retail, 29000);

/* ข้อมูลเพี้ยน (ใหญ่ขึ้นแต่ถูกลง) ต้องไม่เชื่อ ต้องถอยไปใช้ค่าสมมติ */
const BAD: Point[] = [
  { w: 180, d: 90, h: 80, retail: 40000 },
  { w: 220, d: 90, h: 80, retail: 30000 },
];
const bad = suggestPrice(BAD, { w: 200, d: 90, h: 80 }, 'ความกว้าง')!;
ok('ราคาสวนทางขนาด → ไม่ใช้เส้นตรง', bad.method, 'สมมติส่วนคงที่');

/* ── 5 · ขอบที่ต้องไม่พัง ─────────────────────────────────────────── */
ok('ไม่มีขนาดเป้าหมาย → ไม่เดา', suggestPrice(PHOENIX_OAK, { w: null, d: null, h: null }, 'พื้นที่'), null);
ok('ไม่มีจุดอ้างอิง → ไม่เดา', suggestPrice([], { w: 120, d: 60, h: 40 }, 'พื้นที่'), null);
ok('จุดที่ไม่มีราคา ไม่ถูกนับ',
   suggestPrice([{ w: 120, d: 90, h: 40, retail: 0 }], { w: 120, d: 60, h: 40 }, 'พื้นที่'), null);
ok('ขนาดเท่าเดิม ได้ราคาเดิม',
   suggestPrice(PHOENIX_OAK, { w: 120, d: 90, h: 40 }, 'พื้นที่')!.price, 45000);
ok('ปัดหลักพันเมื่อเกินหมื่น', roundPrice(38_600), 39_000);
ok('ปัดหลักร้อยเมื่อไม่ถึงหมื่น', roundPrice(8_640), 8_600);
ok('ค่าตั้งต้นส่วนคงที่', DEFAULT_FIXED, 0.6);

/* ปรับส่วนคงที่แล้วตัวเลขต้องขยับตามทิศที่ควรเป็น */
const f40 = suggestPrice(PHOENIX_OAK, { w: 120, d: 60, h: 40 }, 'พื้นที่', 0.4)!;
const f80 = suggestPrice(PHOENIX_OAK, { w: 120, d: 60, h: 40 }, 'พื้นที่', 0.8)!;
ok('คงที่น้อยลง ราคาต่ำลง', f40.price < p120x60.price, true);
ok('คงที่มากขึ้น ราคาสูงขึ้น', f80.price > p120x60.price, true);
ok('คงที่ 100% = ราคาเท่าเดิม',
   suggestPrice(PHOENIX_OAK, { w: 100, d: 60, h: 40 }, 'พื้นที่', 1)!.price, 45000);

/* ── 6 · ห้ามมีต้นทุนหลุดเข้ามาในตรรกะนี้เลย ───────────────────────── */
const all: Dim[] = [{ w: 1, d: 1, h: 1 }];
ok('ไม่มีคำว่าต้นทุน/กำไรในผลลัพธ์',
   /ต้นทุน|cost|margin|กำไร/i.test(JSON.stringify({ p120x60, m210, all })), false);

console.log(`\nผ่าน ${pass} · ไม่ผ่าน ${fail}`);
process.exit(fail ? 1 : 0);
