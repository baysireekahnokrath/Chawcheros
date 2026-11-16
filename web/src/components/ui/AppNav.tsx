'use client';

/**
 * ทางเดินของระบบ · ตาม docs/ui-framework/README.md
 *
 * มือถือ: แถบล่าง 5 ช่อง (นิ้วโป้งกดถึง)
 * คอม (md ขึ้นไป): 5 ช่องเดียวกันอยู่บนสุดของเมนูข้าง + แอปทั้งหมดแยกหมวดข้างล่าง
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Icon from '@/components/Icon';
import { TABS, activeTab } from '@/modules/nav';

type Group = { id: string; label: string; items: { id: string; name_th: string; home_path: string | null }[] };

export function BottomBar() {
  const on = activeTab(usePathname());
  return (
    <nav
      aria-label="เมนูหลัก"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {TABS.map((t) => {
          const active = on === t.href;
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? 'page' : undefined}
                className={`flex flex-col items-center gap-0.5 py-2 text-[11px] ${
                  active ? 'font-semibold text-accent' : 'text-muted'
                }`}
              >
                <Icon name={t.icon} className="h-6 w-6" />
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function SideBar({ groups }: { groups: Group[] }) {
  const pathname = usePathname();
  const on = activeTab(pathname);
  const isHere = (href: string | null) =>
    !!href && href !== '/' && (pathname === href || pathname.startsWith(href + '/'));

  return (
    <nav
      aria-label="เมนูหลัก"
      className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-56 shrink-0 overflow-y-auto border-r border-border bg-surface px-3 py-4 md:block"
    >
      <ul className="grid gap-0.5">
        {TABS.filter((t) => t.href !== '/menu').map((t) => (
          <li key={t.href}>
            <Link
              href={t.href}
              aria-current={on === t.href ? 'page' : undefined}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${
                on === t.href ? 'bg-aqua-soft font-semibold text-accent' : 'hover:bg-bg'
              }`}
            >
              <Icon name={t.icon} className="h-5 w-5" />
              {t.label}
            </Link>
          </li>
        ))}
      </ul>

      {groups.map((g) => (
        <div key={g.id} className="mt-5">
          <p className="px-3 text-[11px] font-medium uppercase tracking-[0.14em] text-taupe">{g.label}</p>
          <ul className="mt-1 grid gap-0.5">
            {g.items.map((m) => (
              <li key={m.id}>
                <Link
                  href={m.home_path ?? '/'}
                  aria-current={isHere(m.home_path) ? 'page' : undefined}
                  className={`block rounded-lg px-3 py-1.5 text-sm ${
                    isHere(m.home_path) ? 'bg-aqua-soft font-semibold text-accent' : 'text-text hover:bg-bg'
                  }`}
                >
                  {m.name_th}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
