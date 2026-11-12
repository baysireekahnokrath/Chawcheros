'use server';

/**
 * หลังบ้านคลังความรู้ · Bay (สิทธิ์ admin) เท่านั้น · RLS ใน 0048 กันอีกชั้น
 * R2 เปิดเก็บบทสนทนา · R4 ยืนยันทีละข้อ · สรุปตอนนี้
 */
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getMyCapabilities } from '@/modules/registry';
import { KB_CATEGORIES, runDigest } from './kb-digest';

const back = (tab: string, msg?: { ok?: string; err?: string }): never => {
  const q = new URLSearchParams({ tab });
  if (msg?.ok) q.set('ok', msg.ok);
  if (msg?.err) q.set('err', msg.err);
  revalidatePath('/knowledge'); revalidatePath('/line');
  redirect('/knowledge?' + q.toString());
};

/** ข้อความผิดพลาดจากฐานข้อมูล → ภาษาคน */
function explain(message: string) {
  if (message.includes('kb_public_no_customer')) return 'ข้อความสาธารณะห้ามมีเลข BLS หรือเบอร์โทร · ลบออกแล้วลองใหม่';
  if (message.includes('kb_public_no_cost') || message.includes('kb_bot_no_cost')) return 'ห้ามมีคำว่า "ต้นทุน" หรือ "กำไร" ในข้อความที่บอทหรือเว็บใช้';
  if (message.includes('kb_public_needs_confirm')) return 'ขึ้น FAQ ได้ต้องมีทั้งหัวข้อและคำตอบที่เขียนให้ลูกค้า';
  return message;
}

async function admin() {
  if (!(await getMyCapabilities()).has('admin')) return null;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user ? { supabase, userId: user.id } : null;
}

/** R2 · Bay กดหลังโพสต์แจ้งทีมในห้องแล้ว · ฐานข้อมูลไม่ยอมเปิดเก็บถ้าไม่มีเวลาแจ้ง */
export async function startCollect(formData: FormData) {
  const a = await admin(); if (!a) return;
  const id = String(formData.get('id') ?? '');
  await a.supabase.schema('line_agent').from('rooms')
    .update({ kb_collect: true, kb_notice_at: new Date().toISOString() }).eq('id', id);
  revalidatePath('/line'); revalidatePath('/knowledge');
}

/** หยุดเก็บ · ข้อความที่เก็บไปแล้วยังอยู่ (A7 ห้ามลบ) · เวลาแจ้งทีมยังอยู่ */
export async function stopCollect(formData: FormData) {
  const a = await admin(); if (!a) return;
  const id = String(formData.get('id') ?? '');
  await a.supabase.schema('line_agent').from('rooms').update({ kb_collect: false }).eq('id', id);
  revalidatePath('/line'); revalidatePath('/knowledge');
}

export async function digestNow() {
  if (!(await admin())) return;
  let r;
  try { r = await runDigest('กดเอง'); } catch (e) { return back('draft', { err: 'สรุปไม่สำเร็จ · ' + (e instanceof Error ? e.message : String(e)) }); }
  back('draft', r.ok ? { ok: r.note } : { err: r.note });
}

const cat = (v: FormDataEntryValue | null) => {
  const c = String(v ?? '').trim();
  return (KB_CATEGORIES as readonly string[]).includes(c) || c === 'ยังไม่จัดหมวด' ? c : 'ยังไม่จัดหมวด';
};

/** ยืนยัน / บันทึกแก้ / ไม่ใช้ / กลับเป็นร่าง · ทีละข้อ (R4) */
export async function saveKbItem(formData: FormData) {
  const a = await admin(); if (!a) return;
  const id = String(formData.get('id') ?? '');
  const act = String(formData.get('act') ?? 'save');
  const tab = String(formData.get('tab') ?? 'draft');
  const title = String(formData.get('title') ?? '').trim();
  const body = String(formData.get('body') ?? '').trim();
  const pubTitle = String(formData.get('public_title') ?? '').trim() || null;
  const pubBody = String(formData.get('public_body') ?? '').trim() || null;
  const blsRaw = String(formData.get('bls') ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const bls = blsRaw ? (/^\d/.test(blsRaw) ? 'BLS' + blsRaw : blsRaw) : null;
  const patch: Record<string, unknown> = {};

  if (act === 'reject') Object.assign(patch, { status: 'ไม่ใช้', bot_use: false, is_public: false, reviewed_by: null, reviewed_at: null });
  else if (act === 'reopen') Object.assign(patch, { status: 'ร่าง', bot_use: false, is_public: false, reviewed_by: null, reviewed_at: null });
  else {
    if (!title || !body) return back(tab, { err: 'ต้องมีทั้งหัวข้อและคำตอบ' });
    Object.assign(patch, { title, body, category: cat(formData.get('category')), bls, public_title: pubTitle, public_body: pubBody });
    if (act === 'confirm') {
      const isPublic = formData.get('is_public') === 'on';
      if (isPublic && (!pubTitle || !pubBody)) return back(tab, { err: 'จะขึ้น FAQ ต้องเขียนหัวข้อและคำตอบสำหรับลูกค้าก่อน' });
      Object.assign(patch, {
        status: 'ยืนยันแล้ว', reviewed_by: a.userId, reviewed_at: new Date().toISOString(),
        bot_use: formData.get('bot_use') === 'on', is_public: isPublic,
      });
    }
  }
  const { error } = await a.supabase.schema('line_agent').from('kb_items').update(patch).eq('id', id);
  if (error) return back(tab, { err: explain(error.message) });
  back(tab, { ok: act === 'confirm' ? 'ยืนยันแล้ว · บอทและ FAQ ใช้ได้ตามที่ติ๊ก' : act === 'reject' ? 'ย้ายไป "ไม่ใช้" แล้ว' : act === 'reopen' ? 'กลับเป็นร่างแล้ว' : 'บันทึกแล้ว · ถ้าเคยยืนยันไว้ ต้องยืนยันใหม่' });
}

/** เขียนเองในเว็บ · หรือเขียนคำตอบให้คำถามที่บอทตอบไม่ได้ · เป็นร่างเสมอ */
export async function addKbItem(formData: FormData) {
  const a = await admin(); if (!a) return;
  const title = String(formData.get('title') ?? '').trim();
  const body = String(formData.get('body') ?? '').trim();
  const source = formData.get('from_request') === '1' ? 'คำถามบอท' : 'เขียนในเว็บ';
  if (!title || !body) return back('draft', { err: 'ต้องมีทั้งหัวข้อและคำตอบ' });
  const { error } = await a.supabase.schema('line_agent').from('kb_items')
    .insert({ title, body, category: cat(formData.get('category')), source, source_refs: [] });
  if (error) return back('draft', { err: explain(error.message) });
  back('draft', { ok: 'เพิ่มเป็นร่างแล้ว · ตรวจแล้วกดยืนยันเพื่อให้บอทใช้' });
}
