'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  updateItem, submitForReview, approveItem, bounceItem, markPosted, addPlacement,
} from '@/modules/content/actions';
import { WORK_STAGES, type Item, type Placement } from '@/modules/content/types';

const input =
  'mt-1.5 w-full rounded-xl border border-border bg-bg px-3 py-3 text-base outline-none focus:border-accent';
const label = 'block text-sm font-medium';

const TONE: Record<string, string> = {
  ไอเดีย: 'bg-border text-muted',
  เขียนบท: 'bg-accent/10 text-accent',
  ถ่ายแล้วรอตัด: 'bg-warn/10 text-warn',
  ตัดเสร็จ: 'bg-accent/10 text-accent',
  รอตรวจ: 'bg-locked/10 text-locked',
  ตีกลับแก้: 'bg-danger/10 text-danger',
  พร้อมโพสต์: 'bg-ok/10 text-ok',
  โพสต์แล้ว: 'bg-ok/10 text-ok',
  พับไว้: 'bg-border text-muted',
};

type Props = {
  item: Item;
  placements: Placement[];
  channels: { id: string; name_th: string }[];
  canApprove: boolean;
};

export default function LegacyItemDetail({ item, placements, channels, canApprove }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const editable = !['โพสต์แล้ว', 'พับไว้'].includes(item.stage);
  const canSubmit = ['ไอเดีย', 'เขียนบท', 'ถ่ายแล้วรอตัด', 'ตัดเสร็จ', 'ตีกลับแก้'].includes(item.stage);
  const approved = item.stage === 'พร้อมโพสต์' || item.stage === 'โพสต์แล้ว';
  const unused = channels.filter((c) => !placements.some((p) => p.channel_id === c.id));

  function run(fn: () => Promise<{ ok: true } | { ok: false; error: string }>, okMsg?: string) {
    setError(null); setNote(null);
    start(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error);
      else { if (okMsg) setNote(okMsg); router.refresh(); }
    });
  }

  function onSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set('id', item.id);
    run(() => updateItem(fd), 'บันทึกแล้ว');
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight">{item.title}</h1>
          <p className="mt-1 text-sm text-muted">{item.format}</p>
        </div>
        <span className={`shrink-0 rounded-lg px-2.5 py-1 text-xs ${TONE[item.stage] ?? ''}`}>
          {item.stage}
        </span>
      </div>

      {item.review_note && (
        <div
          className={
            'rounded-2xl border p-4 text-sm ' +
            (item.stage === 'ตีกลับแก้' || item.stage === 'รอตรวจ'
              ? 'border-danger/40 bg-danger/5'
              : 'border-ok/40 bg-ok/5')
          }
        >
          <div className="font-medium">
            {item.stage === 'ตีกลับแก้' ? 'ถูกตีกลับ' : 'หมายเหตุจากคนตรวจ'}
          </div>
          <p className="mt-1">{item.review_note}</p>
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-danger/40 bg-danger/5 p-4 text-sm">
          <div className="font-medium text-danger">ทำไม่สำเร็จ</div>
          <p className="mt-1">{error}</p>
        </div>
      )}
      {note && (
        <div className="rounded-2xl border border-ok/40 bg-ok/5 p-4 text-sm text-ok">{note}</div>
      )}

      {/* ── คนตรวจ ── */}
      {canApprove && item.stage === 'รอตรวจ' && (
        <div className="rounded-2xl border border-locked/40 bg-locked/5 p-4">
          <div className="text-sm font-medium text-locked">รอคุณตรวจ</div>
          <p className="mt-1 text-xs text-muted">
            ดูไฟล์ที่ตัดเสร็จข้างล่างก่อนกด · อนุมัติแล้วถึงจะโพสต์ได้
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => {
                const n = prompt('อนุมัติ — มีหมายเหตุอะไรไหม (เว้นว่างได้)', '');
                if (n === null) return;
                run(() => approveItem(item.id, n), 'อนุมัติแล้ว');
              }}
              disabled={pending}
              className="flex-1 rounded-xl bg-accent px-4 py-3.5 text-sm font-medium text-accent-fg disabled:opacity-50"
            >
              อนุมัติ
            </button>
            <button
              onClick={() => {
                const r = prompt('ตีกลับ — ต้องบอกเหตุผล คนทำจะได้รู้ว่าต้องแก้อะไร', '');
                if (r === null) return;
                run(() => bounceItem(item.id, r), 'ตีกลับแล้ว');
              }}
              disabled={pending}
              className="rounded-xl border border-border px-4 py-3.5 text-sm text-danger disabled:opacity-50"
            >
              ตีกลับ
            </button>
          </div>
        </div>
      )}

      {/* ── งาน ── */}
      {editable && (
        <form onSubmit={onSave} className="rounded-2xl border border-border bg-surface p-4">
          <div>
            <label className={label} htmlFor="ti">เรื่อง</label>
            <input id="ti" name="title" defaultValue={item.title} required className={input} />
          </div>

          <div className="mt-3">
            <label className={label} htmlFor="br">บรีฟ</label>
            <textarea id="br" name="brief" rows={3} defaultValue={item.brief ?? ''} className={input} />
          </div>

          <div className="mt-3">
            <label className={label} htmlFor="st">อยู่ขั้นไหน</label>
            <select id="st" name="stage" defaultValue={item.stage} className={input}>
              {WORK_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
              {!WORK_STAGES.includes(item.stage as never) && (
                <option value={item.stage}>{item.stage} (ปัจจุบัน)</option>
              )}
              <option value="พับไว้">พับไว้</option>
            </select>
          </div>

          <div className="mt-4 space-y-3 border-t border-border pt-4">
            <div className="text-xs text-muted">
              ไฟล์อยู่ที่ Drive/Figma — ที่นี่เก็บแค่ลิงก์
            </div>
            <div>
              <label className={label} htmlFor="sc">บท</label>
              <input id="sc" name="script_url" type="url" defaultValue={item.script_url ?? ''}
                className={input} placeholder="https://docs.google.com/…" />
            </div>
            <div>
              <label className={label} htmlFor="rw">ไฟล์ดิบ</label>
              <input id="rw" name="raw_url" type="url" defaultValue={item.raw_url ?? ''}
                className={input} placeholder="https://drive.google.com/…" />
            </div>
            <div>
              <label className={label} htmlFor="ed">ไฟล์ที่ตัดเสร็จ</label>
              <input id="ed" name="edit_url" type="url" defaultValue={item.edit_url ?? ''}
                className={input} placeholder="https://drive.google.com/…" />
              {approved && (
                <p className="mt-1 text-xs text-warn">
                  ⚠️ ชิ้นนี้อนุมัติแล้ว — ถ้าแก้ลิงก์นี้ ระบบจะถอนการอนุมัติเองและต้องส่งตรวจใหม่
                </p>
              )}
            </div>
            <div>
              <label className={label} htmlFor="th">ปก</label>
              <input id="th" name="thumbnail_url" type="url" defaultValue={item.thumbnail_url ?? ''}
                className={input} />
            </div>
            <div>
              <label className={label} htmlFor="du">กำหนดเสร็จ</label>
              <input id="du" name="due_on" type="date" defaultValue={item.due_on ?? ''} className={input} />
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <button type="submit" disabled={pending}
              className="flex-1 rounded-xl border border-border px-4 py-3.5 text-sm font-medium disabled:opacity-50">
              {pending ? 'กำลังบันทึก…' : 'บันทึก'}
            </button>
            {canSubmit && (
              <button
                type="button"
                onClick={() => run(() => submitForReview(item.id), 'ส่งตรวจแล้ว')}
                disabled={pending}
                className="flex-1 rounded-xl bg-accent px-4 py-3.5 text-sm font-medium text-accent-fg disabled:opacity-50"
              >
                ส่งตรวจ
              </button>
            )}
          </div>
        </form>
      )}

      {/* ── ที่ลง ── */}
      <section className="rounded-2xl border border-border bg-surface p-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-medium">ลงที่ไหนบ้าง</h2>
          <span className="text-xs text-muted">
            ลงแล้ว {placements.filter((p) => p.published_url).length} จาก {placements.length}
          </span>
        </div>

        {placements.length === 0 && (
          <p className="mt-2 text-sm text-muted">ยังไม่ได้เลือกช่องทาง — เพิ่มข้างล่าง</p>
        )}

        <ul className="mt-3 space-y-2">
          {placements.map((p) => (
            <li key={p.id} className="rounded-xl border border-border px-3 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium">{p.channels?.name_th ?? p.channel_id}</span>
                {p.published_url ? (
                  <a href={p.published_url} target="_blank" rel="noreferrer"
                     className="shrink-0 text-xs text-ok underline-offset-2 hover:underline">
                    ลงแล้ว ↗
                  </a>
                ) : (
                  <button
                    onClick={() => {
                      if (!approved) { setError('ต้องอนุมัติก่อนถึงจะบันทึกการโพสต์ได้'); return; }
                      const u = prompt(`ลง ${p.channels?.name_th ?? p.channel_id} แล้ว — วางลิงก์โพสต์จริง`, '');
                      if (u === null) return;
                      run(() => markPosted(p.id, u, item.id), 'บันทึกแล้ว');
                    }}
                    disabled={pending}
                    className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs disabled:opacity-50"
                  >
                    บันทึกว่าลงแล้ว
                  </button>
                )}
              </div>
              {p.published_at && (
                <div className="mt-1 text-[11px] text-muted">
                  {new Date(p.published_at).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })}
                </div>
              )}
            </li>
          ))}
        </ul>

        {editable && unused.length > 0 && (
          <div className="mt-3 border-t border-border pt-3">
            <label className="block text-xs text-muted" htmlFor="addch">เพิ่มช่องทาง</label>
            <select
              id="addch"
              defaultValue=""
              onChange={(e) => {
                if (!e.target.value) return;
                const v = e.target.value;
                e.target.value = '';
                run(() => addPlacement(item.id, v), 'เพิ่มแล้ว');
              }}
              className={input}
            >
              <option value="">— เลือก —</option>
              {unused.map((c) => <option key={c.id} value={c.id}>{c.name_th}</option>)}
            </select>
          </div>
        )}
      </section>
    </div>
  );
}
