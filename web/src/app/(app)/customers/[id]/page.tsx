import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCustomer } from '@/modules/crm/queries';
import AddressForm from '@/components/crm/AddressForm';

export default async function CustomerPage({ params }: PageProps<'/customers/[id]'>) {
  const { id } = await params;
  const found = await getCustomer(id);
  if (!found) notFound();
  const { customer, addresses } = found;

  const contact = [
    ['เบอร์', customer.phone],
    ['LINE', customer.line_id],
    ['อีเมล', customer.email],
    ['Facebook', customer.facebook],
    ['Instagram', customer.instagram],
    ['เลขผู้เสียภาษี', customer.tax_id],
  ].filter(([, v]) => v) as [string, string][];

  return (
    <>
      <Link href="/customers" className="text-sm text-muted">
        ← ลูกค้า
      </Link>
      <h1 className="mt-2 text-xl font-semibold tracking-tight">{customer.name}</h1>
      <p className="mt-1 text-sm text-muted">
        {customer.kind}
        {customer.status !== 'ใช้งาน' && <span className="ml-2 text-danger">{customer.status}</span>}
      </p>

      {contact.length > 0 && (
        <dl className="mt-4 grid gap-x-4 gap-y-2 rounded-2xl border border-border bg-surface p-4 text-sm sm:grid-cols-2">
          {contact.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3">
              <dt className="text-muted">{k}</dt>
              <dd className="text-right">{v}</dd>
            </div>
          ))}
        </dl>
      )}

      {customer.note && (
        <p className="mt-3 rounded-2xl border border-border bg-surface p-4 text-sm">{customer.note}</p>
      )}

      <h2 className="mt-6 text-sm font-semibold">สาขา / ที่อยู่</h2>
      {addresses.length === 0 ? (
        <p className="mt-2 text-sm text-muted">ยังไม่มีที่อยู่ — ต้องมีอย่างน้อยหนึ่งที่ถึงจะระบุที่ส่งในออเดอร์ได้</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {addresses.map((a) => (
            <li key={a.id} className="rounded-2xl border border-border bg-surface p-4">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-medium">
                  {a.label}
                  {a.is_default && (
                    <span className="ml-2 rounded-md bg-accent/10 px-1.5 py-0.5 text-[11px] text-accent">
                      ที่อยู่หลัก
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-xs text-muted">{a.kind}</span>
              </div>
              <p className="mt-1 text-sm text-muted">{a.address}</p>
              {(a.contact_name || a.contact_phone) && (
                <p className="mt-1 text-xs text-muted">
                  {[a.contact_name, a.contact_phone].filter(Boolean).join(' · ')}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      <AddressForm customerId={customer.id} />
    </>
  );
}
