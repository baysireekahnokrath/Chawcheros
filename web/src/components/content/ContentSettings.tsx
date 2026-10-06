'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createPillar, setPillarActive, createTheme, setThemeActive } from '@/modules/content/actions';
import type { Brand, Pillar, Theme } from '@/modules/content/types';

const input =
  'mt-1.5 w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-base outline-none focus:border-accent';
const panel = 'rounded-2xl border border-border bg-surface p-4';

const fmt = (d: string) => new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });

export default function ContentSettings({ brands, pillars, themes }: { brands: Brand[]; pillars: Pillar[]; themes: Theme[] }) {
  const [brand, setBrand] = useState(brands[0]?.id ?? '');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const myPillars = pillars.filter((p) => p.brand_id === brand);
  const myThemes = themes.filter((t) => t.brand_id === brand);

  function run(fn: () => Promise<{ ok: true } | { ok: false; error: string }>, form?: HTMLFormElement) {
    setError(null);
    start(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error);
      else { form?.reset(); router.refresh(); }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {brands.map((b) => (
          <button key={b.id} onClick={() => setBrand(b.id)} aria-pressed={brand === b.id}
            className={'rounded-full border px-3.5 py-2 text-sm ' + (brand === b.id ? 'border-accent bg-accent text-accent-fg' : 'border-border bg-surface')}>
            {b.name}
          </button>
        ))}
      </div>

      {error && <div className="rounded-2xl border border-danger/40 bg-danger/5 p-4 text-sm text-danger">{error}</div>}

      <section className={panel}>
        <h2 className="text-sm font-medium">Pillar</h2>
        <p className="mt-0.5 text-xs text-muted">หมวดประจำของแบรนด์ · ใช้กรองและระบายสีการ์ดในปฏิทิน</p>
        <ul className="mt-3 divide-y divide-border">
          {myPillars.length === 0 && <li className="py-2 text-sm text-muted">ยังไม่มี</li>}
          {myPillars.map((p) => (
            <li key={p.id} className="flex items-center gap-3 py-2.5">
              <span className="h-4 w-4 shrink-0 rounded" style={{ background: p.color }} />
              <span className={'flex-1 text-sm ' + (p.active ? '' : 'text-muted line-through')}>{p.name}</span>
              <button onClick={() => run(() => setPillarActive(p.id, !p.active))} disabled={pending}
                className="text-xs text-muted underline">{p.active ? 'เลิกใช้' : 'ใช้อีกครั้ง'}</button>
            </li>
          ))}
        </ul>
        <form className="mt-3 flex flex-wrap items-end gap-2 border-t border-border pt-3"
          onSubmit={(e) => { e.preventDefault(); const f = e.currentTarget; const fd = new FormData(f); fd.set('brand_id', brand); run(() => createPillar(fd), f); }}>
          <label className="min-w-0 flex-1 text-sm font-medium" htmlFor="pn">ชื่อ pillar
            <input id="pn" name="name" required className={input} placeholder="เช่น งานช่าง" />
          </label>
          <label className="text-sm font-medium" htmlFor="pc">สี
            <input id="pc" name="color" type="color" defaultValue="#6b5b4a" className="mt-1.5 block h-11 w-14 rounded-xl border border-border bg-bg p-1" />
          </label>
          <button type="submit" disabled={pending} className="h-11 rounded-xl bg-accent px-4 text-sm font-medium text-accent-fg disabled:opacity-50">เพิ่ม</button>
        </form>
      </section>

      <section className={panel}>
        <h2 className="text-sm font-medium">ธีม</h2>
        <p className="mt-0.5 text-xs text-muted">เรื่องที่เล่าช่วงหนึ่ง · คร่อมหลายเดือนได้ · ในธีมเดียวมีได้หลายแคมเปญ</p>
        <ul className="mt-3 divide-y divide-border">
          {myThemes.length === 0 && <li className="py-2 text-sm text-muted">ยังไม่มี</li>}
          {myThemes.map((t) => (
            <li key={t.id} className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <div className={'text-sm ' + (t.active ? '' : 'text-muted line-through')}>{t.name}</div>
                <div className="text-xs text-muted">{fmt(t.starts_on)} – {fmt(t.ends_on)}{t.goal ? ` · ${t.goal}` : ''}</div>
              </div>
              <button onClick={() => run(() => setThemeActive(t.id, !t.active))} disabled={pending}
                className="text-xs text-muted underline">{t.active ? 'เลิกใช้' : 'ใช้อีกครั้ง'}</button>
            </li>
          ))}
        </ul>
        <form className="mt-3 grid gap-2 border-t border-border pt-3 sm:grid-cols-2"
          onSubmit={(e) => { e.preventDefault(); const f = e.currentTarget; const fd = new FormData(f); fd.set('brand_id', brand); run(() => createTheme(fd), f); }}>
          <label className="text-sm font-medium sm:col-span-2" htmlFor="tn">ชื่อธีม
            <input id="tn" name="name" required className={input} placeholder="เช่น ห้องเล็กอยู่สบาย" />
          </label>
          <label className="text-sm font-medium sm:col-span-2" htmlFor="tg">เป้าหมาย <span className="font-normal text-xs text-muted">ไม่บังคับ</span>
            <input id="tg" name="goal" className={input} />
          </label>
          <label className="text-sm font-medium" htmlFor="ts">เริ่ม
            <input id="ts" name="starts_on" type="date" required className={input} />
          </label>
          <label className="text-sm font-medium" htmlFor="te">จบ
            <input id="te" name="ends_on" type="date" required className={input} />
          </label>
          <button type="submit" disabled={pending} className="rounded-xl bg-accent px-4 py-3 text-sm font-medium text-accent-fg disabled:opacity-50 sm:col-span-2">เพิ่มธีม</button>
        </form>
      </section>
    </div>
  );
}
