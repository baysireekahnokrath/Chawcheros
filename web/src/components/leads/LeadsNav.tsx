import Link from 'next/link';

const TABS = [
  { key: 'today', href: '/leads', label: 'วันนี้' },
  { key: 'list', href: '/leads/list', label: 'คนสนใจ' },
  { key: 'week', href: '/leads/week', label: 'สรุปสัปดาห์' },
] as const;

/** หัวของทุกหน้าในโมดูลคนสนใจ · ชื่อ + คำอธิบายสั้น + แท็บ 3 หน้า */
export default function LeadsNav({ current, todayCount }: { current: 'today' | 'list' | 'week'; todayCount?: number }) {
  return (
    <header>
      <h1 className="text-xl font-semibold tracking-tight">คนสนใจ</h1>
      <p className="mt-1 text-sm text-muted">
        ทุกคนที่ทักมาถามเรื่องสินค้า อยู่ในรายการเดียว หน้านี้บอกทีมขายว่าวันนี้ต้องตอบใคร ตามใคร เพื่อชวนมาโชว์รูม
      </p>
      <nav aria-label="เมนูคนสนใจ" className="mt-4 grid grid-cols-3 gap-1 rounded-2xl border border-border bg-surface p-1">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={t.href}
            aria-current={current === t.key ? 'page' : undefined}
            className={
              'flex min-h-11 items-center justify-center rounded-xl px-2 text-sm ' +
              (current === t.key ? 'bg-accent font-medium text-accent-fg' : 'hover:bg-bg')
            }
          >
            {t.label}
            {t.key === 'today' && typeof todayCount === 'number' && (
              <span className="ml-1 tabular-nums">({todayCount})</span>
            )}
          </Link>
        ))}
      </nav>
    </header>
  );
}

export function LoadError({ message }: { message: string }) {
  const missing = /schema|PGRST106|must be one of/i.test(message);
  return (
    <p className="mt-4 rounded-2xl border border-danger/40 bg-danger/10 p-4 text-sm text-danger">
      {missing
        ? 'ฐานข้อมูลยังไม่มีโมดูลคนสนใจ ต้องวาง migration 0053_leads.sql ใน Supabase ก่อน (ดู docs/bay-action-list.md)'
        : `โหลดข้อมูลไม่ได้: ${message}`}
    </p>
  );
}

export const FOOT_NOTE =
  'หน้าจอนี้ไม่ส่งข้อความถึงลูกค้าเอง พนักงานคัดลอกแล้วไปส่งในแชทเดิม · ไม่มีข้อมูลต้นทุนหรือกำไรในหน้านี้';
