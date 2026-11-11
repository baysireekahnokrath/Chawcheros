/**
 * คุยกับ chawcher.com (WordPress REST API) · ฝั่งเซิร์ฟเวอร์เท่านั้น
 *
 * ใช้ Application Password ของผู้ใช้ WordPress 1 คน (Bay สร้างที่หน้าโปรไฟล์ WordPress)
 * env: WP_USER · WP_APP_PASSWORD · WP_SITE_URL (ไม่ใส่ = https://chawcher.com)
 *
 * ทำได้แค่ 3 อย่าง: อัปโหลดรูป · สร้าง/แก้โพสต์ "ร่าง" · เปลี่ยนเป็น publish (เรียกจากปุ่มที่ Bay กดเท่านั้น)
 * ไม่แตะสินค้า ราคา สต็อก (B2.5 · ระบบเราเป็นเจ้าของความจริง)
 */
export type NewsImage = { url: string; preview?: string | null; wp_id?: number | null; alt?: string | null };

/** หมวดในเว็บตอนนี้: Design 149 · Lifestyle 150 · Promotion 152 · ข่าวใช้ Lifestyle ไปก่อน (docs/modules/news/0-idea.md) */
const CATEGORY_ID = Number(process.env.WP_NEWS_CATEGORY_ID ?? 150);

export function wpConfig() {
  const user = process.env.WP_USER?.trim();
  const pass = process.env.WP_APP_PASSWORD?.trim().replace(/^["']|["']$/g, '');
  const site = (process.env.WP_SITE_URL?.trim() || 'https://chawcher.com').replace(/\/+$/, '');
  return user && pass ? { site, auth: 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64') } : null;
}

const NO_CONFIG = 'ยังไม่ได้ใส่ WP_USER / WP_APP_PASSWORD ใน Vercel (ดู docs/bay-action-list.md)';

async function wp<T>(path: string, init: RequestInit = {}): Promise<T> {
  const c = wpConfig();
  if (!c) throw new Error(NO_CONFIG);
  const res = await fetch(`${c.site}/wp-json/wp/v2${path}`, {
    ...init,
    headers: { Authorization: c.auth, ...(init.headers ?? {}) },
    cache: 'no-store',
  });
  if (!res.ok) {
    const body = (await res.text()).slice(0, 300);
    if (res.status === 401 || res.status === 403) throw new Error(`WordPress ไม่ยอมรับรหัส (${res.status}) · ตรวจ WP_USER / WP_APP_PASSWORD`);
    throw new Error(`WordPress ตอบ ${res.status}: ${body}`);
  }
  return (await res.json()) as T;
}

type Media = { id: number; source_url: string; media_details?: { sizes?: Record<string, { source_url: string }> } };

const slugify = (s: string) =>
  s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'news';

/** อัปโหลดรูปเข้าคลังสื่อ · คืน url เต็ม + url ขนาดกลาง (LINE ใช้เป็นภาพตัวอย่าง ต้องไม่เกิน 1MB) */
export async function uploadMedia(data: Buffer | ArrayBuffer, type: string, name: string, alt: string): Promise<NewsImage> {
  const ext = type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : 'jpg';
  const filename = `${slugify(name)}-${Date.now().toString(36)}.${ext}`;
  const m = await wp<Media>('/media', {
    method: 'POST',
    headers: { 'Content-Type': type, 'Content-Disposition': `attachment; filename="${filename}"` },
    body: new Uint8Array(data instanceof ArrayBuffer ? data : data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer),
  });
  if (alt) await wp(`/media/${m.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ alt_text: alt }) }).catch(() => null);
  const sizes = m.media_details?.sizes ?? {};
  const preview = (sizes.medium_large ?? sizes.large ?? sizes.medium)?.source_url ?? m.source_url;
  return { url: m.source_url, preview, wp_id: m.id, alt };
}

/** รูปที่อยู่นอก chawcher.com → ดึงมาเก็บในคลังสื่อก่อน (โพสต์ไม่ลิงก์รูปจากเว็บคนอื่น) */
export async function ensureOnSite(img: NewsImage, name: string): Promise<NewsImage> {
  if (img.wp_id) return img;
  const res = await fetch(img.url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`ดึงรูปไม่ได้ (${res.status}): ${img.url}`);
  const type = res.headers.get('content-type') ?? 'image/jpeg';
  if (!type.startsWith('image/')) throw new Error(`ลิงก์นี้ไม่ใช่รูป: ${img.url}`);
  return uploadMedia(await res.arrayBuffer(), type, name, img.alt ?? '');
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** ข้อความ (ย่อหน้าคั่นด้วยบรรทัดว่าง) + รูป → Gutenberg blocks · รูปแรกเป็นรูปปก · รูปถัดไปแทรกหลังย่อหน้าทีละรูป */
export function toBlocks(body: string, images: NewsImage[]) {
  const paras = body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const extra = images.slice(1);
  const img = (i: NewsImage) => {
    const src = i.preview || i.url;
    const idAttr = i.wp_id ? `{"id":${i.wp_id},"sizeSlug":"large","linkDestination":"none"}` : '{"sizeSlug":"large","linkDestination":"none"}';
    return `<!-- wp:image ${idAttr} -->\n<figure class="wp-block-image size-large"><img src="${esc(src)}" alt="${esc(i.alt ?? '')}"${i.wp_id ? ` class="wp-image-${i.wp_id}"` : ''}/></figure>\n<!-- /wp:image -->`;
  };
  const out: string[] = [];
  paras.forEach((p, i) => {
    out.push(`<!-- wp:paragraph -->\n<p>${esc(p).replace(/\n/g, '<br>')}</p>\n<!-- /wp:paragraph -->`);
    if (extra[i]) out.push(img(extra[i]));
  });
  extra.slice(paras.length).forEach((e) => out.push(img(e)));
  return out.join('\n\n');
}

type Post = { id: number; link: string; status: string };

/** สร้างหรือแก้ "ร่าง" · ถ้าโพสต์ขึ้นเว็บแล้ว แก้เนื้อหาแต่ไม่เปลี่ยนสถานะ */
export async function saveDraft(p: { wpId: number | null; title: string; body: string; images: NewsImage[]; excerpt: string }) {
  const payload: Record<string, unknown> = {
    title: p.title,
    content: toBlocks(p.body, p.images),
    excerpt: p.excerpt,
    categories: [CATEGORY_ID],
    featured_media: p.images[0]?.wp_id ?? 0,
  };
  if (!p.wpId) payload.status = 'draft';
  const post = await wp<Post>(p.wpId ? `/posts/${p.wpId}` : '/posts', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
  return { id: post.id, status: post.status };
}

export async function publishPost(wpId: number) {
  const post = await wp<Post>(`/posts/${wpId}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'publish' }),
  });
  if (post.status !== 'publish') throw new Error(`WordPress ยังไม่ publish (สถานะ ${post.status})`);
  return post.link;
}

export const wpSite = () => (process.env.WP_SITE_URL?.trim() || 'https://chawcher.com').replace(/\/+$/, '');
export const previewUrl = (wpId: number) => `${wpSite()}/?p=${wpId}&preview=true`;
export const editUrl = (wpId: number) => `${wpSite()}/wp-admin/post.php?post=${wpId}&action=edit`;
