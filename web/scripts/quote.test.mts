/**
 * ทดสอบตัวแกะข้อความลูกค้า + ตัวจับคู่ใบราคา
 *   cd web && node --experimental-strip-types scripts/quote.test.mts
 *
 * ใช้ข้อความจริงที่ลูกค้าส่งมาหาคุณบุ๊ก (Bay ส่งต่อให้ 2026-11-10)
 * และใบราคาจริง 751 แถว · ไม่แตะฐานข้อมูล ไม่เปิดเบราว์เซอร์
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
// @ts-expect-error -- node --experimental-strip-types ต้องการนามสกุล .ts
import { parseRequest } from '../src/modules/quote/parse.ts';
// @ts-expect-error -- เหตุผลเดียวกัน
import { buildProducts, confident, matchLine, sizeText } from '../src/modules/quote/match.ts';
// @ts-expect-error -- เหตุผลเดียวกัน
import { quoteNo, renumber, thaiDate, totalsOf } from '../src/modules/quote/doc.ts';
import type { Product } from '../src/modules/quote/match.ts';
import type { Quote, QuoteLine } from '../src/modules/quote/doc.ts';

const CSV = join(dirname(fileURLToPath(import.meta.url)),
                 '../../docs/source/standard-price-2026-grid-view.csv');

function parseCsv(t: string): Record<string, string>[] {
  const rows: string[][] = []; let f = '', row: string[] = [], q = false;
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

const rows = parseCsv(readFileSync(CSV, 'utf8')).map((r, i) => ({
  product_id: `${r['Collection Name'].trim()}|${r['Category'].trim()}`,
  รุ่น: r['Collection Name'].trim(), หมวด: r['Category'].trim(),
  ชื่ออังกฤษ: r['Product name english'].trim() || null,
  รูป: null, หมายเหตุรุ่น: null,
  variant_id: String(i), sku: '', sku_display: '',
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

/* ── ข้อความจริงจากลูกค้า ── */
const MSG = `สวัสดีค่าคุณบุ๊ก ขอใบเสนอราคาเพิ่มเติมอีก2โครงการค่ะ แยกกันสาขาละ1ใบค่ะ

CLP
Option1
- Krata Lounge Chair PVC SM Wheat 3 ตัว
Option2
- Krata Lounge Chair PVC SM Wheat 2 ตัว
- Khonmai Stool PVC SM Wheat 1 ตัว
บริษัท อุรา กรุงเทพ คลินิก จำกัด (สาขา 00016) อาคารศูนย์การค้าเซ็นทรัล สาขาลาดพร้าว ห้องเลขที่ OF1101 ชั้นที่ 11 เลขที่ 1693 ถนนพหลโยธิน แขวงจตุจักร เขตจตุจักร จังหวัดกรุงเทพมหานคร 10900

MGB
- Emu Bench 1.00m. PVC SM Wheat 2 ตัว
- Khonmai Stool PVC SM Wheat 3 ตัว
- Khonmai Stool PVC SM White 4 ตัว
บริษัท อุรา กรุงเทพ คลินิก จำกัด (สาขา 00013) อาคารศูนย์การค้าเมกาบางนา ห้องเลขที่ 1222/4, 1224/1, 1722 ชั้น 1 เลขที่ 39 หมู่ 6 ถนนบางนา-ตราด ตำบลบางแก้ว อำเภอบางพลี จังหวัดสมุทรปราการ 10540`;

const docs = parseRequest(MSG);

ok('แยกได้ 3 ใบ · CLP สองตัวเลือก + MGB', docs.length, 3);
ok('หัวใบถูก', docs.map((d) => `${d.title} ${d.option}`.trim()),
   ['CLP Option 1', 'CLP Option 2', 'MGB']);
ok('CLP Option 1 มี 1 รายการ', docs[0].lines.length, 1);
ok('CLP Option 2 มี 2 รายการ', docs[1].lines.length, 2);
ok('MGB มี 3 รายการ', docs[2].lines.length, 3);

ok('อ่านจำนวนถูก', docs.map((d) => d.lines.map((l) => l.qty)), [[3], [2, 1], [2, 3, 4]]);
ok('แยกชื่อสินค้าออกจากวัสดุ', docs[0].lines[0].name, 'Krata Lounge Chair');
ok('เก็บคำวัสดุที่ลูกค้าเขียนไว้', docs[0].lines[0].spec, 'PVC SM Wheat');
ok('วัสดุคนละสีแยกกัน', docs[2].lines.map((l) => l.spec),
   ['PVC SM Wheat', 'PVC SM Wheat', 'PVC SM White']);
ok('ชื่อสินค้าที่มีขนาดติดมา ไม่โดนตัดทิ้ง', docs[2].lines[0].name, 'Emu Bench 1.00m.');

ok('ชื่อลูกค้าเข้าทั้งสองตัวเลือกของ CLP',
   docs.slice(0, 2).every((d) => d.customer.includes('อุรา กรุงเทพ คลินิก')), true);
ok('สาขาต่างกันระหว่าง CLP กับ MGB',
   [docs[0].customer.includes('00016'), docs[2].customer.includes('00013')], [true, true]);
ok('ที่อยู่ CLP ได้รหัสไปรษณีย์', docs[0].address.includes('10900'), true);
ok('ที่อยู่ MGB ได้รหัสไปรษณีย์', docs[2].address.includes('10540'), true);
ok('คำทักทายไม่กลายเป็นรายการ',
   JSON.stringify(docs).includes('สวัสดี'), false);

/* ── จับคู่กับใบราคา ── */
const products: Product[] = buildProducts(rows);
ok('รวม 751 แถวเป็นสินค้าได้', products.length > 100 && products.length < 400, true);

const top = (t: string) => matchLine(t, products)[0];
ok('Krata Lounge Chair → เลาจ์แชร์ กระทา', (() => {
  const h = top('Krata Lounge Chair');
  return [h.p.category, h.p.collection, h.p.w];
})(), ['เลาจ์แชร์', 'กระทา', 69]);
ok('Krata Lounge Chair ชัดพอจะเลือกให้ล่วงหน้า',
   confident(matchLine('Krata Lounge Chair', products)), true);

ok('Khonmai Stool เจอสองขนาด ต้องถาม', (() => {
  const hits = matchLine('Khonmai Stool', products).filter((h) => h.p.en.includes('Khonmai'));
  return [hits.length, confident(matchLine('Khonmai Stool', products))];
})(), [2, false]);

ok('Emu Bench 1.00m. ไม่มีในใบราคา · ตัวแรกไม่ใช่ของอีมู', (() => {
  const h = top('Emu Bench 1.00m.');
  return h.p.en.includes('Emu Bench');
})(), false);
ok('แต่ยังเสนอม้านั่งกว้าง 110 ที่ใกล้ที่สุดให้ดู',
   matchLine('Emu Bench 1.00m.', products).some((h) => h.p.category === 'ม้านั่ง'), true);

ok('ขนาดที่ลูกค้าเขียนช่วยคัดได้', (() => {
  const h = top('Nangnuan Bench 1.55m.');
  return [h.p.collection, h.p.w];
})(), ['นางนวล', 155]);

ok('สินค้ามีเกรดวัสดุครบ · เลาจ์แชร์กระทา 5 เกรด',
   top('Krata Lounge Chair').p.variants.length, 5);
ok('ราคาเต็มของเกรดถูกสุดคือ 36500',
   top('Krata Lounge Chair').p.variants[0].retail, 36500);

/* ── บรรทัดที่จะไปโผล่ในใบเสนอราคา ── */
ok('บรรทัดแรกเป็นรูปแบบเดียวกับใบจริงของ Bay', (() => {
  const h = matchLine('Koontong Sideboard 120', products)
    .find((x) => x.p.en.includes('Koontong Sideboard') && x.p.w === 120)!;
  return h.p.head;
})(), 'ฌ เฌอ | ตู้เก็บของ ขุนทอง (Koontong Sideboard)');
ok('บรรทัดสองมีไม้กับขนาด', (() => {
  const h = matchLine('Koontong Sideboard 120', products)
    .find((x) => x.p.en.includes('Koontong Sideboard') && x.p.w === 120
                 && x.p.wood.includes('วอลนัท'))!;
  return h.p.sub;
})(), 'ไม้โอ๊ค สีวอลนัท | ขนาด W120 D43.5 H79 cm');
ok('ขนาดไม่ปัดทศนิยมทิ้ง', sizeText(120, 43.5, 79), 'W120 D43.5 H79');

/* ── ตัวเลขท้ายใบ ── */
const line = (over: Partial<QuoteLine> = {}): QuoteLine => ({
  id: 'x', no: '1', head: 'h', sub: 's', colour: '', qty: 1,
  retail: 44600, unit: 35680, image: null, ...over,
});
const q = (over: Partial<Quote> = {}): Quote => ({
  no: 'QUO2611001', date: '10/11/2569', customer: '', address: '', tel: '', line: '',
  project: '', deliverTo: '', deliverDate: '', note: '', salesperson: 'Bay',
  lines: [line(), line({ retail: 51500, unit: 41200 })], addVat: false, ...over,
});

ok('ยอดรวมเหมือนใบจริง 20260901', totalsOf(q()).grand, 35680 + 41200);
ok('ราคารวม VAT แล้ว · ไม่บวกซ้ำ', totalsOf(q()).vat, null);
ok('ส่วนลดรวมคิดจากราคาเต็ม', totalsOf(q()).saved, (44600 - 35680) + (51500 - 41200));
ok('โหมดแยก VAT · ถอดออกมาแล้วบวกกลับได้เท่าเดิม', (() => {
  const t = totalsOf(q({ addVat: true }));
  return [t.sub + (t.vat ?? 0), t.grand];
})(), [76880, 76880]);

ok('เลขข้อเรียงใหม่ ค่าขนส่งไม่กินเลข',
   renumber([line(), line({ retail: null, unit: null }), line()]).map((l) => l.no),
   ['1', '', '2']);
ok('เลขที่ใบตามแบบ QUO + ปีพุทธ + เดือน + ลำดับ',
   quoteNo(1, new Date('2026-09-15')), 'QUO2609001');
ok('วันที่เป็นปีพุทธ', thaiDate(new Date('2026-09-15')), '15/9/2569');

console.log(`\nผ่าน ${pass} · ไม่ผ่าน ${fail}`);
process.exit(fail ? 1 : 0);
