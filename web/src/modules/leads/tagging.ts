/**
 * เสนอป้าย เรื่อง + สินค้า จากข้อความของลูกค้า · กฎคำสำคัญล้วน ไม่เรียก AI (ไม่มีค่าใช้จ่าย)
 *
 * ผลที่ได้เป็น "ระบบเสนอ" เสมอ · คนต้องยืนยันหรือแก้ (LD-20) · จับไม่ได้ = คืน null ไม่เดา (LD-25)
 * ลำดับในรายการ = ลำดับความสำคัญ · กฎแรกที่เจอชนะ
 *   cd web && node --experimental-strip-types scripts/leads.test.mts
 */
import type { Product, Topic } from './constants';

const TOPIC_RULES: [Topic, RegExp][] = [
  ['หลังการขาย', /ซ่อม|เคลม|ประกัน|ชำรุด|เสียหาย|ของที่สั่ง|ออเดอร์|ส่งของ|จัดส่งวันไหน|ได้ของ|เปลี่ยนผ้า|ซักผ้า/],
  ['งานโครงการ', /โครงการ|ร้านกาแฟ|ร้านอาหาร|โรงแรม|รีสอร์ท|คาเฟ่|ออฟฟิศ|สำนักงาน|คลินิก|คอนโดทั้ง|จำนวนมาก|หลายตัว|\d{2,}\s*(ตัว|ชุด|ห้อง)/],
  ['นัดโชว์รูม', /โชว?์?รูม|showroom|หน้าร้าน|ดูของจริง|ดูตัวจริง|ลองนั่ง|เข้าไปดู|แวะไป|นัด|เปิดกี่โมง|อยู่ที่ไหน|แผนที่|location/i],
  ['ขอโบรชัวร์', /โบรชัวร์|โบชัวร์|brochure|แคตตาล็อก|แคตตาลอก|catalog|ขอดูแบบ|ขอแบบ|มีแบบไหน|ขอรูป/i],
  ['ถามราคา', /ราคา|เท่าไหร่|เท่าไร|กี่บาท|ส่วนลด|โปร|ผ่อน|งบ|price/i],
];

const PRODUCT_RULES: [Product, RegExp][] = [
  ['สั่งทำพิเศษ', /สั่งทำ|ขนาดพิเศษ|ทำตามแบบ|ทำตามขนาด|custom|built.?in|บิ้?วท์?อิน/i],
  ['โซฟา', /โซฟา|sofa|อาร์มแชร์|armchair|เดย์เบด|daybed/i],
  ['เตียง', /เตียง|หัวเตียง|ที่นอน|bed/i],
  ['เก้าอี้', /เก้าอี้|สตูล|stool|chair|ม้านั่ง/i],
  ['ตู้และโต๊ะ', /ตู้|โต๊ะ|ชั้นวาง|table|cabinet|ไซด์บอร์ด/i],
];

export function suggestTags(text: string | null | undefined): { topic: Topic | null; product: Product | null } {
  const t = (text ?? '').normalize('NFC');
  if (!t.trim()) return { topic: null, product: null };
  return {
    topic: TOPIC_RULES.find(([, re]) => re.test(t))?.[0] ?? null,
    product: PRODUCT_RULES.find(([, re]) => re.test(t))?.[0] ?? null,
  };
}
