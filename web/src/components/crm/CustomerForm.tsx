'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createCustomer } from '@/modules/crm/actions';

const input =
  'mt-1.5 w-full rounded-xl border border-border bg-bg px-3 py-3 text-base outline-none focus:border-accent';
const label = 'block text-sm font-medium';

export default function CustomerForm() {
  const [kind, setKind] = useState('บุคคล');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    start(async () => {
      const r = await createCustomer(fd);
      if (!r.ok) setError(r.error);
      else router.push(`/customers/${r.data}`);
    });
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <div>
        <span className={label}>ประเภท</span>
        <div className="mt-1.5 flex gap-2">
          {['บุคคล', 'นิติบุคคล'].map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={
                'flex-1 rounded-xl border px-3 py-3 text-sm ' +
                (kind === k
                  ? 'border-accent bg-accent/10 font-medium text-accent'
                  : 'border-border bg-surface')
              }
            >
              {k}
            </button>
          ))}
        </div>
        <input type="hidden" name="kind" value={kind} />
      </div>

      <label className="block">
        <span className={label}>ชื่อลูกค้า</span>
        <input name="name" className={input} required autoFocus
          placeholder={kind === 'นิติบุคคล' ? 'บจก.อุรา กรุงเทพ คลินิก' : 'คุณตาก'} />
      </label>

      {kind === 'นิติบุคคล' && (
        <label className="block">
          <span className={label}>เลขผู้เสียภาษี</span>
          <input name="tax_id" className={input} inputMode="numeric" placeholder="0105562061928" />
          <span className="mt-1 block text-xs text-muted">
            ใส่ไว้แล้วระบบกันสร้างลูกค้ารายเดิมซ้ำให้
          </span>
        </label>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className={label}>เบอร์ติดต่อ</span>
          <input name="phone" className={input} inputMode="tel" />
        </label>
        <label className="block">
          <span className={label}>LINE</span>
          <input name="line_id" className={input} />
        </label>
        <label className="block">
          <span className={label}>อีเมล</span>
          <input name="email" type="email" className={input} />
        </label>
        <label className="block">
          <span className={label}>Facebook</span>
          <input name="facebook" className={input} />
        </label>
      </div>

      <label className="block">
        <span className={label}>หมายเหตุ</span>
        <textarea name="note" rows={2} className={input} />
      </label>

      {error && (
        <p className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
          {error}
        </p>
      )}

      <button
        disabled={pending}
        className="w-full rounded-xl bg-accent px-4 py-3 font-medium text-accent-fg disabled:opacity-50"
      >
        {pending ? 'กำลังบันทึก…' : 'บันทึกลูกค้า'}
      </button>
    </form>
  );
}
