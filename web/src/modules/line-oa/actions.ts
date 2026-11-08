'use server';

/**
 * ติ๊ก "นับ / ไม่นับ" · Bay (admin) เท่านั้น · RLS ใน 0041 กันอีกชั้น
 * ห้ามลบ (A7) · ข้อความทดสอบหรือพนักงานลองสแกน → ไม่นับ
 */
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function setCounted(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  const counted = formData.get('counted') === 'true';
  if (!id) return;
  const supabase = await createClient();
  await supabase.schema('line_oa').from('arrivals').update({ counted }).eq('id', id);
  revalidatePath('/arrivals');
}
