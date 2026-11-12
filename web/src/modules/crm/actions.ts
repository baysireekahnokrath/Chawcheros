'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

const text = (fd: FormData, k: string) => {
  const v = (fd.get(k) as string | null)?.trim();
  return v ? v : null;
};

export async function createCustomer(fd: FormData): Promise<ActionResult<string>> {
  const name = text(fd, 'name');
  if (!name) return { ok: false, error: 'ต้องใส่ชื่อลูกค้า' };

  const supabase = await createClient();
  const { data, error } = await supabase
    .schema('crm')
    .from('customers')
    .insert({
      kind: (fd.get('kind') as string) || 'บุคคล',
      name,
      tax_id: text(fd, 'tax_id'),
      phone: text(fd, 'phone'),
      email: text(fd, 'email'),
      line_id: text(fd, 'line_id'),
      facebook: text(fd, 'facebook'),
      instagram: text(fd, 'instagram'),
      note: text(fd, 'note'),
    })
    .select('id')
    .single();

  if (error) {
    // เลขผู้เสียภาษีซ้ำ = มีลูกค้ารายนี้อยู่แล้ว บอกให้ชัดดีกว่าโยนข้อความฐานข้อมูลใส่หน้า
    if (error.code === '23505')
      return { ok: false, error: 'เลขผู้เสียภาษีนี้มีลูกค้าอยู่แล้ว — ค้นหาชื่อเดิมก่อนสร้างใหม่' };
    return { ok: false, error: error.message };
  }

  revalidatePath('/customers');
  return { ok: true, data: data.id };
}

export async function addAddress(fd: FormData): Promise<ActionResult> {
  const customer_id = text(fd, 'customer_id');
  const label = text(fd, 'label');
  const address = text(fd, 'address');
  if (!customer_id || !label || !address)
    return { ok: false, error: 'ต้องใส่ชื่อสาขาและที่อยู่' };

  const supabase = await createClient();
  const { error } = await supabase.schema('crm').from('customer_addresses').insert({
    customer_id,
    label,
    kind: (fd.get('kind') as string) || 'จัดส่ง',
    address,
    contact_name: text(fd, 'contact_name'),
    contact_phone: text(fd, 'contact_phone'),
    is_default: fd.get('is_default') === 'on',
  });

  if (error) {
    if (error.code === '23505')
      return { ok: false, error: 'ลูกค้ารายนี้มีที่อยู่ตั้งต้นอยู่แล้ว — เอาติ๊ก "ที่อยู่หลัก" ออกก่อน' };
    return { ok: false, error: error.message };
  }

  revalidatePath(`/customers/${customer_id}`);
  return { ok: true };
}
