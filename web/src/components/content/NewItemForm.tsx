'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { createItem } from '@/modules/content/actions';
import {
  PHASE1_FORMATS, PHASE1_CHANNELS,
  type Brand, type Pillar, type Theme, type Model, type Person,
} from '@/modules/content/types';

const input =
  'mt-1.5 w-full rounded-xl border border-border bg-bg px-3 py-3 text-base outline-none focus:border-accent';
const label = 'block text-sm font-medium';
const hint = 'font-normal text-muted text-xs';
const chip = (on: boolean) =>
  'rounded-full border px-3.5 py-2 text-sm ' +
  (on ? 'border-accent bg-accent text-accent-fg' : 'border-border bg-surface');

type Props = {
  brands: Brand[];
  pillars: Pillar[];
  themes: Theme[];
  campaigns: { id: string; name: string }[];
  models: Model[];
  team: Person[];
  me: string | null;
};

export default function NewItemForm({ brands, pillars, themes, campaigns, models, team, me }: Props) {
  const [brand, setBrand] = useState(brands[0]?.id ?? '');
  const [format, setFormat] = useState<string>('ภาพเดี่ยว');
  const [channels, setChannels] = useState<string[]>(['facebook', 'instagram']);
  const [picked, setPicked] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const textOnly = format === 'ข้อความล้วน';
  const live = textOnly ? channels.filter((c) => c !== 'instagram') : channels;
  const today = new Date().toISOString().slice(0, 10);
  const myPillars = pillars.filter((p) => p.brand_id === brand && p.active);
  const myThemes = themes.filter((t) => t.brand_id === brand && t.active && t.ends_on >= today);
  const myModels = models.filter((m) => m.brand_id === brand);

  function toggle(list: string[], v: string) {
    return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.delete('channels');
    live.forEach((c) => fd.append('channels', c));
    picked.forEach((m) => fd.append('models', m));
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

      <div className="rounded-2xl border border-border bg-surface p-4 space-y-4">
        <div>
          <span className={label}>แบรนด์</span>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {brands.map((b) => (
              <button key={b.id} type="button" onClick={() => { setBrand(b.id); setPicked([]); }}
                className={chip(brand === b.id)} aria-pressed={brand === b.id}>
                {b.name}
              </button>
            ))}
          </div>
          <input type="hidden" name="brand_id" value={brand} />
        </div>

        <div>
          <span className={label}>ประเภท</span>
          <div className="mt-1.5 grid grid-cols-3 gap-2">
            {PHASE1_FORMATS.map((f) => (
              <button key={f} type="button" onClick={() => setFormat(f)} aria-pressed={format === f}
                className={
                  'rounded-xl border px-3 py-3 text-sm ' +
                  (format === f ? 'border-accent bg-accent/10 font-medium text-accent' : 'border-border')
                }>
                {f}
              </button>
            ))}
          </div>
          <input type="hidden" name="format" value={format} />
        </div>

        <div>
          <span className={label}>ลงที่ไหน วันไหน</span>
          <div className="mt-1.5 space-y-2">
            {PHASE1_CHANNELS.map((c) => {
              const blocked = c.id === 'instagram' && textOnly;
              const on = live.includes(c.id);
              return (
                <div key={c.id}
                  className={'flex flex-wrap items-center gap-3 rounded-xl border px-3 py-2.5 ' + (blocked ? 'border-border opacity-50' : 'border-border')}>
                  <label className="flex flex-1 items-center gap-3">
                    <input type="checkbox" checked={on} disabled={blocked}
                      onChange={() => setChannels(toggle(channels, c.id))}
                      className="h-4 w-4 accent-[var(--accent)]" />
                    <span className="text-sm">{c.name}</span>
                  </label>
                  {on && (
                    <input type="date" name={`date_${c.id}`} aria-label={`วันลง ${c.name}`}
                      className="rounded-lg border border-border bg-bg px-2 py-1.5 text-sm" />
                  )}
                </div>
              );
            })}
          </div>
          {textOnly && <p className="mt-1.5 text-xs text-muted">ข้อความล้วนลง Instagram ไม่ได้ เพราะ IG ต้องมีภาพ</p>}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-4 space-y-3">
        <div className="text-sm font-medium">Brief</div>
        <div>
          <label className={label} htmlFor="hook">Hook <span className={hint}>ประโยคหรือภาพที่ทำให้หยุดดู</span></label>
          <input id="hook" name="hook" required className={input} placeholder="เช่น ห้อง 28 ตร.ม. วางโซฟา 3 ที่นั่งได้ไหม" />
        </div>
        <div>
          <label className={label} htmlFor="km">เนื้อหา <span className={hint}>ข้อความหลักข้อเดียว</span></label>
          <input id="km" name="key_message" className={input} placeholder="เช่น เลือกขาเรียว พนักต่ำ ห้องเล็กก็ดูโปร่ง" />
        </div>
        {!textOnly && (
          <div>
            <label className={label} htmlFor="vs">Visual <span className={hint}>ภาพที่ต้องได้</span></label>
            <input id="vs" name="visual" className={input} placeholder="เช่น บ้านลูกค้าจริง ถ่ายมุมกว้าง" />
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-surface p-4">
        <div className="text-sm font-medium">ผูกกับ <span className={hint}>ไม่บังคับทุกช่อง</span></div>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <div>
            <label className={label} htmlFor="pl">Pillar</label>
            <select id="pl" name="pillar_id" defaultValue="" className={input} key={`p-${brand}`}>
              <option value="">ไม่ผูก</option>
              {myPillars.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className={label} htmlFor="th">ธีม</label>
            <select id="th" name="theme_id" defaultValue="" className={input} key={`t-${brand}`}>
              <option value="">ไม่ผูก</option>
              {myThemes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className={label} htmlFor="cp">แคมเปญ</label>
            <select id="cp" name="campaign_id" defaultValue="" className={input}>
              <option value="">ไม่ผูก</option>
              {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className={label} htmlFor="ow">คนทำ{!textOnly && ' (ภาพ)'}</label>
            <select id="ow" name="owner_id" defaultValue={me ?? ''} className={input}>
              <option value="">ยังไม่ระบุ</option>
              {team.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
            </select>
          </div>
        </div>

        {myModels.length > 0 && (
          <div className="mt-3">
            <span className={label}>สินค้าที่พูดถึง <span className={hint}>เลือกได้หลายรุ่น</span></span>
            <div className="mt-1.5 flex max-h-44 flex-wrap gap-1.5 overflow-y-auto">
              {myModels.map((m) => (
                <button key={m.id} type="button" onClick={() => setPicked(toggle(picked, m.id))}
                  aria-pressed={picked.includes(m.id)}
                  className={'rounded-full border px-3 py-1.5 text-xs ' + (picked.includes(m.id) ? 'border-accent bg-accent text-accent-fg' : 'border-border')}>
                  {m.collection}{m.name_th ? ` · ${m.name_th}` : ''}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-3">
          <label className={label} htmlFor="src">ลิงก์ต้นทาง <span className={hint}>ไอเดียมาจากเลขา AI หรือประชุม</span></label>
          <input id="src" name="source_url" type="url" className={input} placeholder="https://…" />
        </div>
      </div>

      {myPillars.length === 0 && (
        <p className="text-xs text-muted">
          แบรนด์นี้ยังไม่มี pillar หรือธีม · ตั้งได้ที่ <Link href="/content/settings" className="underline">ตั้งค่าคอนเทนต์</Link>
        </p>
      )}

      <button type="submit" disabled={pending || live.length === 0}
        className="w-full rounded-xl bg-accent px-4 py-3.5 font-medium text-accent-fg disabled:opacity-50">
        {pending ? 'กำลังตั้งงาน…' : 'ตั้งงาน'}
      </button>
    </form>
  );
}
