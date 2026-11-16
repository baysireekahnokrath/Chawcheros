import { createClient } from '@/lib/supabase/server';
import {
  CHANNELS, HEATS, LEAD_COLUMNS, STAGES, isOneOf, isOpen,
  type Lead, type LeadEvent, type TodayLead, type WeekSummary,
} from './constants';

/** วันนี้ตามเวลาไทย เป็น YYYY-MM-DD */
export function bangkokToday(): string {
  return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
}

/** ผ่านมากี่วันเต็มนับจากเวลานั้น */
export function daysSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));
}

export function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** วันเสาร์ที่เริ่มสัปดาห์ของวันนั้น (สรุปนับเสาร์ถึงศุกร์) */
export function weekStart(iso: string): string {
  const dow = new Date(iso + 'T00:00:00Z').getUTCDay(); // 0 = อาทิตย์ … 6 = เสาร์
  return addDays(iso, -((dow + 1) % 7));
}

export type LoadResult<T> = { data: T; error: string | null };

/** งานวันนี้ 3 รายการ · คำนวณสดในฐานข้อมูล (leads.v_today) */
export async function getToday(): Promise<LoadResult<TodayLead[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema('leads')
    .from('v_today')
    .select(`bucket,waiting_minutes,${LEAD_COLUMNS}`)
    .order('awaiting_reply_since', { ascending: true, nullsFirst: false })
    .limit(300);
  return { data: (data ?? []) as unknown as TodayLead[], error: error?.message ?? null };
}

export type ListFilter = { stage?: string; heat?: string; channel?: string };

/** รายการทั้งหมด · แถวที่ยังเปิดอยู่ขึ้นก่อน คนที่เงียบนานสุดอยู่บน */
export async function getLeads(f: ListFilter): Promise<LoadResult<{ rows: Lead[]; all: Lead[] }>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema('leads')
    .from('leads')
    .select(LEAD_COLUMNS)
    .order('last_contact_at', { ascending: true })
    .limit(1000);
  const all = (data ?? []) as unknown as Lead[];
  const rows = all
    .filter(
      (l) =>
        (!isOneOf(STAGES, f.stage) || l.stage === f.stage) &&
        (!isOneOf(HEATS, f.heat) || l.readiness === f.heat) &&
        (!isOneOf(CHANNELS, f.channel) || l.channel === f.channel),
    )
    .sort((a, b) => Number(isOpen(b.stage)) - Number(isOpen(a.stage)));
  return { data: { rows, all }, error: error?.message ?? null };
}

export async function getLead(id: string): Promise<{ lead: Lead; events: LeadEvent[] } | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data: lead } = await supabase.schema('leads').from('leads').select(LEAD_COLUMNS).eq('id', id).maybeSingle();
  if (!lead) return null;
  const { data: events } = await supabase
    .schema('leads')
    .from('lead_events')
    .select('id,kind,note,created_at')
    .eq('lead_id', id)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(100);
  return { lead: lead as unknown as Lead, events: (events ?? []) as LeadEvent[] };
}

/** สรุป 7 วันนับจาก from · คำนวณสดในฐานข้อมูล (leads.week_summary) */
export async function getWeek(from: string): Promise<LoadResult<WeekSummary | null>> {
  const supabase = await createClient();
  const { data, error } = await supabase.schema('leads').rpc('week_summary', { p_from: from });
  return { data: (data ?? null) as WeekSummary | null, error: error?.message ?? null };
}
