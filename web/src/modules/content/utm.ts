/**
 * ป้าย UTM บนลิงก์ไปเว็บ chawcher.com (S-04)
 * GA4 จับได้ว่าคนที่เข้าเว็บมาจากโพสต์ไหน → conversion rate ต่อโพสต์ (R10)
 *
 * - ใส่เฉพาะลิงก์ที่ชี้ไป chawcher.com · ลิงก์อื่น (Line · IG) ไม่แตะ
 * - ลิงก์ที่มี utm_source อยู่แล้วไม่ทับ (คนตั้งเองได้)
 * - บทความบนเว็บเองไม่ใส่ · ลิงก์ภายในเว็บติด UTM ทำให้ GA4 ตัด session ใหม่ ยอดเพี้ยน
 */

const SOURCE: Record<string, { source: string; medium: string }> = {
  facebook: { source: 'facebook', medium: 'social' },
  instagram: { source: 'instagram', medium: 'social' },
  line_oa: { source: 'line', medium: 'line' },
};

const SITE = /https?:\/\/(?:www\.)?chawcher\.com(?:\/[^\s<>"'()[\]{}]*)?/gi;

export type UtmTag = { campaign: string; content: string };

/** ชื่อแคมเปญเป็นตัวพิมพ์เล็ก ช่องว่างเป็นขีด · ภาษาไทยคงไว้ (GA4 แสดงได้) */
export function utmCampaign(name: string | null | undefined): string {
  const s = (name ?? '').trim().toLowerCase().replace(/\s+/g, '-').replace(/[^\p{L}\p{M}\p{N}_-]/gu, '');
  return s || 'content';
}

/** รหัสการ์ด 8 ตัวแรก · ใช้จับคู่ยอดกลับมาที่การ์ด */
export const utmContent = (itemId: string) => 'c-' + itemId.replace(/-/g, '').slice(0, 8);

export function withUtm(text: string | null, channelId: string, tag: UtmTag): string | null {
  const ch = SOURCE[channelId];
  if (!text || !ch) return text;
  return text.replace(SITE, (raw) => {
    // วรรคตอนท้ายประโยคไม่ใช่ส่วนของลิงก์
    const tail = raw.match(/[.,!?;:]+$/)?.[0] ?? '';
    const link = tail ? raw.slice(0, -tail.length) : raw;
    let u: URL;
    try { u = new URL(link); } catch { return raw; }
    if (u.searchParams.has('utm_source')) return raw;
    u.searchParams.set('utm_source', ch.source);
    u.searchParams.set('utm_medium', ch.medium);
    u.searchParams.set('utm_campaign', tag.campaign);
    u.searchParams.set('utm_content', tag.content);
    return decodeURI(u.toString()) + tail;
  });
}
