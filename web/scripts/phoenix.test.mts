/**
 * ทดสอบตรรกะหน้าจัดชุดฟีนิกซ์ · ใช้ใบราคาจริงเป็นข้อมูลเข้า
 *   cd web && node --experimental-strip-types scripts/phoenix.test.mts
 *
 * ไม่แตะฐานข้อมูล ไม่เปิดเบราว์เซอร์ · อ่าน CSV ต้นทางแล้วแปลงเป็นรูปร่างเดียวกับที่
 * pricing.phoenix_sheet() คืนมา (ซึ่งก็คือรูปร่างของ pricing.v_price_list)
 *
 * สิ่งที่ต้องจริงตลอด · มาจากที่ Bay ยืนยันไว้ 2026-11-09
 *   1 · สั่งได้ 6 แบบ · แขนสองข้าง / แขนข้างเดียว (ซ้าย-ขวา) / + โต๊ะ / ไม่มีแขน / หมุน 90°
 *   2 · ราคาผูกกับ "มีโต๊ะ / ไม่มีโต๊ะ" อย่างเดียว · เลือกแขนแบบไหนราคาเท่ากันหมด
 *   3 · ความกว้างในใบราคาคือความกว้างรวม (โต๊ะอยู่ในนั้นแล้ว) ไม่ต้องบวกอีก
 *   4 · แขนสองข้าง + โต๊ะ โรงงานไม่มี · ต้องกดไม่ได้
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
// @ts-expect-error -- node --experimental-strip-types ต้องการนามสกุล .ts
import { GRADES, PLAN_MM, buildPhoenix, canPick, cellOf, isSofa, replyLine, variantName, variantOf } from '../src/modules/phoenix/build.ts';
import type { Item, Pick } from '../src/modules/phoenix/build.ts';

const CSV = join(dirname(fileURLToPath(import.meta.url)),
                 '../../docs/source/standard-price-2026-grid-view.csv');

/** อ่าน CSV รองรับช่องที่มีเครื่องหมายคำพูด */
function parseCsv(t: string): Record<string, string>[] {
  const rows: string[][] = [];
  let f = '', row: string[] = [], q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; }
    else if (c !== '\r') f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  const head = rows.shift()!.map((h) => h.replace(/^﻿/, ''));
  return rows.filter((r) => r.length === head.length)
             .map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}
const num = (s: string) => { const m = /([\d.]+)/.exec((s || '').replace(/,/g, '')); return m ? +m[1] : null; };

const rows = parseCsv(readFileSync(CSV, 'utf8'))
  .filter((r) => r['Collection Name'].trim() === 'ฟีนิกซ์')
  .map((r, i) => ({
    product_id: `${r['Collection Name'].trim()}|${r['Category'].trim()}`,
    รุ่น: r['Collection Name'].trim(), หมวด: r['Category'].trim(),
    ชื่ออังกฤษ: r['Product name english'].trim() || null, รูป: null, หมายเหตุรุ่น: null,
    variant_id: String(i), sku: r['NNSKU#'].trim(), sku_display: r['NNSKU#'].trim(),
    รูปทรง: r['Sub Category 1'].trim() || null,
    เกรดวัสดุ: r['วัสดุหุ้ม (Upholstery Material)'].trim() || null,
    ไม้: r['Wood (ประเภทไม้)'].trim() || null, สีไม้: r['Wood Colour (สีไม้)'].trim() || null,
    กว้าง: num(r['กว้าง (W)']), ลึก: num(r['ลึก (D)']), สูง: num(r['สูง (H)']),
    สูงที่นั่ง: null, ลึกที่นั่ง: null,
    ราคาเต็มรวม_vat: num(r['Retail Price include VAT']),
    ส่วนลดปกติ_pct: num(r['PercentDiscount']),
    ราคาขายรวม_vat: num(r['Discounted price  IncludeVAT']),
    ที่มาของราคา: 'csv',
  }));

let pass = 0, fail = 0;
const ok = (name: string, got: unknown, want: unknown) => {
  const good = JSON.stringify(got) === JSON.stringify(want);
  if (good) pass++; else fail++;
  console.log(`${good ? 'ok  ' : 'FAIL'}  ${name}` +
              (good ? '' : `  got=${JSON.stringify(got)} want=${JSON.stringify(want)}`));
};

const items: Item[] = buildPhoenix(rows);
const it = (label: string) => {
  const hit = items.find((x) => x.label === label);
  if (!hit) throw new Error(`ไม่มีรายการ ${label} · มีแต่ ${items.map((x) => x.label).join(', ')}`);
  return hit;
};
const P = (o: Partial<Pick> = {}): Pick => ({ arm: 'both', side: 'R', tbl: false, v: 0, ...o });
const code = (label: string, p: Partial<Pick> = {}) => variantOf(it(label), P(p))?.code ?? null;
/** ราคาเต็มของเกรดที่ ci · ตัวเลขเดียวกับที่ตารางในหน้าเว็บโชว์ */
const full = (label: string, ci: number, p: Partial<Pick> = {}) =>
  cellOf(it(label), P(p), 'g', ci)?.full ?? null;

/* ── อ่านใบราคาเข้ามาได้ ── */
ok('มีแถวฟีนิกซ์ในใบราคา', rows.length > 50, true);
ok('ไม่มีคอลเลกชันอื่นหลงมา', [...new Set(rows.map((r) => r.รุ่น))], ['ฟีนิกซ์']);
ok('5 เกรดวัสดุ', GRADES.length, 5);
ok('ยุบแถว "+ โต๊ะข้าง" เข้ากับตัวโซฟาแล้ว',
   items.some((x) => x.label.includes('+ โต๊ะข้าง')), false);
ok('ตัวโซฟา 230 มีทั้งราคาไม่มีโต๊ะและมีโต๊ะ',
   [!!it('ตัวโซฟา 230 ซม.').cells.length, !!it('ตัวโซฟา 230 ซม.').cellsT], [true, true]);

/* ── 1 · หกแบบที่สั่งได้ · รหัสต้องตรงกับไฟล์โรงงาน ── */
ok('1 แขนสองข้าง',            code('ตัวโซฟา 230 ซม.'), 'PHX230-2AR');
ok('2 แขนข้างเดียว ขวา',       code('ตัวโซฟา 230 ซม.', { arm: 'one', side: 'R' }), 'PHX230R');
ok('2 แขนข้างเดียว ซ้าย',      code('ตัวโซฟา 230 ซม.', { arm: 'one', side: 'L' }), 'PHX230L');
ok('3 แขนข้างเดียว + โต๊ะ ขวา', code('ตัวโซฟา 230 ซม.', { arm: 'one', side: 'R', tbl: true }), 'PHX230RA-T');
ok('3 แขนข้างเดียว + โต๊ะ ซ้าย', code('ตัวโซฟา 230 ซม.', { arm: 'one', side: 'L', tbl: true }), 'PHX230LA-T');
ok('4 ไม่มีแขน',              code('ตัวโซฟา 230 ซม.', { arm: 'none' }), 'PHX230NA');
ok('5 ไม่มีแขน + โต๊ะ',        code('ตัวโซฟา 230 ซม.', { arm: 'none', side: 'R', tbl: true }), 'PHX230RT');

/* ── 4 · แขนสองข้าง + โต๊ะ ไม่มีในไฟล์โรงงาน ── */
ok('แขนสองข้าง + โต๊ะ ไม่มีแบบ', code('ตัวโซฟา 230 ซม.', { arm: 'both', tbl: true }), null);
ok('แขนสองข้าง + โต๊ะ กดไม่ได้', canPick(it('ตัวโซฟา 230 ซม.'), 'both', true, 'R'), false);
ok('แขนข้างเดียว + โต๊ะ กดได้',  canPick(it('ตัวโซฟา 230 ซม.'), 'one', true, 'R'), true);

/* ── 2 · ราคาผูกกับโต๊ะอย่างเดียว · แขนไม่เกี่ยว ── */
const noTbl = full('ตัวโซฟา 230 ซม.', 0);
const wiTbl = full('ตัวโซฟา 230 ซม.', 0, { arm: 'one', tbl: true });
ok('ไม่มีโต๊ะ · มีราคา', typeof noTbl, 'number');
ok('มีโต๊ะ · ราคาสูงกว่า', (wiTbl ?? 0) > (noTbl ?? 0), true);
ok('ไม่มีโต๊ะ · ทุกแบบแขนราคาเดียวกัน', [
  full('ตัวโซฟา 230 ซม.', 0, { arm: 'both' }),
  full('ตัวโซฟา 230 ซม.', 0, { arm: 'one', side: 'R' }),
  full('ตัวโซฟา 230 ซม.', 0, { arm: 'one', side: 'L' }),
  full('ตัวโซฟา 230 ซม.', 0, { arm: 'none' }),
], [noTbl, noTbl, noTbl, noTbl]);
ok('มีโต๊ะ · ทุกแบบแขนราคาเดียวกัน', [
  full('ตัวโซฟา 230 ซม.', 0, { arm: 'one', side: 'R', tbl: true }),
  full('ตัวโซฟา 230 ซม.', 0, { arm: 'one', side: 'L', tbl: true }),
  full('ตัวโซฟา 230 ซม.', 0, { arm: 'none', tbl: true }),
], [wiTbl, wiTbl, wiTbl]);
ok('ครบทั้ง 5 เกรด ราคาไม่ซ้ำกันไปหมด',
   new Set(GRADES.map((_, i) => full('ตัวโซฟา 230 ซม.', i))).size > 1, true);

/* ── 3 · ความกว้างรวม · โต๊ะอยู่ในความกว้างแล้ว ไม่บวกอีก ── */
const mmOf = (c: string) => PLAN_MM[c] as [number, number] | undefined;
ok('แบบไม่มีโต๊ะ กว้าง 2300 มม.', mmOf('PHX230-2AR')?.[0], 2300);
ok('แบบมีโต๊ะ กว้างเท่ากัน 2300 มม. (ไม่ใช่ 2700)', mmOf('PHX230RA-T')?.[0], 2300);
ok('ตัวโซฟา 230 + เดย์เบด 125 = กว้างรวม 355 ซม.',
   ((mmOf('PHX230RA-T')?.[0] ?? 0) + (mmOf('PHX-CL125X166')?.[0] ?? 0)) / 10, 355);

/* ── แบบแปลนมีจริงทุกรหัสที่หน้าเว็บเสนอให้กด ── */
const offered: string[] = [];
for (const x of items) {
  for (const arm of ['both', 'one', 'none'] as const)
    for (const side of ['R', 'L'] as const)
      for (const tbl of [false, true]) {
        const v = variantOf(x, P({ arm, side, tbl }));
        if (v) offered.push(v.code);
      }
  x.draw.forEach((v: { code: string }) => offered.push(v.code));
}
ok('ทุกแบบที่เสนอให้กด มีแบบแปลนจริง',
   [...new Set(offered)].filter((c) => !PLAN_MM[c]), []);
ok('เสนอให้กดเยอะกว่า 20 แบบ', new Set(offered).size > 20, true);

/* ── ของที่ไม่ใช่ตัวโซฟา ── */
ok('เดย์เบดมีสองด้าน ซ้าย-ขวา', it('เดย์เบด 125×166').draw.length >= 2, true);
ok('เดย์เบดไม่ใช่ตัวโซฟาที่เลือกแขนได้', isSofa(it('เดย์เบด 125×166')), false);
ok('หมอนกับที่พักหัวไม่มีแบบแปลนของตัวเอง ไม่พัง',
   items.filter((x) => x.cat === 'หมอน').every((x) => Array.isArray(x.draw)), true);

/* ── ชื่อแบบที่โชว์ให้คนอ่าน ── */
ok('ชื่อแบบ · แขนขวา + โต๊ะ',
   variantName(it('ตัวโซฟา 230 ซม.'), P({ arm: 'one', side: 'R', tbl: true })), 'แขนขวา + โต๊ะข้าง');
ok('ชื่อแบบ · ไม่มีแขน', variantName(it('ตัวโซฟา 230 ซม.'), P({ arm: 'none' })), 'ไม่มีแขน');

/* ── ขอบเขตของไฟล์โรงงาน · บางความกว้างไม่มีบางแบบ ── */
ok('150 ไม่มีแบบมีโต๊ะ', canPick(it('ตัวโซฟา 150 ซม.'), 'one', true, 'R'), false);
ok('150 มีแบบแขนสองข้าง',  canPick(it('ตัวโซฟา 150 ซม.'), 'both', false, 'R'), true);

/* ── บรรทัดตอบลูกค้า · รูปแบบที่ Bay ส่งมา 2026-11-09 ──
     ฌ เฌอ | โซฟา 3 ที่นั่ง ฟีนิกซ์ (Phoenix Sofa)   ผ้า A เลือกสีได้
            | ขนาด W190 D96 H85 cm ราคา 90900 ลด 40% เหลือ 54540 บาท       */
const reply = (label: string, pk: Partial<Pick> & { kind?: 'g' | 'e'; ci?: number } = {}) => {
  const x = it(label);
  const q = { ...P(pk), kind: pk.kind ?? 'g', ci: pk.ci ?? 0, qty: 1, mir: false, rot: false };
  const c = cellOf(x, q, q.kind, q.ci);
  return replyLine(x, q, {
    full: c?.full ?? 0, sale: c?.sale ?? c?.full ?? 0, disc: c?.disc ?? 0,
    ask: !c || c.full == null,
  });
};

ok('โซฟา 190 ผ้า A · ตัวเลขตรงกับที่ Bay ส่งมา', reply('ตัวโซฟา 190 ซม.'),
   'ฌ เฌอ | โซฟา ฟีนิกซ์ (Phoenix Sofa) แขนสองข้าง ผ้า A เลือกสีได้ | ขนาด W190 D96 H85 cm ราคา 90900 ลด 40% เหลือ 54540 บาท');
ok('ขึ้นต้นด้วย ฌ เฌอ | เสมอ', reply('เดย์เบด 125×166').startsWith('ฌ เฌอ | '), true);
ok('ตัวเลขไม่ใส่จุลภาค ตามที่ Bay เขียน', /,/.test(reply('ตัวโซฟา 230 ซม.')), false);
ok('มีคำว่า ราคา ... ลด ...% เหลือ ... บาท',
   /ราคา \d+ ลด \d+% เหลือ \d+ บาท$/.test(reply('ตัวโซฟา 230 ซม.')), true);
ok('เลือกแขนกับโต๊ะแล้วบอกในบรรทัดด้วย',
   reply('ตัวโซฟา 230 ซม.', { arm: 'one', side: 'R', tbl: true }).includes('แขนขวา + โต๊ะข้าง'), true);
ok('ไม่มีรหัสโรงงานหลุดไปถึงลูกค้า',
   /3S|3RT|CL \(|DAYBED-|PHX|with Table/.test(
     items.map((x) => reply(x.label)).join('\n')), false);
ok('เดย์เบดใช้ชื่ออังกฤษของเดย์เบด ไม่ใช่ของโซฟา',
   reply('เดย์เบด 125×166').includes('(Phoenix Daybed)'), true);
ok('เดย์เบดไม่พูดคำว่าเดย์เบดซ้ำ',
   (reply('เดย์เบด 125×166').match(/เดย์เบด/g) ?? []).length, 1);
ok('ผ้ากับหนังบอกว่าเลือกสีได้', reply('ตัวโซฟา 230 ซม.').includes('ผ้า A เลือกสีได้'), true);
ok('งานไม้บอกชนิดไม้กับสีไม้ ไม่ซ้ำคำ',
   reply('ตู้เก็บของ 135 ซม.', { kind: 'e' }).includes('ไม้โอ๊ค สีธรรมชาติ |'), true);
ok('ขนาดไม่ปัดทศนิยมทิ้ง · ตู้ลึก 43.5 ไม่ใช่ 44',
   reply('ตู้เก็บของ 135 ซม.', { kind: 'e' }).includes('D43.5'), true);
ok('หมุน 90° แล้วบอกในบรรทัด และกว้างลึกสลับกัน', (() => {
  const x = it('เดย์เบด 125×166');
  const q = { ...P(), kind: 'g' as const, ci: 0, qty: 1, mir: false, rot: true };
  const c = cellOf(x, q, 'g', 0);
  const line = replyLine(x, q, { full: c!.full!, sale: c!.sale!, disc: c!.disc, ask: false });
  return line.includes('หมุน 90°') && line.includes('W166 D125');
})(), true);

/* ── ห้ามมีต้นทุนหลุดมาสักช่อง ── */
ok('ไม่มีคำว่าต้นทุนในผลลัพธ์', /ต้นทุน|cost|margin|กำไร/i.test(JSON.stringify(items)), false);

console.log(`\nผ่าน ${pass} · ไม่ผ่าน ${fail}`);
process.exit(fail ? 1 : 0);
