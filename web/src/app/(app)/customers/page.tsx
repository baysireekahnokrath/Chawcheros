import Link from 'next/link';
import { getCustomers } from '@/modules/crm/queries';

export default async function CustomersPage({ searchParams }: PageProps<'/customers'>) {
  const { q } = await searchParams;
  const needle = typeof q === 'string' ? q : undefined;
  const rows = await getCustomers(needle);

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">ลูกค้า</h1>
          <p className="mt-1 text-sm text-muted">
            {rows.length} ราย{needle ? ` ที่ตรงกับ “${needle}”` : ''}
          </p>
        </div>
        <Link
          href="/customers/new"
          className="shrink-0 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-accent-fg"
        >
          + ลูกค้าใหม่
        </Link>
      </div>

      <form className="mt-4">
        <input
          name="q"
          defaultValue={needle ?? ''}
          placeholder="ค้นชื่อลูกค้า"
          className="w-full rounded-xl border border-border bg-bg px-3 py-3 text-base outline-none focus:border-accent"
        />
      </form>

      {rows.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-border bg-surface p-4 text-sm text-muted">
          {needle ? 'ไม่เจอลูกค้าที่ค้น' : 'ยังไม่มีลูกค้าในระบบ'}
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
          {rows.map((c) => (
            <li key={c.id}>
              <Link href={`/customers/${c.id}`} className="block px-4 py-3 hover:bg-bg">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-medium">{c.ชื่อลูกค้า}</span>
                  <span className="shrink-0 text-xs text-muted">
                    {c.จำนวนที่อยู่ > 0 ? `${c.จำนวนที่อยู่} ที่อยู่` : 'ยังไม่มีที่อยู่'}
                  </span>
                </div>
                <div className="mt-0.5 text-xs text-muted">
                  {[c.ประเภท, c.เบอร์, c.LINE].filter(Boolean).join(' · ')}
                  {c.สถานะ !== 'ใช้งาน' && <span className="ml-2 text-danger">{c.สถานะ}</span>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
