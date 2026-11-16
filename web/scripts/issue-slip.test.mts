/**
 * ทดสอบการคิดใบขอเบิกวัตถุดิบ
 *   cd web && node --experimental-strip-types scripts/issue-slip.test.mts
 *
 * เคสยืนยันคือของจริงจากใบที่ระบบโรงงานปรินต์ออกมา (SE-04 W/O 45/26)
 * และสูตรจริงในฐานข้อมูล CostPrg
 */
// @ts-expect-error -- node --experimental-strip-types ต้องการนามสกุล .ts
import { countByDep, depsUsed, explain, hiddenFor, isWholeUnit, issueQty, slipFor } from '../src/modules/production/issue-slip.ts';
import type { Line } from '../src/modules/production/issue-slip.ts';
// @ts-expect-error -- เหมือนกัน
import { HEADS, LINES } from '../src/modules/production/cost-sample.ts';

let pass = 0, fail = 0;
const ok = (name: string, got: unknown, want: unknown) => {
  const good = JSON.stringify(got) === JSON.stringify(want);
  if (good) pass++; else fail++;
  console.log(`${good ? 'ok  ' : 'FAIL'}  ${name}${good ? '' : `  got=${JSON.stringify(got)} want=${JSON.stringify(want)}`}`);
};
const L = (o: Partial<Line>): Line => ({
  item: 1, name: 'x', unit: 'F2', unit1: 'หลา', net: 0, rec: 1, rec1: 1,
  groupId: 'C', depId: 1, hide: false, c1: false, c2: false, ...o,
});

/* ── 1 · เคสจริงจากใบที่โรงงานปรินต์ · SE-04 ───────────────────────── */
/* ใย 200 กรัม · กระดาษ P-6 บอก 94.9 ตร.ฟุต · Rec_ 0.9 · ตัวหาร#2 17.5
   ใบขอเบิกแผนกวางแบบที่ปรินต์ออกมาเขียนว่า "6 หลา" */
const fibre = issueQty(L({ net: 94.9, rec: 0.9, rec1: 17.5, unit1: 'หลา' }));
ok('ใย 200 กรัม เลขดิบ', Math.round(fibre.raw * 100) / 100, 6.03);
ok('ใย 200 กรัม ตรงกับใบจริง (6 หลา)', Math.round(fibre.raw), 6);

/* ซิปม้วนสีดำ จากตาราง Paste Errors · 190 CM ÷ 1 ÷ 100 = 1.9 เมตร */
ok('ซิปม้วน 190 ซม. = 1.9 เมตร',
   issueQty(L({ net: 190, rec: 1, rec1: 100, unit: 'CM', unit1: 'เมตร' })).issue, 1.9);

/* ── 2 · หน่วยที่นับเป็นชิ้น ต้องปัดขึ้น ───────────────────────────── */
ok('แผ่น เป็นหน่วยนับชิ้น', isWholeUnit('แผ่น'), true);
ok('หลา ไม่ใช่หน่วยนับชิ้น', isWholeUnit('หลา'), false);
ok('เมตร ไม่ใช่หน่วยนับชิ้น', isWholeUnit('เมตร'), false);

const foam = issueQty(L({ net: 20.8, rec: 0.9, rec1: 27.8, unit1: 'แผ่น' }));
ok('ฟองน้ำ 20.8 ตร.ฟุต → 0.83 แผ่น', Math.round(foam.raw * 100) / 100, 0.83);
ok('ฟองน้ำปัดขึ้นเป็น 1 แผ่น', foam.issue, 1);
ok('บอกว่าปัดขึ้น', foam.how, 'ปัดขึ้น');
ok('พอดีเป๊ะไม่ต้องปัดขึ้นเกิน',
   issueQty(L({ net: 20, rec: 1, rec1: 1, unit1: 'ตัว' })).issue, 20);

/* ── 3 · สั่งหลายตัว ต้องคูณ ──────────────────────────────────────── */
ok('สั่ง 3 ตัว', issueQty(L({ net: 94.9, rec: 0.9, rec1: 17.5 }), 3).issue, 18.08);
ok('qty 0 ถือเป็น 1', issueQty(L({ net: 10, rec: 1, rec1: 1 }), 0).issue, 10);
ok('rec 0 ไม่หารศูนย์', Number.isFinite(issueQty(L({ net: 10, rec: 0, rec1: 1 })).raw), true);

/* ── 4 · ใบของแต่ละแผนก ───────────────────────────────────────────── */
const lines: Line[] = [
  L({ item: 1, name: 'ผ้า', depId: 1, net: 43.4, rec: 0.85, rec1: 10.75 }),
  L({ item: 2, name: 'ไม้', depId: 2, net: 5, rec: 0.9, rec1: 1, unit1: 'อัน' }),
  L({ item: 3, name: 'สกรู', depId: 2, net: 20, rec: 1, rec1: 1, unit1: 'ตัว' }),
  L({ item: 4, name: 'เทปใส', depId: 7, net: 1, rec: 1, rec1: 1, unit1: 'ม้วน', hide: true }),
];
ok('แผนกโครงไม้มี 2 บรรทัด', slipFor(lines, 2).length, 2);
ok('เลขลำดับเริ่มที่ 1 ใหม่ทุกใบ', slipFor(lines, 2).map((r) => r.no), [1, 2]);
ok('ของที่ติ๊กไม่แสดง ไม่ขึ้นใบ', slipFor(lines, 7).length, 0);
ok('แต่ยังดูได้ว่าถูกตัดอะไรออก', hiddenFor(lines, 7).map((l) => l.name), ['เทปใส']);
ok('แผนกที่มีของให้เบิก', depsUsed(lines), [1, 2]);
ok('นับต่อแผนก', [...countByDep(lines).entries()].sort(), [[1, 1], [2, 2]]);

/* ── 5 · ข้อความอธิบาย ต้องบอกที่มาครบ ────────────────────────────── */
const ex = explain(L({ net: 94.9, rec: 0.9, rec1: 17.5, unit: 'F2', unit1: 'หลา' }));
ok('อธิบายมี Rec_', ex.includes('÷ 0.9 (Rec_)'), true);
ok('อธิบายมีตัวหาร#2', ex.includes('÷ 17.5 (ตัวหาร#2)'), true);
ok('อธิบายไม่โชว์ ÷ 1 ที่ไม่มีความหมาย',
   explain(L({ net: 20, rec: 1, rec1: 1, unit: 'ตัว', unit1: 'ตัว' })).includes('÷'), false);

/* ── 6 · ข้อมูลตัวอย่างจริงต้องใช้งานได้ ──────────────────────────── */
ok('มีสูตรตัวอย่าง 3 ใบ', HEADS.length, 3);
const emu = LINES.filter((l: Line & { costNo: string; partId: string }) =>
  l.costNo === '170/14ฌ' && l.partId === '3-S');
ok('สูตร EMU 3-S มี 71 บรรทัด', emu.length, 71);
ok('ทุกบรรทัดมีแผนก', emu.every((l: Line) => l.depId > 0), true);
ok('ทุกบรรทัดคิดออกมาเป็นตัวเลขได้',
   emu.every((l: Line) => Number.isFinite(issueQty(l).issue)), true);
ok('แยกใบได้ครบทุกแผนกที่ใช้', depsUsed(emu).length > 0, true);
ok('รวมทุกใบแล้วไม่เกินจำนวนบรรทัดทั้งหมด',
   depsUsed(emu).reduce((s: number, d: number) => s + slipFor(emu, d).length, 0) <= emu.length, true);

/* ── 7 · ห้ามมีราคาหลุดเข้ามา ─────────────────────────────────────── */
/* ชื่อช่องต้องไม่มีอะไรที่เป็นเงิน · costNo คือ "เลขที่สูตร" ไม่ใช่ราคา จึงไม่นับ */
ok('ข้อมูลตัวอย่างไม่มีช่องราคา',
   Object.keys(LINES[0]).filter((k) => k !== 'costNo')
     .some((k) => /price|cost|ราคา|ต้นทุน|amount|baht/i.test(k)), false);

console.log(`\nผ่าน ${pass} · ไม่ผ่าน ${fail}`);
process.exit(fail ? 1 : 0);
