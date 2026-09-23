/**
 * ชนิดข้อมูลและค่าคงที่ของโมดูลคอนเทนต์
 *
 * แยกออกมาจาก queries.ts เพราะ queries.ts เรียก createClient ฝั่งเซิร์ฟเวอร์
 * ซึ่งใช้ next/headers — พอ component ฝั่ง client เผลอ import ค่าคงที่จากที่นั่น
 * มันจะลาก next/headers ติดไปด้วยแล้ว build พัง ไฟล์นี้ไม่ import อะไรเลย
 * ทั้งสองฝั่งจึงใช้ร่วมกันได้
 */

export const STAGES = [
  'ไอเดีย', 'เขียนบท', 'ถ่ายแล้วรอตัด', 'ตัดเสร็จ',
  'รอตรวจ', 'ตีกลับแก้', 'พร้อมโพสต์', 'โพสต์แล้ว', 'พับไว้',
] as const;
export type Stage = (typeof STAGES)[number];

/** ขั้นที่คนทำงานเลื่อนเองได้ · ที่เหลือเลื่อนผ่านปุ่มส่งตรวจ/อนุมัติเท่านั้น */
export const WORK_STAGES: Stage[] = ['ไอเดีย', 'เขียนบท', 'ถ่ายแล้วรอตัด', 'ตัดเสร็จ'];

export const FORMATS = ['คลิปยาว', 'คลิปสั้น', 'หน้าเว็บ'] as const;
export type Format = (typeof FORMATS)[number];

export type Item = {
  id: string;
  title: string;
  format: Format;
  stage: Stage;
  brief: string | null;
  campaign_id: string | null;
  script_url: string | null;
  raw_url: string | null;
  edit_url: string | null;
  thumbnail_url: string | null;
  due_on: string | null;
  approved_at: string | null;
  review_note: string | null;
  updated_at: string;
};

export type Placement = {
  id: string;
  item_id: string;
  channel_id: string;
  planned_on: string | null;
  published_at: string | null;
  published_url: string | null;
  channels: { name_th: string } | null;
};

export type TodayItem = {
  หมวด: string;
  เรื่อง: string;
  รูปแบบ: string;
  ขั้น: string;
  กำหนด: string | null;
  ref_id: string;
};

export type Gap = {
  item_id: string;
  เรื่อง: string;
  รูปแบบ: string;
  ขั้น: string;
  ตั้งใจลงกี่ที่: number;
  ลงแล้ว: number;
  ยังไม่ได้ลง: number;
  ที่ยังขาด: string | null;
};
