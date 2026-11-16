/**
 * รายการตายตัวของโมดูลคนสนใจ · ต้องตรงกับ enum ใน supabase/migrations/0053_leads.sql
 * ไฟล์นี้ไม่มีโค้ดฝั่งเซิร์ฟเวอร์ ใช้ได้ทั้งหน้าเว็บและ webhook
 */
export const TOPICS = ['ถามราคา', 'ขอโบรชัวร์', 'นัดโชว์รูม', 'หลังการขาย', 'งานโครงการ'] as const;
export const PRODUCTS = ['โซฟา', 'เตียง', 'เก้าอี้', 'ตู้และโต๊ะ', 'สั่งทำพิเศษ'] as const;
export const HEATS = ['ร้อน', 'อุ่น', 'เย็น'] as const;
/** ขั้นที่ยังเปิดอยู่ เรียงตามลำดับ · เป้าคือพาไปถึง "มาโชว์รูม" */
export const FLOW = ['ใหม่', 'ตอบแล้ว', 'เสนอราคาแล้ว', 'นัดแล้ว', 'มาโชว์รูม'] as const;
export const STAGES = [...FLOW, 'ซื้อ', 'หาย'] as const;
export const CHANNELS = ['LINE', 'Messenger', 'Instagram', 'โชว์รูม', 'โทรศัพท์'] as const;
export const SOURCES = ['LINE', 'Messenger', 'Instagram', 'โชว์รูม', 'โทรศัพท์', 'ลูกค้าเก่า/แนะนำ', 'อื่นๆ'] as const;
export const REASONS = ['ราคา', 'รอนาน', 'ยังไม่ถึงเวลา', 'เลือกเจ้าอื่น', 'ติดต่อไม่ได้'] as const;

/** ตัวเลือกของคำถามคัดกรอง "ต้องการใช้ช่วงไหน" · กดแล้วระบบเสนอความพร้อมให้ */
export const WHEN: { label: string; heat: Heat }[] = [
  { label: 'ภายใน 1 เดือน', heat: 'ร้อน' },
  { label: '1 ถึง 3 เดือน', heat: 'อุ่น' },
  { label: 'เกิน 3 เดือน', heat: 'เย็น' },
  { label: 'ยังไม่รู้', heat: 'เย็น' },
];

export type Topic = (typeof TOPICS)[number];
export type Product = (typeof PRODUCTS)[number];
export type Heat = (typeof HEATS)[number];
export type Stage = (typeof STAGES)[number];
export type Channel = (typeof CHANNELS)[number];
export type Source = (typeof SOURCES)[number];
export type Reason = (typeof REASONS)[number];

export const isOneOf = <T extends string>(list: readonly T[], v: unknown): v is T =>
  typeof v === 'string' && (list as readonly string[]).includes(v);

export const isOpen = (stage: Stage) => stage !== 'ซื้อ' && stage !== 'หาย';

/** แถวในตาราง leads.leads เท่าที่หน้าเว็บใช้ */
export type Lead = {
  id: string;
  channel: Channel;
  display_name: string;
  channel_user_id: string | null;
  last_message: string | null;
  last_message_at: string | null;
  awaiting_reply_since: string | null;
  last_contact_at: string;
  topic: Topic | null;
  topic_suggested: boolean;
  product: Product | null;
  product_suggested: boolean;
  readiness: Heat;
  readiness_suggested: boolean;
  stage: Stage;
  need_by: string | null;
  next_action_on: string | null;
  next_action_note: string | null;
  appointment_on: string | null;
  appointment_time: string | null;
  appointment_confirmed_at: string | null;
  followup_count: number;
  outcome_source: Source | null;
  lost_reason: Reason | null;
  counted: boolean;
  created_at: string;
};

export const LEAD_COLUMNS =
  'id,channel,display_name,channel_user_id,last_message,last_message_at,awaiting_reply_since,last_contact_at,' +
  'topic,topic_suggested,product,product_suggested,readiness,readiness_suggested,stage,need_by,' +
  'next_action_on,next_action_note,appointment_on,appointment_time,appointment_confirmed_at,' +
  'followup_count,outcome_source,lost_reason,counted,created_at';

export type TodayLead = Lead & { bucket: 'unanswered' | 'followup' | 'appointment'; waiting_minutes: number | null };

export type LeadEvent = { id: number; kind: string; note: string; created_at: string };

export type WeekSummary = {
  from: string;
  to: string;
  funnel: { new: number; replied: number; quoted: number; appointed: number; visited: number; bought: number; lost: number };
  channels: { channel: string; new: number; appointed: number; visited: number; bought: number }[];
  lost_reasons: { reason: string; n: number }[];
  first_reply: { n: number; avg_minutes: number | null; slow: number };
};
