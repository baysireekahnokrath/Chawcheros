/**
 * โมดูลคนสนใจ · กฎเสนอป้าย · ร่างข้อความ · ตัวคัดเหตุการณ์จาก LINE @chawcher
 *   cd web && node --experimental-strip-types scripts/leads.test.mts
 * ชื่อและข้อความทั้งหมดเป็นของสมมติ
 */
// @ts-expect-error -- node --experimental-strip-types ต้องการนามสกุล .ts
import { suggestTags } from '../src/modules/leads/tagging.ts';
// @ts-expect-error -- เหมือนบรรทัดบน
import { draftKindFor, draftText, thaiDate } from '../src/modules/leads/drafts.ts';

let fail = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail += 1;
  console.log(`${ok ? 'ผ่าน' : 'พัง '} ${name}${ok ? '' : `\n      ได้  ${JSON.stringify(got)}\n      ต้อง ${JSON.stringify(want)}`}`);
};

// --- เสนอป้าย ---
const tagCases: [string, string | null, string | null][] = [
  ['โซฟาตัวแอล 3 ที่นั่ง ราคาเท่าไหร่คะ', 'ถามราคา', 'โซฟา'],
  ['ขอ Brochure', 'ขอโบรชัวร์', null],
  ['มีเตียง 6 ฟุตไหมคะ ขอดูแบบหน่อย', 'ขอโบรชัวร์', 'เตียง'],
  ['พรุ่งนี้เข้าไปดูที่โชว์รูมได้ไหมคะ', 'นัดโชว์รูม', null],
  ['เก้าอี้สำหรับร้านกาแฟ ประมาณ 20 ตัวค่ะ', 'งานโครงการ', 'เก้าอี้'],
  ['สั่งทำขนาดพิเศษได้ไหมครับ', null, 'สั่งทำพิเศษ'],
  ['โซฟาที่ซื้อไป ผ้าขาด เคลมได้ไหม', 'หลังการขาย', 'โซฟา'],
  ['โต๊ะกินข้าว 6 ที่นั่ง มีส่วนลดไหม', 'ถามราคา', 'ตู้และโต๊ะ'],
  ['สวัสดีค่ะ', null, null],
  ['', null, null],
];
for (const [text, topic, product] of tagCases) eq(`ป้าย: ${text || '(ว่าง)'}`, suggestTags(text), { topic, product });

// --- ร่างข้อความ ---
const base = { display_name: 'คุณ ทดสอบ', product: 'โซฟา', topic: 'ถามราคา', stage: 'ใหม่', appointment_on: null, appointment_time: null };
eq('วันที่ไทย', thaiDate('2026-11-17'), 'วันอังคารที่ 17 พ.ย.');
eq('ร่างตามขั้น ใหม่', draftKindFor(base), 'first');
eq('ร่างตามขั้น ตอบแล้ว+โบรชัวร์', draftKindFor({ stage: 'ตอบแล้ว', topic: 'ขอโบรชัวร์' }), 'brochure');
eq('ร่างตามขั้น เสนอราคาแล้ว', draftKindFor({ stage: 'เสนอราคาแล้ว', topic: 'ถามราคา' }), 'invite');
eq('ร่างตามขั้น นัดแล้ว', draftKindFor({ stage: 'นัดแล้ว', topic: null }), 'confirm');
eq('คำตอบแรกมีคำถามคัดกรอง', draftText(base, 'first'),
  'สวัสดีครับ คุณ ทดสอบ ขอบคุณที่สนใจ CHAW CHER ครับ เดี๋ยวผมส่งรายละเอียดให้นะครับ ขอถามนิดเดียวครับ ต้องการใช้ช่วงไหนครับ');
eq('ยืนยันนัดเติมวันและเวลา', draftText({ ...base, appointment_on: '2026-11-17', appointment_time: '14:00:00' }, 'confirm'),
  'สวัสดีครับ คุณ ทดสอบ ยืนยันนัดชมโชว์รูม CHAW CHER วันอังคารที่ 17 พ.ย. เวลา 14:00 น. นะครับ ถ้าต้องการเปลี่ยนเวลา แจ้งผมได้เลยครับ แล้วพบกันครับ');
eq('ชวนมาโชว์รูมมีลิงก์หน้านัด', draftText(base, 'invite').endsWith('ดูรายละเอียดการนัดได้ที่ https://chawcher.com/showroom-visit/'), true);
eq('ชวนมาโชว์รูม ไม่รู้สินค้า', draftText({ ...base, product: null }, 'invite').includes('สินค้าที่สอบถามไว้'), true);
for (const k of ['first', 'brochure', 'invite', 'confirm'] as const) {
  eq(`ร่าง ${k} ไม่มีราคา/โปร/ตัวเลขเงิน`, /ราคา|ลด|โปร|บาท|ฟรี/.test(draftText(base, k)), false);
}

if (fail) {
  console.error(`\nพัง ${fail} ข้อ`);
  process.exit(1);
}
console.log('\nผ่านทุกข้อ');
