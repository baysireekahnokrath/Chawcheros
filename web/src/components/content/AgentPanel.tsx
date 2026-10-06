'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { aiWrite, answerQuestions } from '@/modules/content/agent-actions';
import { channelName, type AgentQuestion, type Placement } from '@/modules/content/types';

type Outcome = { ok: true; status: string; message: string } | { ok: false; error: string };

/**
 * กล่อง Content agent บนหน้าชิ้นงาน
 * · ให้ AI เขียนทุกช่องทาง (ช่องที่คนแก้เองข้าม · Q-38)
 * · คำถามของ agent ตอบด้วยการแตะ แล้ว agent เขียนต่อเอง (Q-101)
 * · ร่างเสร็จ + ภาพครบ = ส่งตรวจเอง → ปุ่มตรวจเลย (Q-09b Q-120)
 */
export default function AgentPanel({ itemId, questions, placements, canAnswer, canWrite }: {
  itemId: string; questions: AgentQuestion[]; placements: Placement[]; canAnswer: boolean; canWrite: boolean;
}) {
  const open = questions.filter((q) => !q.answered_at);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<Outcome | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const live = placements.filter((p) => !p.skipped_reason && !p.published_at);
  const edited = live.filter((p) => p.human_edited);
  const fresh = live.filter((p) => !p.human_edited);

  function go(fn: () => Promise<Outcome>) {
    setResult(null);
    start(async () => {
      const r = await fn();
      setResult(r);
      if (r.ok) { setAnswers({}); router.refresh(); }
    });
  }

  return (
    <section className="rounded-2xl border border-accent/30 bg-accent/5 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium">Content agent</h2>
        <span className="text-xs text-muted">เขียนทุกช่องทางในรอบเดียว</span>
      </div>

      {open.length > 0 && (
        <div className="mt-3 space-y-3">
          <p className="text-sm">agent ขอถามก่อนเขียน{canAnswer ? '' : ' · รอ Bay หรือคนอนุมัติตอบ'}</p>
          {open.map((q) => (
            <div key={q.id} className="rounded-xl border border-border bg-surface p-3">
              <p className="text-sm font-medium">{q.question}</p>
              {canAnswer && (
                <>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {q.choices.map((c) => (
                      <button key={c} type="button" onClick={() => setAnswers({ ...answers, [q.id]: c })}
                        className={'rounded-full border px-3 py-1.5 text-sm ' +
                          (answers[q.id] === c ? 'border-accent bg-accent text-accent-fg' : 'border-border bg-bg')}>
                        {c}
                      </button>
                    ))}
                  </div>
                  <input value={answers[q.id] ?? ''} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                    placeholder="หรือพิมพ์ตอบเอง" aria-label={`คำตอบ: ${q.question}`}
                    className="mt-2 w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-sm outline-none focus:border-accent" />
                </>
              )}
            </div>
          ))}
          {canAnswer && (
            <button disabled={pending || open.every((q) => !answers[q.id]?.trim())}
              onClick={() => go(() => answerQuestions(itemId, open.map((q) => ({ id: q.id, answer: answers[q.id] ?? '' }))))}
              className="w-full rounded-xl bg-accent px-4 py-3 text-sm font-medium text-accent-fg disabled:opacity-50">
              {pending ? 'agent กำลังเขียน… (30-90 วินาที)' : 'ส่งคำตอบ แล้วให้ agent เขียนต่อ'}
            </button>
          )}
        </div>
      )}

      {open.length === 0 && canWrite && (
        <div className="mt-3 space-y-2">
          {fresh.length > 0 && (
            <button disabled={pending} onClick={() => go(() => aiWrite(itemId))}
              className="w-full rounded-xl bg-accent px-4 py-3 text-sm font-medium text-accent-fg disabled:opacity-50">
              {pending ? 'agent กำลังเขียน… (30-90 วินาที)'
                : `ให้ AI เขียน ${fresh.map((p) => channelName(p.channel_id)).join(' · ')}`}
            </button>
          )}
          {edited.length > 0 && (
            <div className="text-xs text-muted">
              คนแก้เองแล้ว agent ไม่เขียนทับ:{' '}
              {edited.map((p) => (
                <button key={p.id} disabled={pending} onClick={() => go(() => aiWrite(itemId, [p.channel_id]))}
                  className="ml-1 rounded-lg border border-border bg-surface px-2 py-1 text-xs text-text disabled:opacity-50">
                  ให้ AI เขียน {channelName(p.channel_id)} ใหม่
                </button>
              ))}
            </div>
          )}
          {live.length === 0 && <p className="text-sm text-muted">ยังไม่มีช่องทาง · เพิ่มในกล่อง “ลงที่ไหน วันไหน”</p>}
        </div>
      )}

      <p className="mt-3 text-xs text-muted">พิมพ์ <b>@AI</b> ในแชทเพื่อสั่งแก้ เช่น “@AI hook IG สั้นลง”</p>

      {result && !result.ok && <p className="mt-2 rounded-xl border border-danger/40 bg-danger/5 p-3 text-sm">{result.error}</p>}
      {result?.ok && (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ok/40 bg-ok/5 p-3 text-sm text-ok">
          <span>{result.message}</span>
          {result.status === 'submitted' && canAnswer && (
            <Link href={`/content/${itemId}/review`} className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-accent-fg">ตรวจเลย</Link>
          )}
        </div>
      )}
    </section>
  );
}
