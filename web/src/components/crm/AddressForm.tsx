'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { addAddress } from '@/modules/crm/actions';

const input =
  'mt-1.5 w-full rounded-xl border border-border bg-bg px-3 py-3 text-base outline-none focus:border-accent';
const label = 'block text-sm font-medium';

export default function AddressForm({ customerId }: { customerId: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  if (!open)
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-3 w-full rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted hover:border-accent hover:text-accent"
      >
        + เพิ่มสาขา / ที่อยู่
      </button>
    );

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set('customer_id', customerId);
    setError(null);
    start(async () => {
      const r = await addAddress(fd);
      if (!r.ok) setError(r.error);
      else {
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="mt-3 space-y-3 rounded-xl border border-border bg-surface p-4">
      <label className="block">
        <span className={label}>ชื่อที่คนเรียกกัน</span>
        <input name="label" className={input} required autoFocus placeholder="สาขา C KHON" />
      </label>

      <label className="block">
        <span className={label}>ใช้เป็น</span>
        <select name="kind" className={input} defaultValue="จัดส่ง">
          <option>จัดส่ง</option>
          <option>ใบกำกับภาษี</option>
          <option>ทั้งสองอย่าง</option>
        </select>
      </label>

      <label className="block">
        <span className={label}>ที่อยู่</span>
        <textarea name="address" rows={3} className={input} required />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className={label}>ผู้ติดต่อ</span>
          <input name="contact_name" className={input} placeholder="คุณตาก" />
        </label>
        <label className="block">
          <span className={label}>เบอร์ที่สาขานี้</span>
          <input name="contact_phone" className={input} inputMode="tel" />
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="is_default" className="size-4" />
        ใช้เป็นที่อยู่หลักของลูกค้ารายนี้
      </label>

      {error && (
        <p className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="flex-1 rounded-xl border border-border px-4 py-3 text-sm"
        >
          ยกเลิก
        </button>
        <button
          disabled={pending}
          className="flex-1 rounded-xl bg-accent px-4 py-3 text-sm font-medium text-accent-fg disabled:opacity-50"
        >
          {pending ? 'กำลังบันทึก…' : 'บันทึก'}
        </button>
      </div>
    </form>
  );
}
