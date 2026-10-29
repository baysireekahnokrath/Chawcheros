import Link from 'next/link';
import { getOrders } from '@/modules/sales/queries';
import { baht } from '@/modules/sales/types';

const TABS = [
  ['ยืนยันแล้ว', 'ที่รับแล้ว'],
  ['ร่าง', 'ร่าง'],
  ['all', 'ทั้งหมด'],
] as const;

const tone = (s: string) =>
  s === 'ชำระครบ' ? 'text-ok' : s === 'ชำระบางส่วน' ? 'text-warn' : s === 'ยกเลิก' ? 'text-muted' : 'text-danger';

export default async function OrdersPage({ searchParams }: PageProps<'/orders'>) {
  const { status } = await searchParams;
  const active = typeof status === 'string' ? status : 'ยืนยันแล้ว';
  const rows = await getOrders(active);

  const owing = rows.reduce((s, r) => s + (r.ยอดค้าง > 0 ? r.ยอดค้าง : 0), 0);
  const late = rows.filter((r) => r.เลยกำหนดส่งและยังค้างเงิน).length;

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">ออเดอร์</h1>
          <p className="mt-1 text-sm text-muted">
            {rows.length} ใบ · ค้างรวม {baht(owing)} บาท
            {late > 0 && <span className="text-danger"> · เลยกำหนด {late} ใบ</span>}
          </p>
        </div>
        <Link
          href="/orders/new"
          className="shrink-0 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-accent-fg"
        >
          + ออเดอร์
        </Link>
      </div>

      <div className="mt-4 flex gap-2">
        {TABS.map(([value, text]) => (
          <Link
            key={value}
            href={`/orders?status=${encodeURIComponent(value)}`}
            className={
              'rounded-xl border px-3 py-2 text-sm ' +
              (active === value
                ? 'border-accent bg-accent/10 font-medium text-accent'
                : 'border-border bg-surface text-muted')
            }
          >
            {text}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-border bg-surface p-4 text-sm text-muted">
          ยังไม่มีออเดอร์ในกลุ่มนี้
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
          {rows.map((o) => (
            <li key={o.id}>
              <Link href={`/orders/${o.id}`} className="block px-4 py-3 hover:bg-bg">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-medium">{o.เลขที่}</span>
                  <span className="shrink-0 text-sm">{baht(o.ยอดรวม)}</span>
                </div>
                <div className="mt-0.5 truncate text-sm text-muted">
                  {o.ลูกค้า}
                  {o.ส่งที่ && ` · ${o.ส่งที่}`}
                </div>
                <div className="mt-1 flex items-center justify-between gap-3 text-xs">
                  <span className={tone(o.สถานะการเงิน)}>
                    {o.สถานะการเงิน}
                    {o.ยอดค้าง > 0 && ` · ค้าง ${baht(o.ยอดค้าง)}`}
                  </span>
                  <span className={o.เลยกำหนดส่งและยังค้างเงิน ? 'text-danger' : 'text-muted'}>
                    {o.กำหนดส่ง ? `ส่ง ${o.กำหนดส่ง}` : 'ยังไม่นัดส่ง'}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-4 text-xs text-muted">
        สถานะคำนวณสดจากรายการและการรับชำระจริง — ไม่มีช่องให้ใครพิมพ์ จึงไม่มีทางเพี้ยน
      </p>
    </>
  );
}
