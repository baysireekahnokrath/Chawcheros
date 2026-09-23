import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getDashboard } from '@/modules/content/dashboard';

export const metadata = { title: 'ตรวจงาน · Chaw Cher OS' };

const ago = (iso: string | null) => {
  if (!iso) return '';
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 36e5);
  return h < 24 ? `รอ ${Math.max(h, 0)} ชม.` : `รอ ${Math.floor(h / 24)} วัน`;
};

/** รายการงานรอตรวจทั้งหมด · รอนานสุดก่อน (เมนู "ตรวจ" · Q-123) */
export default async function ReviewList() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const d = await getDashboard(user?.id ?? '', null);
  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight">ตรวจงาน · {d.waiting.length}</h1>
      <p className="mt-1 text-sm text-muted">รอนานสุดขึ้นก่อน · ตรวจทีละส่วน ส่วนที่ผ่านแล้วไม่ต้องตรวจซ้ำ</p>
      {d.waiting.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted">ไม่มีงานรอตรวจ</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {d.waiting.map((w) => (
            <li key={w.id}>
              <Link href={`/content/${w.id}/review`} className="flex items-center justify-between gap-3 rounded-xl border border-locked/40 bg-surface px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{w.hook || w.title}</p>
                  <p className="text-xs text-muted">{ago(w.submitted_at)}{w.next_on ? ` · ลง ${w.next_on}` : ''}</p>
                </div>
                <span className="shrink-0 rounded-xl bg-accent px-3 py-1.5 text-sm font-medium text-accent-fg">ตรวจ</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
