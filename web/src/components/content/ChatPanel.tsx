'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { sendMessage } from '@/modules/content/actions';
import type { Message, Person } from '@/modules/content/types';

const fmt = (d: string) =>
  new Date(d).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/**
 * คุยกันในงาน (Q-49d) · เลือกได้ว่าพูดถึงส่วนไหน · @ชื่อ = ขึ้นหน้าแรกของคนนั้น (Y3)
 * ข้อความระบบ = เหตุการณ์ของงาน เช่น ส่งตรวจ ผ่าน ตีกลับ
 */
export default function ChatPanel({ itemId, messages, parts, team, me }: {
  itemId: string; messages: Message[]; parts: string[]; team: Person[]; me: string | null;
}) {
  const [text, setText] = useState('');
  const [ref, setRef] = useState('ทั้งชิ้น');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const box = useRef<HTMLDivElement>(null);
  const name = (id: string | null) => team.find((p) => p.id === id)?.full_name ?? 'ไม่ทราบชื่อ';

  useEffect(() => { box.current?.scrollTo({ top: box.current.scrollHeight }); }, [messages.length]);

  function send() {
    setError(null);
    start(async () => {
      const res = await sendMessage(itemId, text, ref);
      if (!res.ok) setError(res.error);
      else { setText(''); router.refresh(); }
    });
  }

  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium">คุยกันในงานนี้</h2>
        <span className="text-xs text-muted">@ชื่อ เรียกคนในทีม · @AI สั่ง agent</span>
      </div>

      <div ref={box} className="mt-3 max-h-80 space-y-3 overflow-y-auto pr-1">
        {messages.length === 0 && <p className="text-sm text-muted">ยังไม่มีข้อความ</p>}
        {messages.map((m) =>
          m.kind === 'ระบบ' ? (
            <p key={m.id} className="text-center text-xs text-muted">{m.body} · {fmt(m.created_at)}</p>
          ) : (
            <div key={m.id} className="flex gap-2">
              <span className={'grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-bold ' +
                (m.kind === 'AI' ? 'bg-accent text-accent-fg' : m.author_id === me ? 'bg-accent/15 text-accent' : 'bg-bg text-text border border-border')}>
                {m.kind === 'AI' ? 'AI' : name(m.author_id).slice(0, 1)}
              </span>
              <div className="min-w-0">
                <div className="text-xs text-muted">
                  <b className="font-semibold text-text">{m.kind === 'AI' ? 'Content agent' : name(m.author_id)}</b> {fmt(m.created_at)}
                </div>
                <p className="whitespace-pre-wrap text-sm">
                  {m.part_label && <span className="mr-1 rounded-md bg-bg px-1.5 text-[11px] font-semibold text-muted">{m.part_label}</span>}
                  {m.body}
                </p>
              </div>
            </div>
          ),
        )}
      </div>

      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
      <div className="mt-3 flex gap-2">
        <select value={ref} onChange={(e) => setRef(e.target.value)} aria-label="พูดถึงส่วนไหน"
          className="max-w-28 rounded-xl border border-border bg-bg px-2 text-sm">
          {['ทั้งชิ้น', ...parts].map((p) => <option key={p}>{p}</option>)}
        </select>
        <input value={text} onChange={(e) => setText(e.target.value)} aria-label="ข้อความ" placeholder="พิมพ์ข้อความ หรือ @AI …"
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing && text.trim()) { e.preventDefault(); send(); } }}
          className="min-w-0 flex-1 rounded-xl border border-border bg-bg px-3 py-2.5 text-sm outline-none focus:border-accent" />
        <button onClick={send} disabled={pending || !text.trim()}
          className="rounded-xl bg-accent px-4 text-sm font-medium text-accent-fg disabled:opacity-50">
          {pending && /@ai/i.test(text) ? 'agent กำลังทำ…' : 'ส่ง'}
        </button>
      </div>
    </section>
  );
}
