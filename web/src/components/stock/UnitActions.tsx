'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { moveUnit, lendUnit, returnUnit } from '@/modules/stock/actions';
import type { Location } from '@/modules/stock/queries';

const STATUSES = ['พร้อมขาย', 'จองแล้ว', 'ตำหนิ'] as const;

type Props = {
  unitCode: string;
  currentStatus: string;
  currentLocationId: string;
  locations: Location[];
};

const input =
  'mt-1.5 w-full rounded-xl border border-border bg-bg px-3 py-3 text-base outline-none focus:border-accent';
const label = 'block text-sm font-medium';

export default function UnitActions({
  unitCode,
  currentStatus,
  currentLocationId,
  locations,
}: Props) {
  const [tab, setTab] = useState<'move' | 'lend' | 'return' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const isLent = currentStatus === 'ยืมออก';

  function submit(
    action: (fd: FormData) => Promise<{ ok: true; data?: string } | { ok: false; error: string }>,
    okMsg: string,
  ) {
    return (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      fd.set('unit_code', unitCode);
      setError(null);
      start(async () => {
        const res = await action(fd);
        if (!res.ok) { setError(res.error); return; }
        setDone(okMsg);
        setTab(null);
        router.refresh();
      });
    };
  }

  const tomorrow = () => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().slice(0, 10);
  };

  return (
    <div className="mt-5 space-y-3">
      {done && (
        <div className="rounded-2xl border border-ok/40 bg-ok/5 p-4 text-sm">
          <span className="font-medium text-ok">{done}</span>
        </div>
      )}
      {error && (
        <div className="rounded-2xl border border-danger/40 bg-danger/5 p-4 text-sm">
          <div className="font-medium text-danger">ทำไม่สำเร็จ</div>
          <p className="mt-1">{error}</p>
        </div>
      )}

      {tab === null && (
        <div className="grid grid-cols-1 gap-2">
          {isLent ? (
            <button
              onClick={() => { setTab('return'); setDone(null); }}
              className="rounded-xl bg-accent px-4 py-4 font-medium text-accent-fg"
            >
              รับคืน
            </button>
          ) : (
            <>
              <button
                onClick={() => { setTab('move'); setDone(null); }}
                className="rounded-xl bg-accent px-4 py-4 font-medium text-accent-fg"
              >
                ย้ายไปที่อื่น
              </button>
              <button
                onClick={() => { setTab('lend'); setDone(null); }}
                className="rounded-xl border border-border px-4 py-4 font-medium"
              >
                ให้ยืมออก
              </button>
            </>
          )}
        </div>
      )}

      {tab === 'move' && (
        <form onSubmit={submit(moveUnit, 'ย้ายเรียบร้อย')} className="rounded-2xl border border-border bg-surface p-4">
          <div>
            <label className={label} htmlFor="mv-loc">ย้ายไปไหน</label>
            <select id="mv-loc" name="location_id" required defaultValue="" className={input}>
              <option value="" disabled>— เลือกปลายทาง —</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id} disabled={l.id === currentLocationId}>
                  {l.name}{l.id === currentLocationId ? ' (อยู่ที่นี่แล้ว)' : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-3">
            <label className={label} htmlFor="mv-st">สถานะ</label>
            <select id="mv-st" name="status" defaultValue="" className={input}>
              <option value="">— คงเดิม ({currentStatus}) —</option>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="mt-3">
            <label className={label} htmlFor="mv-note">หมายเหตุ (ไม่ใส่ก็ได้)</label>
            <input id="mv-note" name="note" className={input} placeholder="เช่น ย้ายไปตั้งโชว์หน้าร้าน" />
          </div>
          <div className="mt-4 flex gap-2">
            <button type="submit" disabled={pending}
              className="flex-1 rounded-xl bg-accent px-4 py-3.5 font-medium text-accent-fg disabled:opacity-50">
              {pending ? 'กำลังย้าย…' : 'ย้ายเลย'}
            </button>
            <button type="button" onClick={() => setTab(null)}
              className="rounded-xl border border-border px-4 py-3.5">ยกเลิก</button>
          </div>
        </form>
      )}

      {tab === 'lend' && (
        <form onSubmit={submit(lendUnit, 'บันทึกการยืมแล้ว')} className="rounded-2xl border border-border bg-surface p-4">
          <div>
            <label className={label} htmlFor="ln-dest">ยืมไปไหน</label>
            <input id="ln-dest" name="destination" required list="loc-names" className={input}
              placeholder="เช่น แฟร์ BITEC ต.ค. 69" />
            <p className="mt-1 text-xs text-muted">
              ถ้าเป็นที่ใหม่ ระบบสร้างให้เอง — พิมพ์ให้ชัดว่างานไหน จะได้ตามคืนถูก
            </p>
          </div>
          <div className="mt-3">
            <label className={label} htmlFor="ln-due">
              กำหนดกลับ <span className="text-danger">*</span>
            </label>
            <input id="ln-due" name="due_back_on" type="date" required defaultValue={tomorrow()}
              className={input} />
            <p className="mt-1 text-xs text-muted">
              ไม่มีกำหนดกลับ = ของที่จะหายไปเฉยๆ ระบบจึงบังคับช่องนี้
            </p>
          </div>
          <div className="mt-3">
            <label className={label} htmlFor="ln-who">ใครยืม</label>
            <input id="ln-who" name="borrower" className={input} placeholder="ชื่อคนรับผิดชอบ" />
          </div>
          <div className="mt-3">
            <label className={label} htmlFor="ln-why">เอาไปทำอะไร</label>
            <input id="ln-why" name="purpose" className={input} placeholder="เช่น ออกบูธ ถ่ายรูป" />
          </div>
          <div className="mt-4 flex gap-2">
            <button type="submit" disabled={pending}
              className="flex-1 rounded-xl bg-accent px-4 py-3.5 font-medium text-accent-fg disabled:opacity-50">
              {pending ? 'กำลังบันทึก…' : 'บันทึกการยืม'}
            </button>
            <button type="button" onClick={() => setTab(null)}
              className="rounded-xl border border-border px-4 py-3.5">ยกเลิก</button>
          </div>
        </form>
      )}

      {tab === 'return' && (
        <form onSubmit={submit(returnUnit, 'รับคืนเรียบร้อย')} className="rounded-2xl border border-border bg-surface p-4">
          <div>
            <label className={label} htmlFor="rt-loc">กลับเข้าที่ไหน</label>
            <select id="rt-loc" name="location_id" required defaultValue="" className={input}>
              <option value="" disabled>— เลือกที่เก็บ —</option>
              {locations.filter((l) => l.is_fixed).map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>
          <div className="mt-3">
            <label className={label} htmlFor="rt-st">สภาพของที่กลับมา</label>
            <select id="rt-st" name="status" defaultValue="พร้อมขาย" className={input}>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <p className="mt-1 text-xs text-muted">ถ้ากลับมาแล้วมีรอย เลือก &ldquo;ตำหนิ&rdquo; ไว้ก่อน</p>
          </div>
          <div className="mt-3">
            <label className={label} htmlFor="rt-note">หมายเหตุ</label>
            <input id="rt-note" name="note" className={input} placeholder="เช่น มีรอยขีดที่ขาซ้าย" />
          </div>
          <div className="mt-4 flex gap-2">
            <button type="submit" disabled={pending}
              className="flex-1 rounded-xl bg-accent px-4 py-3.5 font-medium text-accent-fg disabled:opacity-50">
              {pending ? 'กำลังรับคืน…' : 'รับคืน'}
            </button>
            <button type="button" onClick={() => setTab(null)}
              className="rounded-xl border border-border px-4 py-3.5">ยกเลิก</button>
          </div>
        </form>
      )}

      <datalist id="loc-names">
        {locations.map((l) => <option key={l.id} value={l.name} />)}
      </datalist>
    </div>
  );
}
