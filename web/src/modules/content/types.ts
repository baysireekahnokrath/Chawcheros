/**
 * ชนิดข้อมูลและค่าคงที่ของโมดูลคอนเทนต์
 *
 * แยกออกมาจาก queries.ts เพราะ queries.ts เรียก createClient ฝั่งเซิร์ฟเวอร์
 * ซึ่งใช้ next/headers — พอ component ฝั่ง client เผลอ import ค่าคงที่จากที่นั่น
 * มันจะลาก next/headers ติดไปด้วยแล้ว build พัง ไฟล์นี้ไม่ import อะไรเลย
 * ทั้งสองฝั่งจึงใช้ร่วมกันได้
 */

export const STAGES = [
  'ไอเดีย', 'กำลังทำ', 'เขียนบท', 'ถ่ายแล้วรอตัด', 'ตัดเสร็จ',
  'รอตรวจ', 'ตีกลับแก้', 'พร้อมโพสต์', 'โพสต์แล้ว', 'พับไว้',
] as const;
export type Stage = (typeof STAGES)[number];

/** ขั้นที่คนทำงานเลื่อนเองได้ (งานคลิปเดิม) · ที่เหลือเลื่อนผ่านปุ่มส่งตรวจ/อนุมัติเท่านั้น */
export const WORK_STAGES: Stage[] = ['ไอเดีย', 'เขียนบท', 'ถ่ายแล้วรอตัด', 'ตัดเสร็จ'];

/** ขั้นที่คนทำงานเลื่อนเองได้ของงานเฟส 1 · ผลิตไม่ได้แบ่ง 3 ขั้นแบบวิดีโอแล้ว (requirement Q1) */
export const PHASE1_WORK_STAGES: Stage[] = ['ไอเดีย', 'กำลังทำ'];

export const FORMATS = ['คลิปยาว', 'คลิปสั้น', 'หน้าเว็บ', 'ข้อความล้วน', 'ภาพเดี่ยว', 'อัลบั้มภาพ'] as const;
export type Format = (typeof FORMATS)[number];

/** เฟส 1 ทำแค่นี้ (decisions-log N1) · คลิปซ่อนไว้จนถึงเฟสวิดีโอ */
export const PHASE1_FORMATS = ['ข้อความล้วน', 'ภาพเดี่ยว', 'อัลบั้มภาพ'] as const satisfies readonly Format[];
export const isPhase1 = (f: string) => (PHASE1_FORMATS as readonly string[]).includes(f);

/** เฟส 1 ลงแค่ 3 ช่องทาง (decisions-log N2) · ตัวย่อใช้บนการ์ด (K3) */
export const PHASE1_CHANNELS = [
  { id: 'facebook', short: 'FB', name: 'Facebook' },
  { id: 'instagram', short: 'IG', name: 'Instagram' },
  { id: 'website', short: 'WEB', name: 'บล็อก SEO' },
] as const;
export const channelShort = (id: string) => PHASE1_CHANNELS.find((c) => c.id === id)?.short ?? id;
export const channelName = (id: string) => PHASE1_CHANNELS.find((c) => c.id === id)?.name ?? id;

/** ความยาวที่แต่ละช่องทางรับ · เตือนเมื่อเกิน (Q-34) */
export const LIMITS = { facebook: 63206, instagram: 2200, web_title: 60, web_meta: 155 } as const;

/** Instagram รับอัลบั้มสูงสุด 20 ภาพ · ฐานข้อมูลบังคับซ้ำอีกชั้น */
export const MAX_ALBUM = 20;

export const TONE: Record<string, string> = {
  ไอเดีย: 'bg-border text-muted',
  กำลังทำ: 'bg-warn/10 text-warn',
  เขียนบท: 'bg-accent/10 text-accent',
  ถ่ายแล้วรอตัด: 'bg-warn/10 text-warn',
  ตัดเสร็จ: 'bg-accent/10 text-accent',
  รอตรวจ: 'bg-locked/10 text-locked',
  ตีกลับแก้: 'bg-danger/10 text-danger',
  พร้อมโพสต์: 'bg-ok/10 text-ok',
  โพสต์แล้ว: 'bg-ok/10 text-ok',
  พับไว้: 'bg-border text-muted',
};

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
  brand_id: string | null;
  hook: string | null;
  key_message: string | null;
  visual: string | null;
  pillar_id: string | null;
  theme_id: string | null;
  owner_id: string | null;
  off_plan: boolean;
  source_url: string | null;
  created_by: string | null;
  version: number;
};

export type Placement = {
  id: string;
  item_id: string;
  channel_id: string;
  planned_on: string | null;
  published_at: string | null;
  published_url: string | null;
  hook: string | null;
  copy_text: string | null;
  first_comment: string | null;
  web_title: string | null;
  web_keyword: string | null;
  web_meta: string | null;
  human_edited: boolean;
  skipped_reason: string | null;
  passed_at: string | null;
  channels: { name_th: string } | null;
};

export type ItemImage = { id: string; position: number; url: string; passed_at: string | null };

/** ส่วนที่ต้องแก้ · 1 แถว = 1 ส่วนที่ไม่ผ่าน (Q-42) */
export type ReviewNote = {
  id: string; version: number; part_key: string; part_label: string; note: string;
  done_at: string | null; created_at: string;
};

export type Message = {
  id: string; author_id: string | null; kind: 'คน' | 'ระบบ' | 'AI';
  part_label: string | null; body: string; mentions: string[]; created_at: string;
};

export type Version = { version: number; submitted_at: string; snapshot: { images?: string[] } };

/** ส่วนที่ยังต้องตรวจ · part_key = ch:<ช่องทาง> หรือ img:<id ภาพ> */
export type OpenPart = { part_key: string; part_label: string };

export type Brand = { id: string; name: string };
export type Pillar = { id: string; brand_id: string; name: string; color: string; sort_order: number; active: boolean };
export type Theme = { id: string; brand_id: string; name: string; goal: string | null; starts_on: string; ends_on: string; active: boolean };
export type Model = { id: string; brand_id: string; collection: string; name_th: string | null };
export type Person = { id: string; full_name: string };

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
