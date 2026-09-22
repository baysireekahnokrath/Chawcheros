import Link from 'next/link';
import { findUnit, getUnitHistory } from '@/modules/stock/actions';
import { getLocations } from '@/modules/stock/queries';
import UnitActions from '@/components/stock/UnitActions';

export const metadata = { title: 'ตัวสินค้า · Chaw Cher OS' };

const TONE: Record<string, string> = {
  พร้อมขาย: 'bg-ok/10 text-ok',
  จองแล้ว: 'bg-warn/10 text-warn',
  ตำหนิ: 'bg-danger/10 text-danger',
  ยืมออก: 'bg-locked/10 text-locked',
  ส่งแล้ว: 'bg-border text-muted',
};

/**
 * หน้านี้คือปลายทางของ QR บนสติกเกอร์
 *
 * QR เก็บลิงก์มาที่หน้านี้ตรงๆ จะได้ส่องด้วยกล้องมือถือเปล่าๆ ได้เลย
 * ไม่ต้องลงแอป ไม่ต้องซื้อเครื่องสแกน ไม่ต้องขอสิทธิ์กล้องในเว็บ
 * ซึ่งสำคัญมากเพราะคนหน้าคลังจะไม่ยอมลงแอปเพื่อย้ายของหนึ่งตัว
 */
export default async function UnitPage({ params }: PageProps<'/stock/u/[code]'>) {
  const { code } = await params;
  const res = await findUnit(decodeURIComponent(code));

  if (!res.ok) {
    return (
      <>
        <Link href="/stock" className="text-sm text-muted">← คลัง</Link>
        <div className="mt-4 rounded-2xl border border-danger/40 bg-danger/5 p-5">
          <div className="font-medium text-danger">หาไม่เจอ</div>
          <p className="mt-1 text-sm">{res.error}</p>
          <Link
            href="/stock/scan"
            role="button"
            className="mt-4 block rounded-xl bg-accent px-4 py-3 text-center font-medium text-accent-fg"
          >
            ลองใหม่
          </Link>
        </div>
      </>
    );
  }

  const u = res.unit as unknown as {
    id: string; unit_code: string; status: string; note: string | null;
    serial_no: string | null; made_at: string | null; made_on: string | null; made_by: string | null;
    location_id: string;
    locations: { name: string } | null;
    product_variants: {
      sku: string; material_grade: string | null; wood_type: string | null;
      configuration: string | null; width_cm: number | null; depth_cm: number | null;
      height_cm: number | null; products: { collection: string } | null;
    } | null;
  };

  const [locations, history] = await Promise.all([getLocations(), getUnitHistory(u.id)]);
  const v = u.product_variants;
  const spec = [v?.material_grade, v?.wood_type, v?.configuration].filter(Boolean).join(' · ');

  return (
    <>
      <Link href="/stock" className="text-sm text-muted">← คลัง</Link>

      <div className="mt-3 rounded-2xl border border-border bg-surface p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-mono text-lg font-semibold tracking-tight">{u.unit_code}</div>
            <div className="mt-1 text-sm">{v?.products?.collection ?? '—'}</div>
            {spec && <div className="text-sm text-muted">{spec}</div>}
          </div>
          <span className={`shrink-0 rounded-lg px-2.5 py-1 text-xs ${TONE[u.status] ?? ''}`}>
            {u.status}
          </span>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-border pt-4 text-sm">
          <dt className="text-muted">อยู่ที่</dt>
          <dd className="text-right font-medium">{u.locations?.name ?? '—'}</dd>
          <dt className="text-muted">ขนาด</dt>
          <dd className="text-right">
            {[v?.width_cm, v?.depth_cm, v?.height_cm].map((x) => x ?? '—').join('×')} cm
          </dd>
          {u.serial_no && (<><dt className="text-muted">Serial</dt><dd className="text-right font-mono text-xs">{u.serial_no}</dd></>)}
          {u.made_at && (<><dt className="text-muted">ผลิตที่</dt><dd className="text-right">{u.made_at}</dd></>)}
          {u.made_on && (<><dt className="text-muted">ผลิตวันที่</dt><dd className="text-right">{u.made_on}</dd></>)}
          {u.made_by && (<><dt className="text-muted">ใครผลิต</dt><dd className="text-right">{u.made_by}</dd></>)}
          {u.note && (<><dt className="text-muted">หมายเหตุ</dt><dd className="text-right">{u.note}</dd></>)}
        </dl>
      </div>

      <UnitActions
        unitCode={u.unit_code}
        currentStatus={u.status}
        currentLocationId={u.location_id}
        locations={locations}
      />

      <section className="mt-6">
        <h2 className="mb-2 text-sm font-medium text-muted">ประวัติการย้าย</h2>
        <ol className="space-y-2">
          {history.map((h) => (
            <li key={h.id} className="rounded-xl border border-border bg-surface px-4 py-3 text-sm">
              <div className="flex items-baseline justify-between gap-2">
                <span>
                  {h.from?.name ? `${h.from.name} → ` : 'รับเข้า → '}
                  <span className="font-medium">{h.to?.name}</span>
                </span>
                <span className="shrink-0 text-xs text-muted">
                  {new Date(h.moved_at).toLocaleDateString('th-TH', { dateStyle: 'medium' })}
                </span>
              </div>
              <div className="mt-0.5 text-xs text-muted">
                {h.from_status && h.from_status !== h.to_status
                  ? `${h.from_status} → ${h.to_status}`
                  : h.to_status}
                {h.note ? ` · ${h.note}` : ''}
              </div>
            </li>
          ))}
        </ol>
        {history.length === 0 && (
          <p className="rounded-xl border border-border bg-surface p-4 text-sm text-muted">
            ยังไม่มีประวัติ
          </p>
        )}
      </section>
    </>
  );
}
