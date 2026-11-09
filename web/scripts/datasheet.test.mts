/**
 * ทดสอบตัวสร้าง data sheet · ใช้ใบราคาจริง 751 แถวเป็นข้อมูลเข้า
 *   cd web && node --experimental-strip-types scripts/datasheet.test.mts
 *
 * ไม่แตะฐานข้อมูล · อ่าน CSV ต้นทางแล้วแปลงเป็นรูปร่างเดียวกับที่
 * pricing.v_price_list คืนมา จะได้เทสต์ตรรกะได้โดยไม่ต้องต่อเน็ต
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
// @ts-expect-error -- node --experimental-strip-types ต้องการนามสกุล .ts
import { buildSheets, commonEnName } from '../src/modules/datasheet/build.ts';
import type { Sheet, Module } from '../src/modules/datasheet/build.ts';
// @ts-expect-error -- เหตุผลเดียวกัน
import { WEB_SPECS } from '../src/modules/datasheet/descriptions.ts';

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
const num = (s: string) => { const m = /([\d.]+)/.exec(s || ''); return m ? +m[1] : null; };

const rows = parseCsv(readFileSync(CSV, 'utf8')).map((r, i) => ({
  product_id: `${r['Collection Name'].trim()}|${r['Category'].trim()}`,
  รุ่น: r['Collection Name'].trim(), หมวด: r['Category'].trim(),
  ชื่ออังกฤษ: r['Product name english'].trim() || null, รูป: null, หมายเหตุรุ่น: null,
  variant_id: String(i), sku: '', sku_display: '',
  รูปทรง: r['Sub Category 1'].trim() || null,
  เกรดวัสดุ: r['วัสดุหุ้ม (Upholstery Material)'].trim() || null,
  ไม้: r['Wood (ประเภทไม้)'].trim() || null, สีไม้: r['Wood Colour (สีไม้)'].trim() || null,
  กว้าง: num(r['กว้าง (W)']), ลึก: num(r['ลึก (D)']), สูง: num(r['สูง (H)']),
  สูงที่นั่ง: null, ลึกที่นั่ง: null,
  ราคาเต็มรวม_vat: null, ส่วนลดปกติ_pct: null, ราคาขายรวม_vat: null, ที่มาของราคา: '',
}));

let pass = 0, fail = 0;
const ok = (name: string, got: unknown, want: unknown) => {
  const good = JSON.stringify(got) === JSON.stringify(want);
  if (good) pass++; else fail++;
  console.log(`${good ? 'ok  ' : 'FAIL'}  ${name}` +
              (good ? '' : `  got=${JSON.stringify(got)} want=${JSON.stringify(want)}`));
};

const sheets: Sheet[] = buildSheets(rows);
const find = (t: string) => sheets.find((s) => s.th === t)!;
const mods: Module[] = sheets.flatMap((s) => s.groups.flatMap((g) => g.mods));
const code = (c: string) => mods.find((m) => m.code === c);

ok('อ่านใบราคาได้ครบ 751 แถว', rows.length, 751);
ok('33 คอลเลกชัน', sheets.length, 33);
ok('209 โมดูล', mods.length, 209);
ok('รหัสไม่ซ้ำกันเลยทั้งระบบ', mods.length - new Set(mods.map((m) => m.code)).size, 0);
ok('เรียงรุ่นใหญ่สุดขึ้นก่อน', sheets[0].th, 'ฟีนิกซ์');

// รหัสจาก data sheet โรงงาน ต้องลอกมาตรง ๆ
ok('ฟีนิกซ์ใช้รหัสจริง', find('ฟีนิกซ์').codeReal, true);
ok('ขุนทองใช้รหัสจริง', find('ขุนทอง').codeReal, true);
ok('ทากะเป็นรหัสที่เสนอ', find('ทากะ').codeReal, false);
ok('3S (230) → PHX230-2AR · ฟีนิกซ์ใช้เซนติเมตร', !!code('PHX230-2AR'), true);
ok('3RT (230) → PHX270RA-T · รหัสโรงงานรวมโต๊ะ 40 ซม.', !!code('PHX270RA-T'), true);
ok('ไม่มีรหัสฟีนิกซ์ที่เป็นมิลลิเมตร',
   mods.some((m) => /^PHX\d{4}/.test(m.code)), false);
ok('ขุนทองยังเป็นมิลลิเมตร · KT1400', !!code('KT1400'), true);
ok('เดย์เบด 125×166 → PHX-CR125X166', !!code('PHX-CR125X166'), true);
ok('ขุนทอง 2 ที่นั่ง 140 → KT1400', !!code('KT1400'), true);
ok('ขุนทองเดย์เบด → KTC70X150', !!code('KTC70X150'), true);

// ความลึกช่วงหลังของตัว L · ต้องตรงกับที่ใบราคากระดาษเขียนในวงเล็บ
ok('ทากะ L254 ช่วงหลังลึก 90', code('TK2540-L')?.backD, 90);
ok('ขุนทอง L210 ช่วงหลังลึก 80', code('KT2100-L')?.backD, 80);
ok('ฟีนิกซ์ L355 ช่วงหลังลึก 96', code('PHX355-L')?.backD, 96);
ok('โซฟาตรงลึก 92 ไม่โดนวาดเป็นตัว L', code('TK1700')?.backD, null);
ok('โซฟาตรงลึก 90 ก็ไม่โดน', code('TK1800-2S')?.backD, null);
ok('เดย์เบดเดี่ยวลึก 166 ไม่ใช่ตัว L', code('PHX-CR125X166')?.backD, null);
ok('สวอนไม่มีโซฟาตรงให้เทียบ · ไม่เดา',
   find('สวอน').groups.find((g) => g.cat === 'โซฟา')!.mods[0].backD, null);

// ยุบเกรดวัสดุให้เหลือโมดูลเดียว
const t254 = code('TK2540-L')!;
ok('ทากะ L254 รวม 5 เกรดเป็นโมดูลเดียว', t254.variants, 5);
ok('เรียงเกรดตามใบราคากระดาษ', t254.mats,
   ['ผ้า A', 'ผ้า B', 'ผ้า C', 'หนังแท้', 'หนังแท้ (ออย)']);

// แถวที่ใบราคาแยกชื่อไม่ออก
const phx = find('ฟีนิกซ์');
ok('ฟีนิกซ์ · จับแถวที่แยกชื่อไม่ออกได้', phx.ambiguous.length > 0, true);
ok('ฟีนิกซ์ · 3RT (170) ชนกับ 170 cm with Table',
   phx.ambiguous.some((a) => a.subs.includes('3RT (170)') && a.subs.includes('170 cm with Table')), true);
ok('ไม่เตือนมั่ว · W230 มีโต๊ะกับไม่มีโต๊ะ ขนาดเท่ากันแต่คนละของ',
   phx.ambiguous.some((a) => a.subs.includes('3S (230)')), false);
ok('ทากะไม่มีแถวกำกวม', find('ทากะ').ambiguous.length, 0);

// ชุดโต๊ะอาหารนางนวล/กระสา · เก้าอี้คนละรุ่นต้องได้รหัสคนละตัว
const nn = find('นางนวล / กระสา');
const nnCodes = nn.groups.flatMap((g) => g.mods.map((m) => m.code));
ok('ชุดโต๊ะอาหาร 14 แบบ ได้รหัสครบ', nnCodes.length, 14);
ok('ไม่มีรหัสที่ต่อท้ายด้วยความสูงแบบไร้ความหมาย',
   nnCodes.some((c) => /-H\d+$/.test(c)), false);
ok('ชุดเก้าอี้กีวี่ 2 ตัว มีรหัสของตัวเอง', nnCodes.includes('NNKS800-DT-2KW'), true);
ok('ชุดเก้าอี้อีมู 2 ตัว มีรหัสของตัวเอง', nnCodes.includes('NNKS800-DT-2EMU'), true);
ok('นางนวล/กระสา ไม่เหลือแถวกำกวม', nn.ambiguous.length, 0);

// ตัวเลขในชื่อที่ซ้ำกับขนาดของโมดูลเอง ต้องไม่ถูกเอามาต่อท้ายรหัส
ok('โต๊ะทานข้าวกระสา 150 → KS1500-DT ไม่ใช่ KS1500-DT-150',
   mods.some((m) => m.code === 'KS1500-DT'), true);
ok('ไม่มีรหัสที่ลงท้ายด้วย CM',
   mods.some((m) => /CM$/.test(m.code)), false);
ok('เดย์เบดเอียงฟีนิกซ์ → PHX213-DBSLT',
   mods.some((m) => m.code === 'PHX213-DBSLT'), true);
ok('ไม่มีรหัสยาวเกิน 20 ตัว',
   mods.filter((m) => m.code.length > 20).map((m) => m.code), []);

// ชื่ออังกฤษ
ok('นางแอ่น = Nang Aaen', find('นางแอ่น').en, 'Nang Aaen');
ok('ฟีนิกซ์ = Phoenix', find('ฟีนิกซ์').en, 'Phoenix');
ok('คำขึ้นต้นร่วม', commonEnName(['Taka 1R', 'Taka Arm Chair']), 'Taka');
ok('ชื่อเดียวคืนทั้งชื่อ', commonEnName(['OAB Sofa']), 'OAB Sofa');

// คำอธิบายจากเว็บ · ต้องสะอาดและไม่แต่งเอง
const texts = Object.values(WEB_SPECS as Record<string, { text?: string }>)
  .map((v) => v.text).filter(Boolean).join('\n');
ok('ไม่มี ** ของ markdown หลงมา', texts.includes('**'), false);
ok('ไม่มีบรรทัด AVAILABLE', /AVAILABLE/i.test(texts), false);
ok('ไม่มีบรรทัดขนาดหลงมา', /W\d+\s*[xX×]?\s*D[\d.]+/.test(texts), false);
ok('ไม่มี Highlight: ลอย', /^\s*highlight\s*:?\s*$/im.test(texts), false);
ok('พัฟฟินมีคำอธิบายจริง',
   (WEB_SPECS as Record<string, { text?: string }>)['พัฟฟิน|โซฟา']?.text?.includes('modular sofa'), true);
ok('ทากะไม่มีคำอธิบาย · ไม่แต่งขึ้นเอง',
   !!(WEB_SPECS as Record<string, { text?: string }>)['ทากะ|โซฟา']?.text, false);

// data sheet ต้องไม่มีราคาติดมาสักช่อง
ok('ไม่มีช่องราคาในผลลัพธ์', /ราคา|price|retail|sale/i.test(JSON.stringify(sheets)), false);

console.log(`\nผ่าน ${pass} · ไม่ผ่าน ${fail}`);
process.exit(fail ? 1 : 0);
