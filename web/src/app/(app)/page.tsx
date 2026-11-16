import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getMyModules } from '@/modules/registry';
import { DAILY } from '@/modules/nav';
import Icon from '@/components/Icon';
import AppGroups from '@/components/ui/AppGroups';

/**
 * หน้าแรก (แบบ A ใน docs/ui-framework/README.md)
 * ปุ่มใช้ทุกวัน 4 ปุ่มบนสุด → แอปทั้งหมดแยกหมวด
 * รายชื่อแอปยังสร้างจาก core.modules · เปิด/ปิด/สิทธิ์ ทำงานเหมือนเดิม
 */
export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // ยังไม่มีแถวใน core.app_users = ยังไม่ได้ตั้งค่าครั้งแรก
  const { data: me } = await supabase
    .schema('core')
    .from('app_users')
    .select('id')
    .eq('id', user?.id ?? '')
    .maybeSingle();

  if (!me) redirect('/setup');

  const modules = await getMyModules();

  return (
    <div className="grid gap-7">
      <section aria-labelledby="daily">
        <h1 id="daily" className="text-xl font-semibold tracking-tight text-accent">ใช้ทุกวัน</h1>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {DAILY.map((d) => (
            <Link
              key={d.href}
              href={d.href}
              className="flex min-h-20 flex-col justify-between gap-3 rounded-xl bg-accent p-3.5 font-semibold text-accent-fg transition hover:opacity-90"
            >
              <Icon name={d.icon} className="h-5 w-5 opacity-80" />
              {d.label}
            </Link>
          ))}
        </div>
      </section>

      <AppGroups modules={modules} />
    </div>
  );
}
