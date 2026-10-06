import type { createClient } from '@/lib/supabase/server';
import { wpConfigured, wpGetPost } from './wordpress';

type Supa = Awaited<ReturnType<typeof createClient>>;
type Pending = { id: string; wp_post_id: number | null; published_url: string | null; wp_checked_at: string | null };

/** เช็กไม่ถี่กว่านี้ต่อบทความ (W-07) */
const EVERY_MS = 10 * 60 * 1000;
const now = () => Date.now();

/**
 * Draft ที่ส่งไปแล้ว ถูก Publish หรือยัง (W-07)
 * เรียกตอนเปิดหน้าการ์ดหรือหน้าแรก · ไม่ต้องมี cron · เช็กไม่ถี่เกิน 10 นาทีต่อบทความ
 * คืนจำนวนที่เพิ่ง Publish (หน้าจะได้รู้ว่าต้องโหลดข้อมูลใหม่)
 */
export async function syncWpPublished(supabase: Supa, rows: Pending[], force = false): Promise<number> {
  if (!wpConfigured()) return 0;
  const due = rows.filter((r) => r.wp_post_id && !r.published_url
    && (force || !r.wp_checked_at || now() - new Date(r.wp_checked_at).getTime() > EVERY_MS)).slice(0, 10);
  if (due.length === 0) return 0;

  let published = 0;
  const stillDraft: string[] = [];
  await Promise.all(due.map(async (r) => {
    const res = await wpGetPost(r.wp_post_id!);
    if (res.ok && res.data?.status === 'publish') {
      const { error } = await supabase.schema('content').rpc('record_wp_published', { p_placement_id: r.id, p_url: res.data.link });
      if (!error) published++;
      else console.error('record_wp_published', error);
    } else {
      stillDraft.push(r.id);
    }
  }));
  if (stillDraft.length) await supabase.schema('content').rpc('touch_wp_check', { p_placement_ids: stillDraft });
  return published;
}
