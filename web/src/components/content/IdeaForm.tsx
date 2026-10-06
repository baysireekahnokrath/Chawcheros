'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { understandIdea, createFromIdea } from '@/modules/content/agent-actions';
import type { IdeaDraft } from '@/modules/content/agent';
import { PHASE1_CHANNELS, type Brand, type Model, type Pillar } from '@/modules/content/types';

const input = 'mt-1.5 w-full rounded-xl border border-border bg-bg px-3 py-3 text-base outline-none focus:border-accent';
const label = 'block text-sm font-medium';

type Done = { ok: true; status: string; message: string; itemId?: string } | { ok: false; error: string; itemId?: string };

/**
 * ไอเดียด่วน (Q-113–120) · พิมพ์ประโยคเดียว + ลิงก์ภาพ
 * 1) agent อ่านแล้วโชว์ว่าเข้าใจว่าอะไร (แก้ได้) · ถามถ้าข้อมูลไม่พอ
 * 2) กดเขียนเลย → สร้างชิ้นงาน (นอกแผน) → agent เขียนทุกช่องทาง → ภาพครบส่งตรวจเอง → ปุ่มตรวจเลย
 */
export default function IdeaForm({ brands, pillars, models, canReview, initial = '' }: {
  brands: Brand[]; pillars: Pillar[]; models: Model[]; canReview: boolean; initial?: string;
}) {
  const [idea, setIdea] = useState(initial);
  const [imgs, setImgs] = useState('');
  const [draft, setDraft] = useState<IdeaDraft | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [pending, start] = useTransition();
  const images = imgs.split(/\s+/).map((s) => s.trim()).filter(Boolean);

  function read() {
    setError(null);
    start(async () => {
      const r = await understandIdea(idea, images);
      if (!r.ok) setError(r.error);
      else { setDraft(r.draft); setAnswers({}); }
    });
  }

  function write() {
    if (!draft) return;
    setError(null);
    start(async () => {
      const r = await createFromIdea(idea, draft, images,
        draft.questions.map((q, i) => ({ question: q.question, answer: answers[i] ?? '' })));
      setDone(r);
    });
  }

  function reset() { setIdea(''); setImgs(''); setDraft(null); setDone(null); setError(null); }

  if (done) {
    return (
      <div className={'rounded-2xl border p-4 ' + (done.ok ? 'border-ok/40 bg-ok/5' : 'border-danger/40 bg-danger/5')}>
        <p className="text-sm font-medium">{done.ok ? done.message : done.error}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {done.ok && done.status === 'submitted' && canReview && done.itemId && (
            <Link href={`/content/${done.itemId}/review`} className="rounded-xl bg-accent px-4 py-3 text-sm font-medium text-accent-fg">ตรวจเลย</Link>
          )}
          {done.itemId && (
            <Link href={`/content/${done.itemId}`} className="rounded-xl border border-border px-4 py-3 text-sm">
              {done.ok && done.status === 'asked' ? 'ไปตอบคำถาม agent' : 'เปิดชิ้นงาน'}
            </Link>
          )}
          <button onClick={reset} className="rounded-xl border border-border px-4 py-3 text-sm">ไอเดียใหม่</button>
        </div>
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="space-y-3">
        <div>
          <label className={label} htmlFor="idea">มีไอเดียอะไร พิมพ์เลย</label>
          <textarea id="idea" rows={3} value={idea} onChange={(e) => setIdea(e.target.value)} className={input}
            placeholder="เช่น อยากเล่นเรื่อง mid century ใช้โซฟารุ่น Pana ลงพรุ่งนี้ ทำบล็อกด้วย" />
        </div>
        <div>
          <label className={label} htmlFor="imgs">ลิงก์ภาพ <span className="text-xs font-normal text-muted">ถ้ามี · หลายภาพเว้นบรรทัด</span></label>
          <textarea id="imgs" rows={2} value={imgs} onChange={(e) => setImgs(e.target.value)} className={input} placeholder="https://…" />
        </div>
        {error && <p className="rounded-xl border border-danger/40 bg-danger/5 p-3 text-sm">{error}</p>}
        <button onClick={read} disabled={pending || !idea.trim()}
          className="w-full rounded-xl bg-accent px-4 py-3 text-sm font-medium text-accent-fg disabled:opacity-50">
          {pending ? 'agent กำลังอ่าน…' : 'ให้ agent อ่าน'}
        </button>
      </div>
    );
  }

  const set = (patch: Partial<IdeaDraft>) => setDraft({ ...draft, ...patch });
  const brandPillars = pillars.filter((p) => p.brand_id === draft.brand_id && p.active);
  const textOnly = images.length === 0;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-accent/30 bg-accent/5 p-4 text-sm">
        <div className="text-xs text-muted">agent เข้าใจว่า</div>
        <p className="mt-1">{draft.understanding}</p>
      </div>

      {draft.questions.length > 0 && (
        <div className="space-y-3 rounded-2xl border border-warn/40 bg-warn/5 p-4">
          <p className="text-sm font-medium">ขอถามก่อนเขียน · ไม่เดาข้อมูลที่ระบบไม่มี</p>
          {draft.questions.map((q, i) => (
            <div key={i}>
              <p className="text-sm">{q.question}</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {q.choices.map((c) => (
                  <button key={c} type="button" onClick={() => setAnswers({ ...answers, [i]: c })}
                    className={'rounded-full border px-3 py-1.5 text-sm ' + (answers[i] === c ? 'border-accent bg-accent text-accent-fg' : 'border-border bg-bg')}>
                    {c}
                  </button>
                ))}
              </div>
              <input value={answers[i] ?? ''} onChange={(e) => setAnswers({ ...answers, [i]: e.target.value })}
                placeholder="หรือพิมพ์ตอบเอง" aria-label={q.question}
                className="mt-2 w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-sm outline-none focus:border-accent" />
            </div>
          ))}
        </div>
      )}

      <div className="space-y-3 rounded-2xl border border-border bg-surface p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={label} htmlFor="brand">แบรนด์</label>
            <select id="brand" value={draft.brand_id} className={input}
              onChange={(e) => set({ brand_id: e.target.value, pillar_id: '', product_ids: [] })}>
              {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className={label} htmlFor="date">ลงวันที่</label>
            <input id="date" type="date" value={draft.planned_on} onChange={(e) => set({ planned_on: e.target.value })} className={input} />
          </div>
        </div>
        <div>
          <label className={label} htmlFor="hook">Hook</label>
          <input id="hook" value={draft.hook} onChange={(e) => set({ hook: e.target.value })} className={input} />
        </div>
        <div>
          <label className={label} htmlFor="km">อยากให้คนจำอะไร</label>
          <input id="km" value={draft.key_message} onChange={(e) => set({ key_message: e.target.value })} className={input} />
        </div>
        <fieldset>
          <legend className={label}>ช่องทาง <span className="text-xs font-normal text-muted">{textOnly ? 'ข้อความล้วน · ลง IG ไม่ได้' : images.length === 1 ? 'ภาพเดี่ยว' : `อัลบั้ม ${images.length} ภาพ`}</span></legend>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {PHASE1_CHANNELS.filter((c) => !(textOnly && c.id === 'instagram')).map((c) => {
              const on = draft.channels.includes(c.id);
              return (
                <button key={c.id} type="button" aria-pressed={on}
                  onClick={() => set({ channels: on ? draft.channels.filter((x) => x !== c.id) : [...draft.channels, c.id] })}
                  className={'rounded-full border px-3 py-1.5 text-sm ' + (on ? 'border-accent bg-accent text-accent-fg' : 'border-border')}>
                  {c.name}
                </button>
              );
            })}
          </div>
        </fieldset>
        <div>
          <div className={label}>สินค้า</div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {draft.product_ids.length === 0 && <span className="text-sm text-muted">ไม่ผูกสินค้า</span>}
            {draft.product_ids.map((id) => {
              const m = models.find((x) => x.id === id);
              return (
                <button key={id} type="button" onClick={() => set({ product_ids: draft.product_ids.filter((x) => x !== id) })}
                  className="rounded-full border border-border bg-bg px-3 py-1 text-sm">
                  {m ? `${m.collection}${m.name_th ? ` ${m.name_th}` : ''}` : id} ✕
                </button>
              );
            })}
          </div>
        </div>
        {brandPillars.length > 0 && (
          <div>
            <label className={label} htmlFor="pillar">Pillar <span className="text-xs font-normal text-muted">ไม่บังคับ</span></label>
            <select id="pillar" value={draft.pillar_id} onChange={(e) => set({ pillar_id: e.target.value })} className={input}>
              <option value="">ไม่ผูก</option>
              {brandPillars.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        )}
      </div>

      {error && <p className="rounded-xl border border-danger/40 bg-danger/5 p-3 text-sm">{error}</p>}
      <div className="flex gap-2">
        <button onClick={() => setDraft(null)} disabled={pending} className="rounded-xl border border-border px-4 py-3 text-sm">แก้ไอเดีย</button>
        <button onClick={write} disabled={pending || draft.channels.length === 0}
          className="flex-1 rounded-xl bg-accent px-4 py-3 text-sm font-medium text-accent-fg disabled:opacity-50">
          {pending ? 'agent กำลังเขียนทุกช่องทาง… (30-90 วินาที)' : 'เขียนเลย'}
        </button>
      </div>
    </div>
  );
}
