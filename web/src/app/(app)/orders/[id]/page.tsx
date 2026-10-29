import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getOrder, getVariantPicker } from '@/modules/sales/queries';
import { baht } from '@/modules/sales/types';
import OrderActions from '@/components/sales/OrderActions';

const card = 'rounded-2xl border border-border bg-surface p-4';

export default async function OrderPage({ params }: PageProps<'/orders/[id]'>) {
  const { id } = await params;
  const [found, variants] = await Promise.all([getOrder(id), getVariantPicker()]);
  if (!found) notFound();
  const { order, lines, payments } = found;

  return (
    <>
      <Link href="/orders" className="text-sm text-muted">
        ← ออเดอร์
      </Link>

      <div className="mt-2 flex items-baseline justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">{order.เลขที่}</h1>
        <span className="shrink-0 rounded-md border border-border px-2 py-0.5 text-xs text-muted">
          {order.สถานะเอกสาร}
        </span>
      </div>
      <p className="mt-1 text-sm text-muted">
        {order.ลูกค้า}
        {order.ส่งที่ && ` · ส่งที่ ${order.ส่งที่}`}
      </p>

      {/* ยอดเงิน · ทุกตัวคำนวณสด ไม่มีช่องให้ใครแก้ */}
      <dl className={card + ' mt-4 space-y-1.5 text-sm'}>
        <Row k="ยอดรวม" v={baht(order.ยอดรวม)} />
        <Row k="รับชำระแล้ว" v={baht(order.รับชำระแล้ว)} />
        <div className="flex justify-between border-t border-border pt-1.5 font-medium">
          <dt>ยอดค้าง</dt>
          <dd className={order.ยอดค้าง > 0 ? 'text-danger' : 'text-ok'}>{baht(order.ยอดค้าง)}</dd>
        </div>
        <div className="flex justify-between pt-1 text-xs text-muted">
          <dt>สถานะการเงิน</dt>
          <dd>{order.สถานะการเงิน}</dd>
        </div>
        {order.กำหนดส่ง && (
          <div className="flex justify-between text-xs">
            <dt className="text-muted">กำหนดส่ง</dt>
            <dd className={order.เลยกำหนดส่งและยังค้างเงิน ? 'text-danger' : 'text-muted'}>
              {order.กำหนดส่ง}
              {order.เลยกำหนดส่งและยังค้างเงิน && ' · เลยกำหนดและยังค้างเงิน'}
            </dd>
          </div>
        )}
      </dl>

      <h2 className="mt-6 text-sm font-semibold">รายการ ({lines.length})</h2>
      {lines.length === 0 ? (
        <p className="mt-2 text-sm text-muted">ยังไม่มีรายการ — ใส่รายการก่อนถึงจะยืนยันออเดอร์ได้</p>
      ) : (
        <ul className="mt-2 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
          {lines.map((l) => (
            <li key={l.id} className="px-4 py-3">
              <div className="flex justify-between gap-3">
                <span className="text-sm">{l.description}</span>
                <span className="shrink-0 text-sm">{baht(l.qty * l.unit_price_incl_vat)}</span>
              </div>
              <div className="mt-0.5 text-xs text-muted">
                {l.qty} × {baht(l.unit_price_incl_vat)}
                {!l.variant_id && <span className="ml-2 text-warn">ยังไม่ได้ผูกกับสินค้าในระบบ</span>}
              </div>
            </li>
          ))}
        </ul>
      )}

      {payments.length > 0 && (
        <>
          <h2 className="mt-6 text-sm font-semibold">การรับชำระ ({payments.length})</h2>
          <ul className="mt-2 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
            {payments.map((p) => (
              <li key={p.id} className="flex justify-between gap-3 px-4 py-3 text-sm">
                <span>
                  {p.paid_on}
                  <span className="ml-2 text-xs text-muted">{p.method}</span>
                  {p.ref && <span className="ml-2 text-xs text-muted">{p.ref}</span>}
                </span>
                <span className="shrink-0">{baht(p.amount_incl_vat)}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="mt-6">
        <OrderActions
          orderId={order.id}
          docStatus={order.สถานะเอกสาร}
          balance={order.ยอดค้าง}
          variants={variants}
        />
      </div>
    </>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted">{k}</dt>
      <dd>{v}</dd>
    </div>
  );
}
