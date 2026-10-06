'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { markdownToHtml } from './markdown';
import { syncWpPublished } from './wp-sync';
import {
  wpCategories, wpGetPost, wpHealth, wpSaveDraft, wpUploadImage, wpMediaUrl, wpConfigured,
  type WpHealth,
} from './wordpress';

export type WpResult = { ok: true; message: string } | { ok: false; error: string };

function refresh(itemId: string) {
  revalidatePath('/content', 'layout');
  revalidatePath(`/content/${itemId}`);
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

/**
 * ส่งบทความเข้า WordPress เป็น Draft (W-01–08)
 * มีเลขโพสต์แล้ว = อัปเดตตัวเดิม · Publish ไปแล้ว = ไม่ทับ
 */
export async function sendToWordpress(
  placementId: string,
  itemId: string,
  opts: { category: string | null; slug: string | null },
): Promise<WpResult> {
  if (!wpConfigured()) return { ok: false, error: 'ยังไม่ได้ต่อ WordPress · ใส่ WP_USER และ WP_APP_PASSWORD ใน Vercel' };
  const supabase = await createClient();
  const db = supabase.schema('content');

  const { data: p } = await db.from('placements')
    .select('id,item_id,channel_id,copy_text,web_title,web_keyword,web_meta,web_category,web_slug,passed_at,published_url,wp_post_id,wp_media_ids')
    .eq('id', placementId).maybeSingle();
  if (!p || p.item_id !== itemId) return { ok: false, error: 'ไม่พบบทความ' };
  if (p.channel_id !== 'website') return { ok: false, error: 'ส่งเข้า WordPress ได้เฉพาะช่องเว็บไซต์' };
  if (p.published_url) return { ok: false, error: 'บทความนี้ขึ้นเว็บแล้ว · แก้ใน wp-admin แทน ระบบไม่ทับ' };
  if (!p.passed_at) return { ok: false, error: 'บทความยังไม่ผ่านตรวจ · ส่งตรวจให้ผ่านก่อน' };
  if (!p.web_title?.trim() || !p.copy_text?.trim()) return { ok: false, error: 'ยังไม่มีหัวเรื่องหรือเนื้อบทความ' };

  const { data: item } = await db.from('items').select('hook,title').eq('id', itemId).maybeSingle();
  const { data: images } = await db.from('item_images').select('url,passed_at')
    .eq('item_id', itemId).is('removed_at', null).order('position');
  if ((images ?? []).some((m) => !m.passed_at)) return { ok: false, error: 'ภาพยังไม่ผ่านตรวจครบ' };

  // หมวด/slug ที่คนเลือก (แก้ได้ ไม่ทำให้ผลตรวจหาย)
  const category = opts.category?.trim() || p.web_category || null;
  const slug = (opts.slug ?? p.web_slug ?? '').trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || null;
  if (category !== p.web_category || slug !== p.web_slug) {
    const { error } = await db.from('placements').update({ web_category: category, web_slug: slug }).eq('id', placementId);
    if (error) return { ok: false, error: error.message };
  }

  // โพสต์เดิมยังอยู่ไหม · Publish ไปแล้วหรือยัง
  let postId: number | null = p.wp_post_id;
  let mediaIds: number[] = (p.wp_media_ids ?? []).map(Number);
  if (postId) {
    const cur = await wpGetPost(postId);
    if (!cur.ok) return { ok: false, error: cur.error };
    if (!cur.data) { postId = null; mediaIds = []; }
    else if (cur.data.status === 'publish') {
      await db.rpc('record_wp_published', { p_placement_id: placementId, p_url: cur.data.link });
      refresh(itemId);
      return { ok: false, error: 'บทความนี้ Publish ในเว็บไปแล้ว · ระบบใส่ลิงก์ให้แล้ว และไม่ส่งทับ' };
    } else if (cur.data.status === 'future') {
      return { ok: false, error: 'บทความนี้ตั้งเวลา Publish ใน wp-admin แล้ว · แก้ในเว็บแทน' };
    }
  }

  const notes: string[] = [];

  // ภาพ: อัปครั้งแรกครั้งเดียว · ตัวแรก = ภาพปก (W-03)
  const alt = (item?.hook || item?.title || p.web_title).trim();
  const srcs: string[] = [];
  if (mediaIds.length === 0 && (images ?? []).length > 0) {
    for (const [i, m] of (images ?? []).entries()) {
      const up = await wpUploadImage(m.url, images!.length > 1 ? `${alt} ภาพ ${i + 1}` : alt, `${slug || 'chawcher'}-${i + 1}`);
      if (up.ok) { mediaIds.push(up.data.id); srcs.push(up.data.src); }
      else notes.push(`ภาพ ${i + 1}: ${up.error}`);
    }
  } else {
    for (const id of mediaIds) {
      const src = await wpMediaUrl(id);
      if (src) srcs.push(src);
    }
  }
  if ((images ?? []).length === 0) notes.push('ไม่มีภาพในการ์ด · ใส่ภาพปกเองใน wp-admin');
  else if (mediaIds.length === 0) notes.push('ใส่ภาพปกเองใน wp-admin');

  // ภาพที่ 2 เป็นต้นไปต่อท้ายบทความ · คนย้ายตำแหน่งใน wp-admin ได้
  const extra = srcs.slice(1).map((src, i) => `<figure class="wp-block-image"><img src="${esc(src)}" alt="${esc(`${alt} ภาพ ${i + 2}`)}" /></figure>`);
  const html = [markdownToHtml(p.copy_text), ...extra].join('\n');

  const cats = category ? await wpCategories() : [];
  const cat = cats.find((c) => c.name.toLowerCase() === category?.toLowerCase());
  if (category && !cat) notes.push(`ไม่พบหมวด "${category}" บนเว็บ · เลือกหมวดเองใน wp-admin`);

  const saved = await wpSaveDraft(postId, {
    title: p.web_title.trim(),
    html,
    excerpt: p.web_meta?.trim() ?? '',
    slug,
    categoryId: cat?.id ?? null,
    featuredId: mediaIds[0] ?? null,
    metaDesc: p.web_meta?.trim() || null,
    keyword: p.web_keyword?.trim() || null,
  });
  if (!saved.ok) return { ok: false, error: saved.error };
  if (!saved.data.yoast) notes.push('ช่อง Yoast ยังไม่เปิดให้ระบบเขียน · คัดลอก meta description กับคำค้นหลักไปใส่ในกล่อง Yoast เอง');

  const { error } = await db.rpc('record_wp_send', {
    p_placement_id: placementId,
    p_post_id: saved.data.id,
    p_media_ids: mediaIds,
    p_note: notes.join('\n'),
  });
  if (error) return { ok: false, error: `ส่งเข้า WordPress แล้ว (โพสต์ #${saved.data.id}) แต่บันทึกในระบบไม่ได้: ${error.message}` };

  refresh(itemId);
  return { ok: true, message: postId ? 'อัปเดต Draft เดิมใน WordPress แล้ว' : 'ส่งเข้า WordPress เป็น Draft แล้ว' };
}

/** ปุ่ม "เช็กตอนนี้" · Publish แล้วหรือยัง */
export async function checkWordpress(placementId: string, itemId: string): Promise<WpResult> {
  const supabase = await createClient();
  const { data: p } = await supabase.schema('content').from('placements')
    .select('id,wp_post_id,published_url,wp_checked_at').eq('id', placementId).maybeSingle();
  if (!p?.wp_post_id) return { ok: false, error: 'บทความนี้ยังไม่ได้ส่งเข้า WordPress' };
  const cur = await wpGetPost(p.wp_post_id);
  if (!cur.ok) return { ok: false, error: cur.error };
  if (!cur.data) return { ok: false, error: 'ไม่พบ Draft ใน WordPress แล้ว (ถูกลบ) · กดส่งใหม่ได้' };
  const n = await syncWpPublished(supabase, [p], true);
  refresh(itemId);
  return { ok: true, message: n ? 'ขึ้นเว็บแล้ว · ใส่ลิงก์ให้แล้ว' : `ยังเป็น ${cur.data.status === 'draft' ? 'Draft' : cur.data.status} · รอคนกด Publish ใน wp-admin` };
}

/** ปุ่ม "ทดสอบ" ในหน้าเชื่อมต่อ (X-02) */
export async function testWordpress(): Promise<WpHealth> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'ต้องเข้าสู่ระบบก่อน' };
  return wpHealth();
}
