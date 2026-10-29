'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  addLine,
  cancelOrder,
  confirmOrder,
  recordPayment,
  updateDelivery,
} from '@/modules/sales/actions';
import { PAYMENT_METHODS } from '@/modules/sales/types';

const input =
  'mt-1.5 w-full rounded-xl border border-border bg-bg px-3 py-3 text-base outline-none focus:border-accent';
const label = 'block text-sm font-medium';
const card = 'rounded-2xl border border-border bg-surface p-4';

type Variant = {
  id: string;
  sku: string;
  material_grade: string | null;
  wood_type: string | null;
  configuration: string | null;
  products: { collection: string; categories: { name: string } | null } | null;
};

const describe = (v: Variant) =>
  [v.products?.collection, v.products?.categories?.name, v.configuration, v.material_grade, v.wood_type]
    .filter(Boolean)
    .join(' · ');

export default function OrderActions({
  orderId,
  docStatus,
  balance,
  variants,
}: {
  orderId: string;
  docStatus: string;
  balance: number;
  variants: Variant[];
}) {
  const [tab, setTab] = useState<'line' | 'payment' | 'delivery' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  // เลือกสินค้าเพื่อผูกรายการกับ SKU จริง · ไม่บังคับ ของเก่าเป็นข้อความอิสระได้
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<Variant | null>(null);
  const matches = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    return variants
      .filter((v) => describe(v).toLowerCase().includes(needle) || v.sku.includes(needle))
      .slice(0, 8);
  }, [q, variants]);

  const cancelled = docStatus === 'ยกเลิก';

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    start(async () => {
      const r = await fn();
      if (!r.ok) setError(r.error ?? 'ทำรายการไม่สำเร็จ');
      else {
        setTab(null);
        setPicked(null);
        setQ('');
        router.refresh();
      }
    });
  }

  if (cancelled)
    return (
      <p className={card + ' text-sm text-muted'}>
        ออเดอร์นี้ถูกยกเลิกแล้ว · ข้อมูลยังอยู่ครบ ย้อนดูได้ แต่แก้ไม่ได้
      </p>
    );

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={() => setTab(tab === 'line' ? null : 'line')}
          className={
            'rounded-xl border px-3 py-3 text-sm ' +
            (tab === 'line' ? 'border-accent bg-accent/10 text-accent' : 'border-border bg-surface')
          }
        >
          + รายการ
        </button>
        <button
          onClick={() => setTab(tab === 'payment' ? null : 'payment')}
          className={
            'rounded-xl border px-3 py-3 text-sm ' +
            (tab === 'payment' ? 'border-accent bg-accent/10 text-accent' : 'border-border bg-surface')
          }
        >
          + รับชำระ
        </button>
        <button
          onClick={() => setTab(tab === 'delivery' ? null : 'delivery')}
          className={
            'rounded-xl border px-3 py-3 text-sm ' +
            (tab === 'delivery' ? 'border-accent bg-accent/10 text-accent' : 'border-border bg-surface')
          }
        >
          จัดส่ง
        </button>
      </div>

      {tab === 'line' && (
        <form
          className={card + ' space-y-3'}
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            fd.set('order_id', orderId);
            if (picked) fd.set('variant_id', picked.id);
            run(() => addLine(fd));
          }}
        >
          <div>
            <span className={label}>ผูกกับสินค้าในระบบ (ไม่บังคับ)</span>
            {picked ? (
              <div className="mt-1.5 flex items-center justify-between rounded-xl border border-accent bg-accent/5 px-3 py-2.5 text-sm">
                <span>{describe(picked)}</span>
                <button type="button" onClick={() => setPicked(null)} className="text-muted underline">
                  เอาออก
                </button>
              </div>
            ) : (
              <>
                <input
                  className={input}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="ค้นชื่อรุ่นหรือ SKU"
                />
                {matches.length > 0 && (
                  <ul className="mt-2 divide-y divide-border overflow-hidden rounded-xl border border-border text-sm">
                    {matches.map((v) => (
                      <li key={v.id}>
                        <button
                          type="button"
                          className="block w-full px-3 py-2.5 text-left hover:bg-bg"
                          onClick={() => {
                            setPicked(v);
                            setQ('');
                          }}
                        >
                          {describe(v)}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>

          <label className="block">
            <span className={label}>รายการที่ลูกค้าเห็น</span>
            <textarea
              name="description"
              rows={2}
              className={input}
              required
              defaultValue={picked ? describe(picked) : ''}
              key={picked?.id ?? 'blank'}
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className={label}>จำนวน</span>
              <input name="qty" className={input} inputMode="decimal" required defaultValue="1" />
            </label>
            <label className="block">
              <span className={label}>ราคา/หน่วย (รวม VAT)</span>
              <input name="unit_price" className={input} inputMode="decimal" required />
            </label>
          </div>

          <Submit pending={pending} text="เพิ่มรายการ" />
        </form>
      )}

      {tab === 'payment' && (
        <form
          className={card + ' space-y-3'}
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            fd.set('order_id', orderId);
            run(() => recordPayment(fd));
          }}
        >
          <p className="text-sm text-muted">
            ยอดค้างตอนนี้{' '}
            <span className="font-medium text-text">
              {balance.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
            </span>{' '}
            บาท
          </p>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className={label}>ยอดที่รับ</span>
              <input name="amount" className={input} inputMode="decimal" required autoFocus />
            </label>
            <label className="block">
              <span className={label}>วันที่รับ</span>
              <input name="paid_on" type="date" className={input} />
            </label>
          </div>
          <label className="block">
            <span className={label}>ช่องทาง</span>
            <select name="method" className={input} defaultValue="โอน SCB/TTB">
              {PAYMENT_METHODS.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={label}>เลขอ้างอิง / หมายเหตุ</span>
            <input name="ref" className={input} placeholder="เลขสลิป หรือ มัดจำ 30%" />
          </label>
          <Submit pending={pending} text="บันทึกการรับชำระ" />
          <p className="text-xs text-muted">
            ต้องมีสิทธิ์ฝ่ายการเงิน · ยอดค้างจะคำนวณใหม่เองทันที ไม่มีใครต้องไปแก้ตัวเลข
          </p>
        </form>
      )}

      {tab === 'delivery' && (
        <form
          className={card + ' space-y-3'}
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            fd.set('order_id', orderId);
            run(() => updateDelivery(fd));
          }}
        >
          <label className="block">
            <span className={label}>กำหนดส่ง</span>
            <input name="promised_delivery_on" type="date" className={input} />
          </label>
          <label className="block">
            <span className={label}>ค่าขนส่ง (รวม VAT)</span>
            <input name="shipping_fee" className={input} inputMode="decimal" />
          </label>
          <Submit pending={pending} text="บันทึก" />
        </form>
      )}

      {error && (
        <p className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="flex gap-2 pt-1">
        {docStatus === 'ร่าง' && (
          <button
            disabled={pending}
            onClick={() => run(() => confirmOrder(orderId))}
            className="flex-1 rounded-xl bg-accent px-4 py-3 text-sm font-medium text-accent-fg disabled:opacity-50"
          >
            ยืนยันออเดอร์
          </button>
        )}
        <button
          disabled={pending}
          onClick={() => {
            const reason = window.prompt('ยกเลิกเพราะอะไร');
            if (!reason?.trim()) return;
            const fd = new FormData();
            fd.set('order_id', orderId);
            fd.set('reason', reason);
            run(() => cancelOrder(fd));
          }}
          className="flex-1 rounded-xl border border-danger/40 px-4 py-3 text-sm text-danger disabled:opacity-50"
        >
          ยกเลิกออเดอร์
        </button>
      </div>
    </div>
  );
}

function Submit({ pending, text }: { pending: boolean; text: string }) {
  return (
    <button
      disabled={pending}
      className="w-full rounded-xl bg-accent px-4 py-3 text-sm font-medium text-accent-fg disabled:opacity-50"
    >
      {pending ? 'กำลังบันทึก…' : text}
    </button>
  );
}
