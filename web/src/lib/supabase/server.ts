import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Supabase client สำหรับฝั่งเซิร์ฟเวอร์
 *
 * หมายเหตุสำคัญ: ตารางทั้งหมดอยู่ใน schema ของโมดูล ไม่ได้อยู่ใน public
 * เวลาเรียกต้องระบุ schema เสมอ เช่น  supabase.schema('core').from('modules')
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // เรียกจาก Server Component — middleware จะรีเฟรช session ให้เอง
          }
        },
      },
    },
  );
}
