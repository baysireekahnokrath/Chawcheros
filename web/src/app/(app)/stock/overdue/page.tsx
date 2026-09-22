import Link from 'next/link';
import { getOverdueLoans } from '@/modules/stock/queries';

export const metadata = { title: 'ของที่ต้องตามคืน · Chaw Cher OS' };

const baht = (n: number | null) =>
  n === null ? '—' : n.toLocaleString('th-TH', { maximumFractionDigits: 0 });

export default async function OverduePage() {
  const rows = await getOverdueLoans();
  const stuck = rows.reduce((s, r) => s + (r.มูลค่าที่จมอยู่ ?? 0), 0);

  return (
    <>
      <Link href="/stock" className="text-sm text-muted">← คลัง</Link>
      <h1 className="mt-2 text-xl font-semibold tracking-tight">ของที่ต้องตามคืน</h1>
      <p className="mt-1 mb-5 text-sm text-muted">
        เรียงตามมูลค่าที่จมอยู่ — ตัวบนสุดคือตัวที่ควรโทรตามก่อน
      </p>

      {rows.length === 0 ? (
        <p className="rounded-2xl border border-ok/40 bg-ok/5 p-6 text-center text-sm">
          <span className="font-medium text-ok">ไม่มีของค้างเลย</span>
          <br />
          <span className="text-muted">ทุกตัวที่ยืมออกยังอยู่ในกำหนด</span>
        </p>
      ) : (
        <>
          <div className="mb-4 rounded-2xl border border-danger/40 bg-danger/5 p-4">
            <div className="text-sm text-muted">มูลค่าที่จมอยู่ในมือคนอื่น</div>
            <div className="mt-0.5 text-2xl font-semibold tabular-nums text-danger">
              {baht(stuck)} บาท
            </div>
            <div className="mt-0.5 text-xs text-muted">{rows.length} ตัว</div>
          </div>

          <ul className="space-y-3">
            {rows.map((r) => (
              <li key={r.loan_id} className="rounded-2xl border border-border bg-surface p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/stock/u/${r.รหัสตัว}`}
                      className="font-mono text-sm font-medium text-accent"
                    >
                      {r.รหัสตัว}
                    </Link>
                    <div className="mt-0.5 text-sm">{r.รุ่น}</div>
                    <div className="text-xs text-muted">
                      {[r.หมวด, r.วัสดุ].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <span className="shrink-0 rounded-lg bg-danger/10 px-2 py-1 text-xs text-danger">
                    เลย {r.เลยมากี่วัน} วัน
                  </span>
                </div>

                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 border-t border-border pt-3 text-xs">
                  <dt className="text-muted">อยู่ที่</dt>
                  <dd className="text-right font-medium">{r.ยืมไปไหน}</dd>
                  {r.ใครยืม && (<><dt className="text-muted">ใครยืม</dt><dd className="text-right">{r.ใครยืม}</dd></>)}
                  <dt className="text-muted">กำหนดกลับ</dt>
                  <dd className="text-right">
                    {new Date(r.กำหนดกลับ).toLocaleDateString('th-TH', { dateStyle: 'medium' })}
                  </dd>
                  <dt className="text-muted">มูลค่าที่จม</dt>
                  <dd className="text-right font-medium">{baht(r.มูลค่าที่จมอยู่)} บาท</dd>
                </dl>

                <Link
                  href={`/stock/u/${r.รหัสตัว}`}
                  role="button"
                  className="mt-3 block rounded-xl bg-accent px-4 py-3 text-center text-sm font-medium text-accent-fg"
                >
                  รับคืน
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
