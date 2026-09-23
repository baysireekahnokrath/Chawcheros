'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * เมนูของโมดูลคอนเทนต์ (Q-123) · มือถืออยู่ล่างจอ · คอมอยู่บนสุด
 * แผน (R6) จะเพิ่มเข้ามาเมื่อมีหน้าแผนเดือน
 */
const TABS = [
  { href: '/content', label: 'หน้าแรก', match: (p: string) => p === '/content' },
  { href: '/content/calendar', label: 'ปฏิทิน', match: (p: string) => p.startsWith('/content/calendar') },
  { href: '/content/review', label: 'ตรวจ', match: (p: string) => p === '/content/review' },
  { href: '/content/brain', label: 'แบรนด์', match: (p: string) => p.startsWith('/content/brain') },
];

export default function ContentNav({ reviewCount }: { reviewCount: number }) {
  const path = usePathname();
  const link = (t: (typeof TABS)[number], cls: string, on: string) => (
    <Link key={t.href} href={t.href} aria-current={t.match(path) ? 'page' : undefined}
      className={cls + ' ' + (t.match(path) ? on : 'text-muted')}>
      {t.label}
      {t.href === '/content/review' && reviewCount > 0 && (
        <span className="ml-1 rounded-full bg-locked px-1.5 text-[11px] font-semibold text-white">{reviewCount}</span>
      )}
    </Link>
  );
  return (
    <>
      <nav aria-label="เมนูคอนเทนต์" className="mb-5 hidden gap-1 border-b border-border lg:flex">
        {TABS.map((t) => link(t, 'border-b-2 border-transparent px-4 py-2 text-sm', 'border-accent! font-semibold text-text'))}
      </nav>
      <nav aria-label="เมนูคอนเทนต์"
        className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {TABS.map((t) => link(t, 'py-3 text-center text-sm', 'font-semibold text-accent'))}
      </nav>
    </>
  );
}
