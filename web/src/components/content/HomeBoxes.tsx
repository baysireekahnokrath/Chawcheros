'use client';

/**
 * กล่องบนหน้าแรกที่กดทำได้ในกล่องเลย (R5)
 * H2 ตอบคำถาม agent · H3 ยืนยันสมุด · H16 แฟ้มคู่แข่ง · H19 ไอเดียจาก agent
 */
import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  answerQuestions, updateNote, addSwipe, resummarizeSwipe, archiveSwipe, makeIdeas, decideIdea,
} from '@/modules/content/agent-actions';
import type { AgentQuestion, NotebookEntry, Brand } from '@/modules/content/types';
import type { Swipe, Suggestion } from '@/modules/content/dashboard';

type R = { ok: true } | { ok: false; error: string };
const panel = 'rounded-2xl border border-border bg-surface p-4';
const btn2 = 'rounded-xl border border-border px-3 py-1.5 text-sm disabled:opacity-50';

function useRun() {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const run = (fn: () => Promise<R | { ok: boolean; error?: string }>, after?: () => void) => {
    setError(null);
    start(async () => {
      const r = await fn();
      if (!r.ok) setError(('error' in r && r.error) || 'ทำไม่สำเร็จ');
      else { after?.(); router.refresh(); }
    });
  };
  return { error, pending, run };
}

// ── H2 agent ถามพี่อยู่ ──
export function AsksBox({ asks, canAnswer }: { asks: (AgentQuestion & { item: string })[]; canAnswer: boolean }) {
  const { error, pending, run } = useRun();
  const [pick, setPick] = useState<Record<string, string>>({});
  if (asks.length === 0) return null;
  return (
    <section className={panel + ' border-accent/40'}>
      <h2 className="text-sm font-medium">agent ถามพี่อยู่ · {asks.length} ข้อ</h2>
      <ul className="mt-2 space-y-3">
        {asks.slice(0, 4).map((q) => (
          <li key={q.id}>
            <Link href={`/content/${q.item_id}`} className="text-xs text-muted underline">{q.item}</Link>
            <p className="text-sm">{q.question}</p>
            {canAnswer && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {q.choices.map((c) => (
                  <button key={c} disabled={pending} onClick={() => setPick({ ...pick, [q.id]: c })}
                    className={'rounded-full border px-3 py-1 text-sm ' + (pick[q.id] === c ? 'border-accent bg-accent text-accent-fg' : 'border-border bg-bg')}>
                    {c}
                  </button>
                ))}
                {pick[q.id] && (
                  <button disabled={pending} onClick={() => run(() => answerQuestions(q.item_id, [{ id: q.id, answer: pick[q.id] }]))}
                    className="rounded-full bg-accent px-3 py-1 text-sm font-medium text-accent-fg disabled:opacity-50">
                    {pending ? 'agent กำลังเขียน…' : 'ตอบ'}
                  </button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
      {asks.length > 4 && <p className="mt-2 text-xs text-muted">และอีก {asks.length - 4} ข้อในหน้าชิ้นงาน</p>}
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </section>
  );
}

// ── H3 สมุดรอยืนยัน ──
export function NotebookBox({ notes, isAdmin }: { notes: NotebookEntry[]; isAdmin: boolean }) {
  const { error, pending, run } = useRun();
  if (notes.length === 0) return null;
  return (
    <section className={panel}>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium">สมุดรอยืนยัน · {notes.length} ข้อ</h2>
        <Link href="/content/brain?tab=notebook" className="text-xs text-muted underline">เปิดสมุด</Link>
      </div>
      <ul className="mt-2 divide-y divide-border">
        {notes.slice(0, 4).map((n) => (
          <li key={n.id} className="flex items-start justify-between gap-2 py-2">
            <div className="min-w-0 text-sm">
              <p>{n.body}</p>
              {n.reason && <p className="text-xs text-muted">{n.reason}</p>}
            </div>
            {isAdmin && (
              <div className="flex shrink-0 gap-1">
                <button className={btn2} disabled={pending} onClick={() => run(() => updateNote(n.id, { status: 'ใช้อยู่' }))}>ยืนยัน</button>
                <button className={btn2} disabled={pending} onClick={() => run(() => updateNote(n.id, { status: 'เลิกใช้' }))}>ไม่เอา</button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </section>
  );
}

// ── H16 แฟ้มคู่แข่ง ──
export function SwipeBox({ swipes, brands, brandId }: { swipes: Swipe[]; brands: Brand[]; brandId: string }) {
  const { error, pending, run } = useRun();
  const [adding, setAdding] = useState(false);
  const input = 'mt-1 w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-sm outline-none focus:border-accent';
  return (
    <section className={panel}>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium">แฟ้มคู่แข่ง</h2>
        <button className={btn2} onClick={() => setAdding(!adding)}>{adding ? 'ปิด' : '+ แปะโพสต์'}</button>
      </div>
      {adding && (
        <form className="mt-3 space-y-2" onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          run(() => addSwipe(fd), () => setAdding(false));
        }}>
          <input name="url" required placeholder="ลิงก์โพสต์ https://…" aria-label="ลิงก์โพสต์" className={input} />
          <input name="competitor" placeholder="แบรนด์คู่แข่ง" aria-label="แบรนด์คู่แข่ง" className={input} />
          <textarea name="seen_text" rows={3} placeholder="คัดลอกแคปชันในโพสต์มาวาง · agent อ่านจากตรงนี้ (เปิดลิงก์ Facebook/IG เองไม่ได้)"
            aria-label="ข้อความในโพสต์" className={input} />
          <input name="note" placeholder="ทำไมน่าสนใจ (ไม่บังคับ)" aria-label="หมายเหตุ" className={input} />
          <select name="brand_id" defaultValue={brandId} aria-label="เทียบกับแบรนด์" className={input}>
            <option value="">ทุกแบรนด์</option>
            {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <button disabled={pending} className="w-full rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-accent-fg disabled:opacity-50">
            {pending ? 'agent กำลังสรุป…' : 'เก็บเข้าแฟ้ม + ให้ agent สรุป'}
          </button>
        </form>
      )}
      {swipes.length === 0 && !adding && <p className="mt-2 text-sm text-muted">ยังว่าง · เห็นโพสต์คู่แข่งที่น่าสนใจ แปะไว้ที่นี่</p>}
      <ul className="mt-2 divide-y divide-border">
        {swipes.map((s) => (
          <li key={s.id} className="py-2.5 text-sm">
            <div className="flex items-baseline justify-between gap-2">
              <a href={s.url} target="_blank" rel="noreferrer" className="font-medium underline">{s.competitor || 'โพสต์คู่แข่ง'} ↗</a>
              {s.hook_type && <span className="shrink-0 rounded-md bg-bg px-1.5 text-xs text-muted">{s.hook_type}</span>}
            </div>
            {s.summary ? <p className="mt-1">{s.summary}</p> : <p className="mt-1 text-xs text-muted">ยังไม่มีสรุป</p>}
            <div className="mt-1.5 flex gap-1.5">
              {!s.summary && s.seen_text && <button className={btn2} disabled={pending} onClick={() => run(() => resummarizeSwipe(s.id))}>ให้ agent สรุป</button>}
              <button className={btn2} disabled={pending} onClick={() => run(() => archiveSwipe(s.id))}>เก็บเข้าลิ้นชัก</button>
            </div>
          </li>
        ))}
      </ul>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </section>
  );
}

// ── H19 ไอเดียจาก agent สัปดาห์นี้ ──
export function IdeasBox({ ideas, brands, brandId, productName }: {
  ideas: Suggestion[]; brands: Brand[]; brandId: string; productName: Record<string, string>;
}) {
  const { error, pending, run } = useRun();
  const router = useRouter();
  const [brand, setBrand] = useState(brandId || brands[0]?.id || '');
  const open = ideas.filter((i) => i.status === 'เสนอ');
  return (
    <section className={panel}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium">ไอเดียจาก agent สัปดาห์นี้</h2>
        <div className="flex gap-1.5">
          {!brandId && brands.length > 1 && (
            <select value={brand} onChange={(e) => setBrand(e.target.value)} aria-label="แบรนด์" className="rounded-xl border border-border bg-bg px-2 text-sm">
              {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
          <button className={btn2} disabled={pending || !brand} onClick={() => run(() => makeIdeas(brand))}>
            {pending ? 'agent กำลังคิด…' : open.length ? 'คิดเพิ่ม 3 ไอเดีย' : 'ให้ agent คิด 3 ไอเดีย'}
          </button>
        </div>
      </div>
      <p className="mt-1 text-xs text-muted">คิดจาก สินค้าที่ไม่ได้พูดถึงนาน + แฟ้มคู่แข่ง + brand model · แตะ “เอา” = ไปหน้าไอเดียด่วนพร้อมข้อความ</p>
      {open.length === 0 && <p className="mt-2 text-sm text-muted">ยังไม่มีไอเดียที่รอเลือก</p>}
      <ul className="mt-2 space-y-2">
        {open.map((i) => (
          <li key={i.id} className="rounded-xl border border-border bg-bg p-3 text-sm">
            <p className="font-medium">{i.hook || i.title}</p>
            {i.hook && <p className="text-xs text-muted">{i.title}</p>}
            {i.reason && <p className="mt-1 text-xs">{i.reason}</p>}
            {i.product_ids.length > 0 && <p className="mt-1 text-xs text-muted">สินค้า: {i.product_ids.map((p) => productName[p] ?? '').filter(Boolean).join(' · ')}</p>}
            <div className="mt-2 flex gap-1.5">
              <button className="rounded-xl bg-accent px-3 py-1.5 text-sm font-medium text-accent-fg disabled:opacity-50" disabled={pending}
                onClick={() => run(() => decideIdea(i.id, 'เอา'), () => {
                  const text = [i.title, i.hook, i.product_ids.map((p) => productName[p]).filter(Boolean).join(' ')].filter(Boolean).join(' · ');
                  router.push(`/content/idea?text=${encodeURIComponent(text)}`);
                })}>เอา</button>
              <button className={btn2} disabled={pending} onClick={() => run(() => decideIdea(i.id, 'ไม่เอา'))}>ไม่เอา</button>
            </div>
          </li>
        ))}
      </ul>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </section>
  );
}
