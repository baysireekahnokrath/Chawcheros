import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getMyModules } from '@/modules/registry';
import { groupModules } from '@/modules/nav';
import SignOutButton from '@/components/SignOutButton';
import { BottomBar, SideBar } from '@/components/ui/AppNav';

/**
 * โครงทุกหน้าในระบบ · ตาม docs/ui-framework/README.md
 * แถบบน (โลโก้ + ผู้ใช้) · คอม: เมนูข้าง · มือถือ: แถบล่าง 5 ช่อง
 */
export default async function AppLayout({ children }: LayoutProps<'/'>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: me }, modules] = await Promise.all([
    supabase.schema('core').from('app_users').select('full_name').eq('id', user?.id ?? '').maybeSingle(),
    getMyModules(),
  ]);

  const groups = groupModules(modules).map((g) => ({
    id: g.id,
    label: g.label,
    items: g.items.map((m) => ({ id: m.id, name_th: m.name_th, home_path: m.home_path })),
  }));

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 border-b border-border bg-surface/95 backdrop-blur">
        <div className="flex h-14 items-center justify-between gap-3 px-4 md:px-6">
          <Link href="/" className="num text-[13px] tracking-[0.28em] text-muted" aria-label="หน้าแรก">
            CHAW <b className="font-semibold text-accent">CHER</b>
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <span className="max-w-[9rem] truncate text-muted">{me?.full_name ?? user?.email}</span>
            <SignOutButton />
          </div>
        </div>
      </header>

      <div className="flex">
        <SideBar groups={groups} />
        <main className="mx-auto w-full min-w-0 max-w-5xl px-4 py-6 pb-28 md:px-6 md:pb-10">{children}</main>
      </div>

      <BottomBar />
    </div>
  );
}
