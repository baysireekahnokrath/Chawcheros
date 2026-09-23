import Link from 'next/link';
import { getItems, getContentToday, getGaps } from '@/modules/content/queries';
import { STAGES } from '@/modules/content/types';

export const metadata = { title: 'คอนเทนต์ · Chaw Cher OS' };

const TONE: Record<string, string> = {
  ไอเดีย: 'bg-border text-muted',
  เขียนบท: 'bg-accent/10 text-accent',
  ถ่ายแล้วรอตัด: 'bg-warn/10 text-warn',
  ตัดเสร็จ: 'bg-accent/10 text-accent',
  รอตรวจ: 'bg-locked/10 text-locked',
  ตีกลับแก้: 'bg-danger/10 text-danger',
  พร้อมโพสต์: 'bg-ok/10 text-ok',
  โพสต์แล้ว: 'bg-ok/10 text-ok',
  พับไว้: 'bg-border text-muted',
};

export default async function ContentPage() {
  const [items, today, gaps] = await Promise.all([getItems(), getContentToday(), getGaps()]);

  const active = items.filter((i) => i.stage !== 'โพสต์แล้ว' && i.stage !== 'พับไว้');
  const byStage = STAGES.map((s) => ({ stage: s, items: items.filter((i) => i.stage === s) }))
    .filter((g) => g.items.length > 0);

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">คอนเทนต์</h1>
          <p className="mt-1 text-sm text-muted">
            คลิปยาว · คลิปสั้น · หน้าเว็บ — ถ่ายทีเดียว ลงหลายที่
          </p>
        </div>
        <Link
          href="/content/new"
          role="button"
          className="shrink-0 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-accent-fg"
        >
          + ตั้งงาน
        </Link>
      </div>

      {today.length > 0 && (
        <section className="mt-5">
          <h2 className="mb-2 text-sm font-medium">งานวันนี้</h2>
          <ul className="space-y-2">
            {today.map((t) => (
              <li key={`${t.หมวด}-${t.ref_id}`}>
                <Link
                  href={`/content/${t.ref_id}`}
                  className={
                    'block rounded-xl border px-4 py-3 text-sm ' +
                    (t.หมวด === 'รอคุณอนุมัติ'
                      ? 'border-locked/40 bg-locked/5'
                      : t.หมวด === 'ถูกตีกลับ ต้องแก้'
                        ? 'border-danger/40 bg-danger/5'
                        : 'border-border bg-surface')
                  }
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-medium">{t.เรื่อง}</span>
                    <span className="shrink-0 text-xs text-muted">{t.รูปแบบ}</span>
                  </div>
                  <div className="mt-0.5 text-xs text-muted">{t.หมวด}</div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {gaps.length > 0 && (
        <section className="mt-5">
          <h2 className="mb-2 text-sm font-medium text-warn">อนุมัติแล้วแต่ยังลงไม่ครบ</h2>
          <ul className="space-y-2">
            {gaps.map((g) => (
              <li key={g.item_id}>
                <Link
                  href={`/content/${g.item_id}`}
                  className="block rounded-xl border border-warn/40 bg-warn/5 px-4 py-3 text-sm"
                >
                  <div className="font-medium">{g.เรื่อง}</div>
                  <div className="mt-0.5 text-xs text-muted">
                    ลงแล้ว {g.ลงแล้ว} จาก {g.ตั้งใจลงกี่ที่} · ยังขาด{' '}
                    <span className="text-warn">{g.ที่ยังขาด}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-6">
        <h2 className="mb-2 flex items-baseline justify-between text-sm font-medium">
          <span>งานทั้งหมด</span>
          <span className="text-xs text-muted">กำลังทำอยู่ {active.length} ชิ้น</span>
        </h2>

        {items.length === 0 ? (
          <p className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted">
            ยังไม่มีงานคอนเทนต์ — กด &ldquo;+ ตั้งงาน&rdquo; เพื่อเริ่ม
          </p>
        ) : (
          <div className="space-y-5">
            {byStage.map((g) => (
              <div key={g.stage}>
                <div className="mb-2 flex items-baseline gap-2">
                  <span className={`rounded-lg px-2 py-0.5 text-xs ${TONE[g.stage] ?? ''}`}>
                    {g.stage}
                  </span>
                  <span className="text-xs text-muted">{g.items.length}</span>
                </div>
                <ul className="space-y-2">
                  {g.items.map((i) => (
                    <li key={i.id}>
                      <Link
                        href={`/content/${i.id}`}
                        className="block rounded-xl border border-border bg-surface px-4 py-3"
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-sm font-medium">{i.title}</span>
                          <span className="shrink-0 text-xs text-muted">{i.format}</span>
                        </div>
                        {i.review_note && (
                          <div className="mt-1 text-xs text-danger">{i.review_note}</div>
                        )}
                        {i.due_on && (
                          <div className="mt-0.5 text-xs text-muted">
                            กำหนด {new Date(i.due_on).toLocaleDateString('th-TH', { dateStyle: 'medium' })}
                          </div>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
