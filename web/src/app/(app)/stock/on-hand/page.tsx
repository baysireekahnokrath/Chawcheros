import Link from 'next/link';
import { getOnHand } from '@/modules/stock/queries';

export const metadata = { title: 'มีอะไรอยู่ที่ไหน · Chaw Cher OS' };

export default async function OnHandPage() {
  const rows = await getOnHand();

  const byLocation = rows.reduce<Record<string, typeof rows>>((acc, r) => {
    (acc[r.อยู่ที่] ??= []).push(r);
    return acc;
  }, {});

  return (
    <>
      <Link href="/stock" className="text-sm text-muted">← คลัง</Link>
      <h1 className="mt-2 text-xl font-semibold tracking-tight">มีอะไรอยู่ที่ไหน</h1>
      <p className="mt-1 mb-5 text-sm text-muted">
        นับสดจากของจริงทุกครั้ง — ไม่มีช่องยอดคงเหลือให้ใครไปแก้
      </p>

      {rows.length === 0 && (
        <p className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted">
          ยังไม่มีของในคลัง
        </p>
      )}

      <div className="space-y-5">
        {Object.entries(byLocation).map(([loc, items]) => (
          <section key={loc}>
            <h2 className="mb-2 flex items-baseline justify-between text-sm font-medium">
              <span>{loc}</span>
              <span className="text-xs text-muted">
                {items.reduce((s, i) => s + i.ทั้งหมด, 0)} ตัว
              </span>
            </h2>
            <ul className="space-y-2">
              {items.map((r) => (
                <li
                  key={`${r.variant_id}-${r.อยู่ที่}`}
                  className="flex items-start justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{r.รุ่น}</div>
                    <div className="text-xs text-muted">
                      {[r.หมวด, r.วัสดุ].filter(Boolean).join(' · ')}
                    </div>
                    <div className="font-mono text-[11px] text-muted">{r.SKU}</div>
                  </div>
                  <div className="shrink-0 text-right text-xs">
                    <div className="text-base font-semibold tabular-nums">{r.ทั้งหมด}</div>
                    <div className="mt-0.5 space-x-1.5">
                      {r.พร้อมขาย > 0 && <span className="text-ok">ขายได้ {r.พร้อมขาย}</span>}
                      {r.จองแล้ว > 0 && <span className="text-warn">จอง {r.จองแล้ว}</span>}
                      {r.ยืมออก > 0 && <span className="text-locked">ยืม {r.ยืมออก}</span>}
                      {r.ตำหนิ > 0 && <span className="text-danger">ตำหนิ {r.ตำหนิ}</span>}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
