'use client';

import { useState, useTransition } from 'react';
import { createItem } from '@/modules/content/actions';
import { FORMATS } from '@/modules/content/types';

const input =
  'mt-1.5 w-full rounded-xl border border-border bg-bg px-3 py-3 text-base outline-none focus:border-accent';
const label = 'block text-sm font-medium';

/** ช่องทางที่เข้ากับแต่ละความยาว — กันไม่ให้ตั้งคลิปยาวลง TikTok โดยเผลอ */
const FIT: Record<string, string[]> = {
  คลิปยาว: ['youtube', 'facebook', 'website'],
  คลิปสั้น: ['tiktok', 'instagram', 'youtube', 'facebook'],
  หน้าเว็บ: ['website'],
};

export default function NewItemForm({
  channels,
  campaigns,
}: {
  channels: { id: string; name_th: string }[];
  campaigns: { id: string; name: string }[];
}) {
  const [format, setFormat] = useState<string>('คลิปสั้น');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const suggested = FIT[format] ?? [];
  const shown = channels.filter((c) => suggested.includes(c.id));
  const others = channels.filter((c) => !suggested.includes(c.id));

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    start(async () => {
      const res = await createItem(fd);
      if (res && !res.ok) setError(res.error);
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error && (
        <div className="rounded-2xl border border-danger/40 bg-danger/5 p-4 text-sm">
          <div className="font-medium text-danger">ตั้งงานไม่สำเร็จ</div>
          <p className="mt-1">{error}</p>
        </div>
      )}

      <div className="rounded-2xl border border-border bg-surface p-4">
        <div>
          <label className={label} htmlFor="t">เรื่องอะไร</label>
          <input id="t" name="title" required className={input}
            placeholder="เช่น รีวิวโซฟากีวี่ เลือกไม้ได้สองแบบ" />
        </div>

        <div className="mt-3">
          <label className={label} htmlFor="f">ความยาว</label>
          <div className="mt-1.5 grid grid-cols-3 gap-2">
            {FORMATS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFormat(f)}
                className={
                  'rounded-xl border px-3 py-3 text-sm ' +
                  (format === f
                    ? 'border-accent bg-accent/10 font-medium text-accent'
                    : 'border-border')
                }
              >
                {f}
              </button>
            ))}
          </div>
          <input type="hidden" name="format" value={format} />
        </div>

        <div className="mt-3">
          <label className={label} htmlFor="b">จะสื่อสารอะไร (บรีฟ)</label>
          <textarea id="b" name="brief" rows={3} className={input}
            placeholder="เน้นว่าเลือกไม้โอ๊คหรือวอลนัทได้ และผ้าเลือกสีได้" />
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-4">
        <div className="text-sm font-medium">ตั้งใจลงที่ไหนบ้าง</div>
        <p className="mt-0.5 text-xs text-muted">
          เลือกได้หลายที่ · ระบบจะคอยเตือนจนกว่าจะลงครบทุกที่
        </p>

        <div className="mt-3 space-y-2">
          {shown.map((c) => (
            <label key={c.id} className="flex items-center gap-3 rounded-xl border border-border px-3 py-3">
              <input type="checkbox" name="channels" value={c.id}
                className="h-4 w-4 accent-[var(--accent)]" />
              <span className="text-sm">{c.name_th}</span>
            </label>
          ))}
        </div>

        {others.length > 0 && (
          <details className="mt-3">
            <summary className="cursor-pointer text-xs text-muted">ช่องทางอื่น</summary>
            <div className="mt-2 space-y-2">
              {others.map((c) => (
                <label key={c.id} className="flex items-center gap-3 rounded-xl border border-border px-3 py-3">
                  <input type="checkbox" name="channels" value={c.id}
                    className="h-4 w-4 accent-[var(--accent)]" />
                  <span className="text-sm">{c.name_th}</span>
                </label>
              ))}
            </div>
          </details>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-surface p-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label} htmlFor="d">กำหนดเสร็จ</label>
            <input id="d" name="due_on" type="date" className={input} />
          </div>
          <div>
            <label className={label} htmlFor="c">แคมเปญ</label>
            <select id="c" name="campaign_id" defaultValue="" className={input}>
              <option value="">— ไม่ผูก —</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <button type="submit" disabled={pending}
        className="w-full rounded-xl bg-accent px-4 py-3.5 font-medium text-accent-fg disabled:opacity-50">
        {pending ? 'กำลังสร้าง…' : 'ตั้งงาน'}
      </button>
    </form>
  );
}
