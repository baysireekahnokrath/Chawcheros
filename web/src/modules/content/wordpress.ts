/**
 * ต่อ WordPress ของเว็บ chawcher.com (R7 · W-01–09)
 * ใช้ REST API + Application Password ของผู้ใช้สิทธิ์ Author (Publish ไม่ได้โดยสิทธิ์)
 * รหัสอยู่ใน Vercel env เท่านั้น: WP_USER · WP_APP_PASSWORD · (WP_URL ถ้าไม่ใช่ chawcher.com)
 * ไฟล์นี้ใช้ฝั่งเซิร์ฟเวอร์เท่านั้น
 */

export const WP_SITE = (process.env.WP_URL?.trim() || 'https://chawcher.com').replace(/\/+$/, '');
export const WP_ADMIN = `${WP_SITE}/wp-admin/`;
export const wpEditUrl = (postId: number) => `${WP_SITE}/wp-admin/post.php?post=${postId}&action=edit`;

/** ช่อง Yoast ที่ต้องเปิดให้ REST เขียนได้ (snippet ใน docs/modules/content/phase2/wordpress-yoast.md) */
const YOAST_DESC = '_yoast_wpseo_metadesc';
const YOAST_KW = '_yoast_wpseo_focuskw';

export const wpConfigured = () => !!(process.env.WP_USER?.trim() && process.env.WP_APP_PASSWORD?.trim());

type Res<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

function authHeader() {
  const user = process.env.WP_USER?.trim() ?? '';
  const pass = process.env.WP_APP_PASSWORD?.trim() ?? '';
  return 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');
}

function explain(status: number, code: string, message: string): string {
  if (status === 401) return 'WordPress ไม่รับรหัส · เช็ก WP_USER / WP_APP_PASSWORD ใน Vercel (รหัสอาจถูกลบใน wp-admin)';
  if (status === 403) return `WordPress ไม่ให้สิทธิ์ (${code}) · ผู้ใช้ content-agent ต้องเป็น Author ขึ้นไป`;
  if (status === 404) return 'ไม่พบใน WordPress (อาจถูกลบไปแล้ว)';
  return `WordPress ตอบ ${status}${code ? ` · ${code}` : ''}${message ? ` · ${message}` : ''}`;
}

async function wp<T>(path: string, init: RequestInit = {}, authed = true): Promise<Res<T>> {
  if (authed && !wpConfigured()) return { ok: false, status: 0, error: 'ยังไม่ได้ต่อ WordPress · ใส่ WP_USER และ WP_APP_PASSWORD ใน Vercel' };
  let r: Response;
  try {
    r = await fetch(`${WP_SITE}/wp-json${path}`, {
      ...init,
      headers: { ...(authed ? { Authorization: authHeader() } : {}), ...(init.headers ?? {}) },
      cache: 'no-store',
      signal: AbortSignal.timeout(60_000),
    });
  } catch (e) {
    return { ok: false, status: 0, error: `ติดต่อเว็บไม่ได้ · ${(e as Error).message}` };
  }
  const text = await r.text();
  let body: unknown = null;
  try { body = text ? JSON.parse(text) : null; } catch { /* ไม่ใช่ JSON */ }
  if (!r.ok) {
    const b = (body ?? {}) as { code?: string; message?: string };
    return { ok: false, status: r.status, error: explain(r.status, b.code ?? '', (b.message ?? text.slice(0, 120)).replace(/<[^>]+>/g, '')) };
  }
  return { ok: true, data: body as T };
}

// ── ทดสอบการเชื่อมต่อ (X-02) ──────────────────────────────────────────────────

export type WpHealth = { ok: true; name: string; roles: string[]; yoast: boolean } | { ok: false; error: string };

export async function wpHealth(): Promise<WpHealth> {
  const me = await wp<{ name: string; roles?: string[] }>('/wp/v2/users/me?context=edit');
  if (!me.ok) return { ok: false, error: me.error };
  // ช่อง Yoast เปิดให้เขียนหรือยัง: ดูจาก schema ของโพสต์
  const opts = await wp<{ schema?: { properties?: { meta?: { properties?: Record<string, unknown> } } } }>('/wp/v2/posts', { method: 'OPTIONS' });
  const metaProps = opts.ok ? opts.data.schema?.properties?.meta?.properties ?? {} : {};
  return { ok: true, name: me.data.name, roles: me.data.roles ?? [], yoast: YOAST_DESC in metaProps };
}

// ── หมวด (W-04) · อ่านได้โดยไม่ต้องล็อกอิน ─────────────────────────────────────

export type WpCategory = { id: number; name: string };

export async function wpCategories(): Promise<WpCategory[]> {
  const r = await wp<{ id: number; name: string }[]>('/wp/v2/categories?per_page=100&_fields=id,name', {}, false);
  if (!r.ok) return [];
  const decode = (s: string) => s.replace(/&amp;/g, '&').replace(/&#0?39;/g, "'").replace(/&quot;/g, '"');
  return r.data.filter((c) => c.name !== 'Uncategorized').map((c) => ({ id: c.id, name: decode(c.name) }));
}

// ── โพสต์ ─────────────────────────────────────────────────────────────────────

export type WpPost = { id: number; status: string; link: string };

/** null = ไม่มีโพสต์นี้แล้ว (ถูกลบถาวรหรืออยู่ในถังขยะ) */
export async function wpGetPost(id: number): Promise<Res<WpPost | null>> {
  const r = await wp<WpPost>(`/wp/v2/posts/${id}?context=edit&_fields=id,status,link`);
  if (!r.ok) return r.status === 404 || r.status === 410 ? { ok: true, data: null } : r;
  return { ok: true, data: r.data.status === 'trash' ? null : r.data };
}

export type WpDraft = {
  title: string; html: string; excerpt: string; slug: string | null;
  categoryId: number | null; featuredId: number | null; metaDesc: string | null; keyword: string | null;
};

export async function wpSaveDraft(id: number | null, d: WpDraft): Promise<Res<{ id: number; yoast: boolean }>> {
  const meta: Record<string, string> = {};
  if (d.metaDesc) meta[YOAST_DESC] = d.metaDesc;
  if (d.keyword) meta[YOAST_KW] = d.keyword;
  const body = {
    title: d.title,
    content: d.html,
    excerpt: d.excerpt,
    status: 'draft',
    ...(d.slug ? { slug: d.slug } : {}),
    ...(d.categoryId ? { categories: [d.categoryId] } : {}),
    ...(d.featuredId ? { featured_media: d.featuredId } : {}),
    meta,
  };
  const send = (b: object) => wp<{ id: number; meta?: Record<string, unknown> }>(id ? `/wp/v2/posts/${id}` : '/wp/v2/posts', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b),
  });
  let r = await send(body);
  // ช่อง Yoast ยังไม่เปิด WordPress บางรุ่นปฏิเสธทั้งคำขอ · ส่งใหม่โดยไม่มี meta
  if (!r.ok && r.status === 400 && Object.keys(meta).length) r = await send({ ...body, meta: {} });
  if (!r.ok) return r;
  const yoast = !Object.keys(meta).length || (r.data.meta ? YOAST_DESC in r.data.meta : false);
  return { ok: true, data: { id: r.data.id, yoast } };
}

// ── ภาพ (W-03) ────────────────────────────────────────────────────────────────

/** ลิงก์ Drive แบบแชร์ → ลิงก์ไฟล์ตรง · ไฟล์ต้องตั้งเป็น "ทุกคนที่มีลิงก์" */
export function directImageUrl(url: string): string | null {
  const u = url.trim();
  if (/\.(jpe?g|png|webp|gif|avif)(\?|$)/i.test(u)) return u;
  const drive = u.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:.*&)?id=)([\w-]{10,})/);
  if (drive) return `https://drive.google.com/uc?export=download&id=${drive[1]}`;
  return null;
}

export async function wpUploadImage(url: string, alt: string, name: string): Promise<Res<{ id: number; src: string }>> {
  const direct = directImageUrl(url);
  if (!direct) return { ok: false, status: 0, error: 'ลิงก์ภาพไม่ใช่ไฟล์ภาพหรือ Drive (เช่น Figma)' };
  let img: Response;
  try {
    img = await fetch(direct, { redirect: 'follow', signal: AbortSignal.timeout(60_000) });
  } catch (e) {
    return { ok: false, status: 0, error: `โหลดภาพไม่ได้ · ${(e as Error).message}` };
  }
  const type = img.headers.get('content-type') ?? '';
  if (!img.ok || !type.startsWith('image/')) {
    return { ok: false, status: img.status, error: 'โหลดภาพไม่ได้ · ถ้าเป็น Drive ต้องแชร์แบบ "ทุกคนที่มีลิงก์"' };
  }
  const buf = Buffer.from(await img.arrayBuffer());
  if (buf.length > 20 * 1024 * 1024) return { ok: false, status: 0, error: 'ภาพใหญ่เกิน 20MB' };
  const ext = type.split('/')[1]?.replace('jpeg', 'jpg').replace(/[^a-z]/g, '') || 'jpg';
  const up = await wp<{ id: number; source_url: string }>('/wp/v2/media', {
    method: 'POST',
    headers: { 'Content-Type': type, 'Content-Disposition': `attachment; filename="${name}.${ext}"` },
    body: buf,
  });
  if (!up.ok) return up;
  await wp(`/wp/v2/media/${up.data.id}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ alt_text: alt }),
  });
  return { ok: true, data: { id: up.data.id, src: up.data.source_url } };
}

export async function wpMediaUrl(id: number): Promise<string | null> {
  const r = await wp<{ source_url: string }>(`/wp/v2/media/${id}?context=edit&_fields=source_url`);
  return r.ok ? r.data.source_url : null;
}
