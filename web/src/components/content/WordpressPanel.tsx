'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { sendToWordpress, checkWordpress, type WpResult } from '@/modules/content/wp-actions';
import type { Placement } from '@/modules/content/types';

const panel = 'rounded-2xl border border-border bg-surface p-4';
const field = 'mt-1 w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-sm outline-none focus:border-accent';

/**
 * ส่งบทความเข้า WordPress (W-01–08)
 * ตรวจผ่าน → ส่งเป็น Draft → คนกด Publish ใน wp-admin → ระบบเห็นเอง ใส่ลิงก์ + เริ่มนับว่าลงแล้ว
 */
export default function WordpressPanel({ p, itemId, readyToSend, categories, connected, site }: {
  p: Placement;
  itemId: string;
  readyToSend: boolean;
  categories: string[];
  connected: boolean;
  site: string;
}) {
  const [cat, setCat] = useState(p.web_category ?? '');
  const [slug, setSlug] = useState(p.web_slug ?? '');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const sent = !!p.wp_post_id;
  const live = !!p.published_url;
  const step = live ? 4 : sent ? 3 : readyToSend ? 1 : 0;
  const steps = ['ตรวจผ่าน', 'ส่งเข้า WordPress', 'Draft', 'Publish (คนกด)', 'ขึ้นเว็บ'];
  const editUrl = p.wp_post_id ? `${site}/wp-admin/post.php?post=${p.wp_post_id}&action=edit` : null;

  function run(fn: () => Promise<WpResult>) {
    setMsg(null);
    start(async () => {
      const r = await fn();
      setMsg(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error });
      router.refresh();
    });
  }

  return (
    <section className={panel + ' space-y-3'} aria-label="WordPress">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium">WordPress</h2>
        <a href={`${site}/wp-admin/`} target="_blank" rel="noreferrer" className="text-xs text-muted underline">แอดมินเว็บ ↗</a>
      </div>

      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted">
        {steps.map((s, i) => (
          <li key={s} className={i < step ? 'font-semibold text-ok' : i === step ? 'font-semibold text-text' : ''}>
            {i < step ? '✓ ' : ''}{s}{i < steps.length - 1 && <span className="ml-1.5 font-normal text-muted">→</span>}
          </li>
        ))}
      </ol>

      {!connected && (
        <p className="rounded-xl border border-warn/40 bg-warn/5 px-3 py-2 text-xs">ยังไม่ได้ต่อ WordPress · ดูที่ แบรนด์ → เชื่อมต่อ</p>
      )}

      {live ? (
        <div className="space-y-1 text-sm">
          <p className="text-ok">✓ ขึ้นเว็บแล้ว{p.published_at ? ` · ${new Date(p.published_at).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : ''}</p>
          <a href={p.published_url!} target="_blank" rel="noreferrer" className="break-all text-xs text-accent underline">{p.published_url}</a>
          <p className="text-xs text-muted">ระบบไม่แก้บทความที่ขึ้นเว็บแล้ว · ถ้าจะแก้ ทำใน wp-admin</p>
        </div>
      ) : (
        <>
          {sent && (
            <div className="space-y-1 rounded-xl bg-ok/5 px-3 py-2 text-sm">
              <p className="text-ok">✓ เป็น Draft ใน WordPress แล้ว (#{p.wp_post_id})
                {p.wp_sent_at && <span className="text-xs text-muted"> · {new Date(p.wp_sent_at).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>}
              </p>
              <p className="text-xs text-muted">เปิดดูหน้าตาใน wp-admin แล้วกด Publish เอง · ระบบเห็นเองภายใน 10 นาทีหลังเปิดหน้านี้ หรือกด &quot;เช็กตอนนี้&quot;</p>
            </div>
          )}
          {p.wp_note && (
            <div className="rounded-xl border border-warn/40 bg-warn/5 px-3 py-2 text-xs">
              <p className="font-medium">ต้องทำต่อใน wp-admin</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4">{p.wp_note.split('\n').map((n) => <li key={n}>{n}</li>)}</ul>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-medium">หมวด <span className="font-normal text-muted">agent เลือกให้ เปลี่ยนได้</span>
              <select value={cat} onChange={(e) => setCat(e.target.value)} className={field} disabled={pending}>
                <option value="">ยังไม่เลือก (เลือกใน wp-admin)</option>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                {cat && !categories.includes(cat) && <option value={cat}>{cat} (ไม่มีบนเว็บ)</option>}
              </select>
            </label>
            <label className="block text-xs font-medium">Slug <span className="font-normal text-muted">ภาษาอังกฤษ · ว่าง = เว็บตั้งเอง</span>
              <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="small-living-room-sofa" className={field} disabled={pending} />
            </label>
          </div>

          {!readyToSend && <p className="text-xs text-muted">ส่งได้เมื่อบทความ (และภาพ) ผ่านตรวจแล้ว</p>}

          <div className="flex flex-wrap gap-2">
            <button onClick={() => run(() => sendToWordpress(p.id, itemId, { category: cat || null, slug: slug || null }))}
              disabled={pending || !readyToSend || !connected}
              className="rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-accent-fg disabled:opacity-40">
              {pending ? 'กำลังส่ง…' : sent ? 'ส่งซ้ำ (อัปเดต Draft เดิม)' : 'ส่งเข้า WordPress เป็น Draft'}
            </button>
            {editUrl && (
              <a href={editUrl} target="_blank" rel="noreferrer" className="rounded-xl border border-border px-4 py-2.5 text-sm">เปิดใน wp-admin ↗</a>
            )}
            {sent && (
              <button onClick={() => run(() => checkWordpress(p.id, itemId))} disabled={pending}
                className="rounded-xl border border-border px-4 py-2.5 text-sm disabled:opacity-40">เช็กตอนนี้</button>
            )}
          </div>
          <p className="text-xs text-muted">ส่งเป็น Draft เท่านั้น · ผู้ใช้ที่ระบบใช้เป็น Author จึง Publish เองไม่ได้ · คนกด Publish ใน wp-admin</p>
        </>
      )}

      {msg && <p role="status" className={'text-sm ' + (msg.ok ? 'text-ok' : 'text-danger')}>{msg.text}</p>}
    </section>
  );
}
