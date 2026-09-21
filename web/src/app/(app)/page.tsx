import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getMyModules } from '@/modules/registry';
import Icon from '@/components/Icon';

/**
 * App Launcher — หน้าแรกของระบบ
 *
 * ตารางไอคอนนี้สร้างตัวเองจากตาราง core.modules ทั้งหมด
 * เพิ่มโมดูลใหม่ = เพิ่ม 1 แถวในฐานข้อมูล แล้วมันจะโผล่ที่นี่เอง
 * ไม่มีการเขียนรายชื่อโมดูลไว้ในโค้ดเลย
 */
export default async function LauncherPage() {
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
    <>
      <h1 className="text-xl font-semibold tracking-tight">เลือกงานที่จะทำ</h1>
      <p className="mt-1 text-sm text-muted">
        {modules.length} โมดูลที่คุณเข้าได้
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {modules.map((m) => (
          <Link
            key={m.id}
            href={m.home_path ?? '/'}
            className="group rounded-2xl border border-border bg-surface p-4 transition hover:border-accent"
          >
            <span
              className={
                m.id === 'cost'
                  ? 'inline-flex rounded-xl bg-locked/10 p-2.5 text-locked'
                  : 'inline-flex rounded-xl bg-accent/10 p-2.5 text-accent'
              }
            >
              <Icon name={m.icon} />
            </span>
            <div className="mt-3 font-medium">{m.name_th}</div>
            {m.description_th && (
              <p className="mt-0.5 line-clamp-2 text-xs text-muted">{m.description_th}</p>
            )}
          </Link>
        ))}
      </div>

      {modules.length === 0 && (
        <p className="mt-8 rounded-xl border border-border bg-surface p-4 text-sm text-muted">
          ยังไม่มีโมดูลที่คุณเข้าได้ — ให้ผู้ดูแลระบบให้สิทธิ์ก่อน
        </p>
      )}
    </>
  );
}
