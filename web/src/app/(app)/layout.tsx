import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import SignOutButton from '@/components/SignOutButton';

export default async function AppLayout({ children }: LayoutProps<'/'>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: me } = await supabase
    .schema('core')
    .from('app_users')
    .select('full_name')
    .eq('id', user?.id ?? '')
    .maybeSingle();

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 border-b border-border bg-surface/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4">
          <Link href="/" className="font-semibold tracking-tight">
            ฌ เฌอ <span className="text-muted font-normal">OS</span>
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted truncate max-w-[9rem]">
              {me?.full_name ?? user?.email}
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
