'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createOrder } from '@/modules/sales/actions';
import { CHANNELS } from '@/modules/sales/types';

const input =
  'mt-1.5 w-full rounded-xl border border-border bg-bg px-3 py-3 text-base outline-none focus:border-accent';
const label = 'block text-sm font-medium';

type Customer = {
  id: string;
  name: string;
  phone: string | null;
  customer_addresses: { id: string; label: string; kind: string; status: string }[];
};

export default function OrderForm({ customers }: { customers: Customer[] }) {
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<Customer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const matches = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    return customers
      .filter(
        (c) =>
          c.name.toLowerCase().includes(needle) || (c.phone ?? '').includes(needle),
      )
      .slice(0, 10);
  }, [q, customers]);

  const addresses = (picked?.customer_addresses ?? []).filter(
    (a) => a.status === 'ใช้งาน' && a.kind !== 'ใบกำกับภาษี',
  );

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!picked) {
      setError('ยังไม่ได้เลือกลูกค้า');
      return;
    }
    const fd = new FormData(e.currentTarget);
    fd.set('customer_id', picked.id);
    setError(null);
    start(async () => {
      const r = await createOrder(fd);
      if (!r.ok) setError(r.error);
      else router.push(`/orders/${r.data}`);
    });
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <div>
        <span className={label}>ลูกค้า</span>
        {picked ? (
          <div className="mt-1.5 flex items-center justify-between rounded-xl border border-accent bg-accent/5 px-3 py-3">
            <div>
              <div className="font-medium">{picked.name}</div>
              {picked.phone && <div className="text-xs text-muted">{picked.phone}</div>}
            </div>
            <button
              type="button"
              onClick={() => setPicked(null)}
              className="text-sm text-muted underline"
            >
              เปลี่ยน
            </button>
          </div>
        ) : (
          <>
            <input
              className={input}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="พิมพ์ชื่อหรือเบอร์เพื่อค้นหา"
              autoFocus
            />
            {matches.length > 0 && (
              <ul className="mt-2 divide-y divide-border overflow-hidden rounded-xl border border-border">
                {matches.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setPicked(c);
                        setQ('');
                      }}
                      className="block w-full px-3 py-3 text-left hover:bg-bg"
                    >
                      <span className="font-medium">{c.name}</span>
                      {c.phone && <span className="ml-2 text-xs text-muted">{c.phone}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {q.trim() && matches.length === 0 && (
              <p className="mt-2 text-sm text-muted">
                ไม่เจอ —{' '}
                <Link href="/customers/new" className="text-accent underline">
                  สร้างลูกค้าใหม่
                </Link>
              </p>
            )}
          </>
        )}
      </div>

      {picked && (
        <label className="block">
          <span className={label}>ส่งที่</span>
          {addresses.length > 0 ? (
            <select name="shipping_address_id" className={input} defaultValue="">
              <option value="">— ยังไม่ระบุ —</option>
              {addresses.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          ) : (
            <p className="mt-1.5 rounded-xl border border-border bg-surface p-3 text-sm text-muted">
              ลูกค้ารายนี้ยังไม่มีที่อยู่ —{' '}
              <Link href={`/customers/${picked.id}`} className="text-accent underline">
                เพิ่มที่อยู่ก่อน
              </Link>
            </p>
          )}
        </label>
      )}

      <label className="block">
        <span className={label}>เลขที่ออเดอร์</span>
        <input name="order_no" className={input} required placeholder="BLS3167" />
        <span className="mt-1 block text-xs text-muted">
          ใช้เลขเดียวกับที่ใช้อยู่ทุกวันนี้ · ระบบกันเลขซ้ำให้
        </span>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className={label}>ช่องทาง</span>
          <select name="channel" className={input} defaultValue="ขายตรง">
            {CHANNELS.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={label}>วันที่สั่ง</span>
          <input name="ordered_on" type="date" className={input} />
        </label>
      </div>

      {error && (
        <p className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
          {error}
        </p>
      )}

      <button
        disabled={pending}
        className="w-full rounded-xl bg-accent px-4 py-3 font-medium text-accent-fg disabled:opacity-50"
      >
        {pending ? 'กำลังสร้าง…' : 'สร้างออเดอร์'}
      </button>
      <p className="text-center text-xs text-muted">
        สร้างแล้วเป็น &ldquo;ร่าง&rdquo; ก่อน · ใส่รายการสินค้าแล้วค่อยกดยืนยัน
      </p>
    </form>
  );
}
