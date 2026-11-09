/**
 * ส่งออกข้อมูล data sheet เป็น JSON ให้ของนอกระบบใช้ (เช่นหน้า data sheet แบบ CI)
 *   cd web && node --experimental-strip-types scripts/datasheet-export.mts
 *
 * ★ ทำไมต้องมีไฟล์นี้
 *   เคยมีตัวสร้างรหัสสองชุด · Python ใน docs/tools/ กับ TypeScript ในแอป
 *   สองชุดนี้เพี้ยนจากกันแล้วหนึ่งรอบ (ชุดโต๊ะอาหารได้รหัสคนละแบบ)
 *   ตอนนี้ตัวสร้างรหัสมีชุดเดียวคือ build.ts · ไฟล์นี้แค่ดึงผลลัพธ์ออกมา
 *   Python เหลือหน้าที่เดียวคือทำความสะอาดคำอธิบายจากเว็บ
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
// @ts-expect-error -- node --experimental-strip-types ต้องการนามสกุล .ts
import { buildSheets } from '../src/modules/datasheet/build.ts';
import type { Sheet } from '../src/modules/datasheet/build.ts';
// @ts-expect-error -- เหตุผลเดียวกัน
import { webSpecOf } from '../src/modules/datasheet/descriptions.ts';

const here = dirname(fileURLToPath(import.meta.url));
const CSV = join(here, '../../docs/source/standard-price-2026-grid-view.csv');
const OUT = join(here, '../../docs/source/datasheet-modules.json');

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

const sheets: Sheet[] = buildSheets(rows);
// แนบคำอธิบายกับลิงก์เข้าไปด้วย เพื่อให้ไฟล์เดียวใช้ทำแผ่นข้างนอกได้เลย
const out = sheets.map((s) => ({
  ...s,
  groups: s.groups.map((g) => ({ ...g, web: webSpecOf(s.th, g.cat) ?? null })),
}));
writeFileSync(OUT, JSON.stringify(out, null, 1), 'utf8');
console.log(`เขียน ${OUT}`);
console.log(`${out.length} คอลเลกชัน · ${out.reduce((n, s) => n + s.modules, 0)} โมดูล`);
