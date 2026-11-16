/**
 * คำตอบราคาต้องตรงคอลัมน์ "Answer Customer" ในไฟล์ราคาเป๊ะ (D13 · B41)
 *   cd web && node --experimental-strip-types scripts/price-sentence.test.mts
 */
// @ts-expect-error -- node --experimental-strip-types ต้องการนามสกุล .ts
import { priceSentence } from '../src/modules/line-agent/price-text.ts';

const name = 'ฌ เฌอ | อาร์มแชร์   กีวี่ (Kiwi Armchair) ไม้โอ๊ค   ผ้า A เลือกสีได้ | ขนาด W66 D82 H77 cm';
const base = { name, list_price: 33600, disc_pct: 20, price: 26880, approved: true };
const cash = { kind: 'ชำระเงินสด', name: 'x', percent: 10, min_total: null, detail: null, link: null, ends_on: '2026-11-30' };
const cases: [string, unknown, string][] = [
  ['โปรเงินสดสิ้นเดือน = ประโยคในไฟล์ราคาเป๊ะ', { ...base, ontop_pct: 10, final: 24192, promos: [cash] },
    `${name} ราคา 33600 ลด 20% เหลือ 26880 ชำระเป็นเงินสด ลด on top เพิ่ม 10% เหลือ 24192 ภายใน เดือนพฤศจิกายน 2569 และส่วนลดเพิ่มเติมตามโปรฯ ได้ที่ https://chawcher.com/category/promotion/`],
  ['ไม่มีโปร = ส่วนหัว + ลิงก์โปรฯ', { ...base, ontop_pct: 0, final: 26880, promos: [] },
    `${name} ราคา 33600 ลด 20% เหลือ 26880 และส่วนลดเพิ่มเติมตามโปรฯ ได้ที่ https://chawcher.com/category/promotion/`],
  ['ครบทุกประเภท + ลิงก์ของโปร', { ...base, ontop_pct: 10, final: 24192, promos: [cash,
      { kind: 'ขั้นบันได', name: 'x', percent: 12, min_total: 50000, detail: null, link: null, ends_on: '2026-11-30' },
      { kind: 'ส่งฟรี', name: 'x', percent: null, min_total: 30000, detail: 'กรุงเทพฯ', link: 'https://chawcher.com/free/', ends_on: null },
      { kind: 'ของแถม', name: 'x', percent: null, min_total: null, detail: 'หมอนอิง 2 ใบ', link: null, ends_on: '2026-11-15' }] },
    `${name} ราคา 33600 ลด 20% เหลือ 26880 ชำระเป็นเงินสด ลด on top เพิ่ม 10% เหลือ 24192 ภายใน เดือนพฤศจิกายน 2569 ซื้อครบ 50000 ลดเพิ่ม 12% ภายใน เดือนพฤศจิกายน 2569 ส่งฟรี เมื่อซื้อครบ 30000 (กรุงเทพฯ) แถม หมอนอิง 2 ใบ ภายใน 15 พฤศจิกายน 2569 และส่วนลดเพิ่มเติมตามโปรฯ ได้ที่ https://chawcher.com/free/`],
];
let bad = 0;
for (const [label, x, want] of cases) {
  const got = priceSentence(x as Parameters<typeof priceSentence>[0]);
  if (got === want) console.log('✓', label); else { bad++; console.log('✗', label, '\n  ได้ ', got, '\n  ต้อง', want); }
}
process.exit(bad ? 1 : 0);
