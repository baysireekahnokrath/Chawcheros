'use server';

/**
 * ปุ่มในหน้า /news · Bay (admin) เท่านั้น · RLS ใน 0049 กันอีกชั้น
 *
 * ขั้นของข่าว 1 ชิ้น
 *   ร่าง (ในระบบ) → [สร้าง/อัปเดตร่างบนเว็บ] → [Preview ใน WordPress] → [เผยแพร่บนเว็บ] → [ส่ง LINE]
 * publish และ ส่ง LINE เกิดจากปุ่มที่ Bay กดเท่านั้น (ตัวตั้งเวลาไม่มีทางเรียกไฟล์นี้)
 */
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getMyCapabilities } from '@/modules/registry';
import { lineSecrets, pushMessages } from '@/modules/line-agent/line';
import { collectNews, draftFromNote } from './ai';
import { ensureOnSite, publishPost, saveDraft, uploadMedia, wpConfig, type NewsImage } from './wp';

type Item = {
  id: string; brand: 'Chaw Cher' | 'ASE'; post_title: string; post_body: string; line_text: string;
  images: NewsImage[]; status: string; wp_post_id: number | null; wp_link: string | null;
  line_sent_to: { room_id: string; name: string | null; at: string }[];
};

const back = (msg?: { ok?: string; err?: string }, id?: string): never => {
  const q = new URLSearchParams();
  if (msg?.ok) q.set('ok', msg.ok);
  if (msg?.err) q.set('err', msg.err);
  revalidatePath('/news');
  redirect('/news' + (q.size ? '?' + q.toString() : '') + (id ? '#n-' + id : ''));
};
const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

async function admin() {
  if (!(await getMyCapabilities()).has('admin')) return null;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user ? { supabase, userId: user.id, db: supabase.schema('content') } : null;
}

async function load(a: NonNullable<Awaited<ReturnType<typeof admin>>>, id: string) {
  const { data } = await a.db.from('news_items').select('*').eq('id', id).maybeSingle();
  return data as Item | null;
}

/** รับรูปจากฟอร์ม (ย่อในเบราว์เซอร์แล้ว) → คลังสื่อ chawcher.com */
async function uploadFiles(formData: FormData, name: string) {
  const files = formData.getAll('images').filter((f): f is File => f instanceof File && f.size > 0);
  const out: NewsImage[] = [];
  for (const f of files.slice(0, 10)) {
    if (!f.type.startsWith('image/')) continue;
    out.push(await uploadMedia(await f.arrayBuffer(), f.type, name, ''));
  }
  return out;
}

export async function collectNow() {
  if (!(await admin())) return;
  let r;
  try { r = await collectNews('กดเอง'); } catch (e) { return back({ err: 'ค้นไม่สำเร็จ · ' + errText(e) }); }
  back(r.ok ? { ok: `${r.note} · ค่า Claude ≈ ฿${r.thb.toFixed(2)}` } : { err: r.note });
}

/** Bay เล่าเรื่อง + แนบรูป → AI ร่าง (ถ้ากดแบบไม่ใช้ AI = เอาข้อความไปเป็นเนื้อข่าวตรงๆ) */
export async function addNews(formData: FormData) {
  const a = await admin(); if (!a) return;
  const brand = formData.get('brand') === 'ASE' ? 'ASE' : 'Chaw Cher';
  const note = String(formData.get('note') ?? '').trim();
  if (!note) return back({ err: 'พิมพ์เรื่องก่อน' });
  if (!wpConfig() && formData.getAll('images').some((f) => f instanceof File && f.size > 0)) {
    return back({ err: 'ยังเก็บรูปไม่ได้ · ต้องใส่ WP_USER / WP_APP_PASSWORD ใน Vercel ก่อน (docs/bay-action-list.md)' });
  }
  let images: NewsImage[];
  try { images = await uploadFiles(formData, brand + '-news'); } catch (e) { return back({ err: 'อัปโหลดรูปไม่ได้ · ' + errText(e) }); }

  let draft = { post_title: note.split('\n')[0].slice(0, 90), post_body: note, line_text: `✨ ${brand} News\n${note.slice(0, 200)}`, alts: [] as string[] };
  let aiNote = '';
  try { draft = await draftFromNote({ brand, note, images }); } catch (e) { aiNote = ' · AI ร่างไม่ได้ (' + errText(e) + ') ใช้ข้อความของ Bay ไปก่อน'; }
  images = images.map((im, i) => ({ ...im, alt: draft.alts[i] ?? im.alt ?? '' }));

  const { data, error } = await a.db.from('news_items').insert({
    brand, source: 'Bay ส่งเอง', note, post_title: draft.post_title, post_body: draft.post_body,
    line_text: draft.line_text, images,
  }).select('id').single();
  if (error) return back({ err: error.message });
  back({ ok: 'ร่างแล้ว · ตรวจข้อความ แล้วกด "สร้างร่างบนเว็บ"' + aiNote }, data.id);
}

/** บันทึกที่ Bay แก้ + รูปที่เพิ่ม/ลบ/ย้ายเป็นรูปแรก */
export async function saveNews(formData: FormData) {
  const a = await admin(); if (!a) return;
  const id = String(formData.get('id') ?? '');
  const it = await load(a, id); if (!it) return back({ err: 'ไม่พบข่าว' });
  const title = String(formData.get('post_title') ?? '').trim();
  if (!title) return back({ err: 'ต้องมีหัวข่าว' }, id);

  const drop = new Set(formData.getAll('drop').map(String));
  const cover = String(formData.get('cover') ?? '');
  let images = it.images.filter((im) => !drop.has(im.url));
  const urlLine = String(formData.get('image_url') ?? '').trim();
  if (/^https:\/\//.test(urlLine)) images.push({ url: urlLine, preview: null, wp_id: null, alt: '' });
  try { images.push(...(await uploadFiles(formData, it.brand + '-news'))); } catch (e) { return back({ err: 'อัปโหลดรูปไม่ได้ · ' + errText(e) }, id); }
  if (cover) images = [...images.filter((im) => im.url === cover), ...images.filter((im) => im.url !== cover)];

  const { error } = await a.db.from('news_items').update({
    post_title: title,
    post_body: String(formData.get('post_body') ?? '').trim(),
    line_text: String(formData.get('line_text') ?? '').trim(),
    images: images.slice(0, 10),
  }).eq('id', id);
  if (error) return back({ err: error.message }, id);

  // ถ้ามีร่างบนเว็บแล้ว อัปเดตให้ตรงกันเลย (preview จะเห็นของใหม่)
  if (formData.get('act') === 'wp') return pushDraft(a, id);
  back({ ok: 'บันทึกแล้ว' }, id);
}

async function pushDraft(a: NonNullable<Awaited<ReturnType<typeof admin>>>, id: string): Promise<never> {
  const it = await load(a, id); if (!it) return back({ err: 'ไม่พบข่าว' });
  let ok: string;
  try {
    const images: NewsImage[] = [];
    for (const im of it.images) images.push(await ensureOnSite(im, it.brand + '-news'));
    const excerpt = it.post_body.split(/\n\s*\n/)[0]?.slice(0, 250) ?? '';
    const r = await saveDraft({ wpId: it.wp_post_id, title: it.post_title, body: it.post_body, images, excerpt });
    const { error } = await a.db.from('news_items').update({ images, wp_post_id: r.id, wp_link: it.wp_link ?? `https://chawcher.com/?p=${r.id}` }).eq('id', id);
    if (error) throw new Error(error.message);
    ok = it.wp_post_id ? 'อัปเดตบนเว็บแล้ว · กด Preview ดูได้เลย' : 'สร้างร่างบนเว็บแล้ว (ยังไม่มีใครเห็น) · กด Preview ดูได้เลย';
  } catch (e) {
    return back({ err: 'ส่งขึ้นเว็บไม่ได้ · ' + errText(e) }, id);
  }
  return back({ ok }, id);
}

/** ปุ่ม "เผยแพร่บนเว็บ" · Bay กดเองเท่านั้น */
export async function publishNews(formData: FormData) {
  const a = await admin(); if (!a) return;
  const id = String(formData.get('id') ?? '');
  const it = await load(a, id); if (!it) return back({ err: 'ไม่พบข่าว' });
  if (!it.wp_post_id) return back({ err: 'ต้องกด "สร้างร่างบนเว็บ" และดู Preview ก่อน' }, id);
  if (formData.get('confirm') !== 'on') return back({ err: 'ติ๊ก "ดู Preview แล้ว" ก่อนกดเผยแพร่' }, id);
  let link: string;
  try {
    link = await publishPost(it.wp_post_id);
  } catch (e) {
    return back({ err: 'เผยแพร่ไม่สำเร็จ · ' + errText(e) }, id);
  }
  await a.db.from('news_items').update({ status: 'เผยแพร่แล้ว', wp_link: link, published_at: new Date().toISOString(), reviewed_by: a.userId }).eq('id', id);
  back({ ok: 'ขึ้นเว็บแล้ว · ' + link }, id);
}

/** ปุ่ม "ส่ง LINE" · ส่งรูปแรก + ข้อความ (+ ลิงก์ข่าวถ้าขึ้นเว็บแล้ว) เข้ากลุ่มที่ Bay ติ๊ก */
export async function sendLine(formData: FormData) {
  const a = await admin(); if (!a) return;
  const id = String(formData.get('id') ?? '');
  const it = await load(a, id); if (!it) return back({ err: 'ไม่พบข่าว' });
  const roomIds = formData.getAll('room').map(String);
  if (roomIds.length === 0) return back({ err: 'ติ๊กกลุ่ม LINE อย่างน้อย 1 กลุ่ม' }, id);
  if (formData.get('confirm') !== 'on') return back({ err: 'ติ๊กยืนยันก่อนส่ง' }, id);
  const secrets = lineSecrets(); if (!secrets) return back({ err: 'ยังไม่ได้ใส่ LINE_CHANNEL_ACCESS_TOKEN ใน Vercel' }, id);

  const { data: rooms } = await a.supabase.schema('line_agent').from('rooms')
    .select('id, group_id, name').in('id', roomIds).eq('status', 'อนุมัติ');
  const text = it.line_text.trim() + (it.status === 'เผยแพร่แล้ว' && it.wp_link ? `\n\nอ่านต่อ 👉 ${it.wp_link}` : '');
  const img = it.images[0];
  const messages: object[] = [];
  if (img && /^https:\/\//.test(img.url)) messages.push({ type: 'image', originalContentUrl: img.url, previewImageUrl: img.preview || img.url });
  messages.push({ type: 'text', text: text.slice(0, 4900) });

  const sent: Item['line_sent_to'] = [];
  const errors: string[] = [];
  for (const r of (rooms ?? []) as { id: string; group_id: string; name: string | null }[]) {
    const res = await pushMessages(secrets.token, r.group_id, messages);
    if (res.ok) sent.push({ room_id: r.id, name: r.name, at: new Date().toISOString() });
    else errors.push(`${r.name ?? r.id}: ${res.error}`);
  }
  if (sent.length) {
    await a.db.from('news_items').update({
      line_sent_at: new Date().toISOString(), line_sent_to: [...(it.line_sent_to ?? []), ...sent], reviewed_by: a.userId,
    }).eq('id', id);
  }
  back(errors.length ? { err: `ส่งได้ ${sent.length} กลุ่ม · ไม่สำเร็จ: ${errors.join(' · ')}` } : { ok: `ส่ง LINE แล้ว ${sent.length} กลุ่ม` }, id);
}

/** ไม่ใช้ข่าวนี้ · ยังเก็บไว้กันซ้ำ (A7 ห้ามลบ) */
export async function setNewsStatus(formData: FormData) {
  const a = await admin(); if (!a) return;
  const id = String(formData.get('id') ?? '');
  const to = formData.get('to') === 'ร่าง' ? 'ร่าง' : 'ไม่ใช้';
  const it = await load(a, id); if (!it) return back({ err: 'ไม่พบข่าว' });
  if (it.status === 'เผยแพร่แล้ว') return back({ err: 'ข่าวนี้ขึ้นเว็บแล้ว · ถ้าจะเอาออกให้ไปเปลี่ยนเป็นร่างใน WordPress' }, id);
  await a.db.from('news_items').update({ status: to }).eq('id', id);
  back({ ok: to === 'ไม่ใช้' ? 'ย้ายไป "ไม่ใช้" แล้ว (ระบบจำไว้ ไม่ดึงข่าวนี้มาอีก)' : 'กลับเป็นร่างแล้ว' });
}

/** ปุ่ม "สร้าง/อัปเดตร่างบนเว็บ" แยก (ไม่ต้องแก้อะไร) */
export async function draftOnWeb(formData: FormData) {
  const a = await admin(); if (!a) return;
  return pushDraft(a, String(formData.get('id') ?? ''));
}
