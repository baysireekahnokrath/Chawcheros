'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createLead } from '@/modules/leads/actions';
import { CHANNELS, TOPICS } from '@/modules/leads/constants';
import { btn, btnGhost, chipCls, field } from './useRun';

type Dup = { id: string; name: string; stage: string };

/** ฟอร์มหน้าเดียว "บันทึกคนสนใจ" · ช่องทาง + ชื่อที่เห็นในแชท + เรื่อง · ช่องอื่นไม่บังคับ (LD-13) */
export default function LeadForm() {
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState<string>('Messenger');
  const [topic, setTopic] = useState<string>('ถามราคา');
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [dup, setDup] = useState<Dup | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function save(force: boolean) {
    if (!name.trim()) {
      setError('ใส่ชื่อที่เห็นในแชทก่อน');
      return;
    }
    setError(null);
    start(async () => {
      const r = await createLead({ channel, name, topic, message, force });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      if (r.data && 'duplicate' in r.data) {
        setDup(r.data.duplicate);
        return;
      }
      if (r.data) router.push(`/leads/${r.data.id}`);
    });
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={btn + ' shrink-0'}>
        + บันทึกคนสนใจ
      </button>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save(false);
      }}
      className="order-last w-full rounded-2xl border border-border bg-surface p-4"
    >
      <h2 className="font-semibold">บันทึกคนสนใจ</h2>
      <p className="mt-0.5 text-xs text-muted">
        ใช้เมื่อมีคนทักทาง Messenger หรือ Instagram หรือเดินเข้าโชว์รูม หรือโทรมา · LINE ไม่ต้องกดถ้าต่อระบบรับเองแล้ว (ยังไม่ต่อ ให้เลือก LINE แล้วบันทึกเองได้)
      </p>

      <div className="mt-3 text-xs text-muted">ช่องทาง</div>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {CHANNELS.map((c) => (
          <button key={c} type="button" aria-pressed={channel === c} onClick={() => { setChannel(c); setDup(null); }} className={chipCls(channel === c)}>
            {c}
          </button>
        ))}
      </div>

      <label className="mt-3 block">
        <span className="text-xs text-muted">ชื่อที่เห็นในแชท</span>
        <input
          value={name}
          onChange={(e) => { setName(e.target.value); setDup(null); }}
          className={field + ' mt-1'}
          placeholder="เช่น คุณ ด."
          autoComplete="off"
          maxLength={120}
          autoFocus
        />
      </label>

      <div className="mt-3 text-xs text-muted">เรื่อง</div>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {TOPICS.map((c) => (
          <button key={c} type="button" aria-pressed={topic === c} onClick={() => setTopic(c)} className={chipCls(topic === c)}>
            {c}
          </button>
        ))}
      </div>

      <label className="mt-3 block">
        <span className="text-xs text-muted">ลูกค้าถามว่าอะไร (ไม่บังคับ)</span>
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className={field + ' mt-1'}
          placeholder="จดสั้นๆ ให้จำได้"
          maxLength={200}
          autoComplete="off"
        />
      </label>

      {error && <p className="mt-2 text-sm font-medium text-danger" role="alert">{error}</p>}

      {dup ? (
        <div className="mt-3 rounded-xl border border-text p-3 text-sm" role="alert">
          มีชื่อ <b>{dup.name}</b> ทาง {channel} อยู่แล้ว (ขั้น {dup.stage}) อาจเป็นคนเดียวกัน
          <div className="mt-2 flex flex-wrap gap-2">
            <Link href={`/leads/${dup.id}`} className={btn + ' flex-1'}>
              เปิดรายการเดิม
            </Link>
            <button type="button" disabled={pending} onClick={() => save(true)} className={btnGhost + ' flex-1'}>
              เป็นคนใหม่ บันทึกเลย
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <button disabled={pending} className={btn + ' flex-1'}>
            {pending ? 'กำลังบันทึก…' : 'บันทึก'}
          </button>
          <button type="button" onClick={() => setOpen(false)} className={btnGhost}>
            ยกเลิก
          </button>
        </div>
      )}
    </form>
  );
}
