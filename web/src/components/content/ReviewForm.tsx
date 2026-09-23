'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { reviewItem, type Verdict } from '@/modules/content/actions';
import { channelName, type Placement, type ItemImage, type OpenPart } from '@/modules/content/types';

const isDirectImage = (u: string) => /\.(jpe?g|png|webp|gif|avif)(\?|$)/i.test(u);

type Mark = 'ok' | 'fix' | undefined;

/**
 * ตรวจทีละส่วน (Q-47–49c) · ภาพแต่ละภาพ และข้อความแต่ละช่องทาง ติ๊กผ่านหรือไม่ผ่าน
 * ส่วนที่ผ่านแล้วรอบก่อนแสดงไว้ให้เห็น แต่ไม่ต้องตัดสินซ้ำ
 */
export default function ReviewForm({ itemId, placements, images, open, canReview, blockReason }: {
  itemId: string; placements: Placement[]; images: ItemImage[]; open: OpenPart[];
  canReview: boolean; blockReason: string | null;
}) {
  const [marks, setMarks] = useState<Record<string, Mark>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const openKeys = new Set(open.map((p) => p.part_key));
  const undecided = open.filter((p) => !marks[p.part_key]).length;
  const fixes = open.filter((p) => marks[p.part_key] === 'fix');
  const missingNote = fixes.some((p) => !(notes[p.part_key] ?? '').trim());

  function toggle(key: string, v: 'ok' | 'fix') {
    setMarks((m) => ({ ...m, [key]: m[key] === v ? undefined : v }));
  }

  function submit() {
    const verdicts: Verdict[] = open.map((p) => ({
      part: p.part_key, pass: marks[p.part_key] === 'ok', note: notes[p.part_key],
    }));
    setError(null);
    start(async () => {
      const res = await reviewItem(itemId, verdicts, '');
      if (!res.ok) setError(res.error);
      else router.push(`/content/${itemId}`);
    });
  }

  function Verdicts({ k }: { k: string }) {
    if (!openKeys.has(k)) return <span className="rounded-lg bg-ok/10 px-2 py-0.5 text-xs font-medium text-ok">ผ่านแล้วรอบก่อน</span>;
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          {(['ok', 'fix'] as const).map((v) => (
            <label key={v}
              className={'inline-flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm ' +
                (marks[k] === v ? (v === 'ok' ? 'border-ok font-semibold text-ok' : 'border-danger font-semibold text-danger') : 'border-border')}>
              <input type="checkbox" checked={marks[k] === v} onChange={() => toggle(k, v)} disabled={!canReview}
                className="h-4 w-4 accent-[var(--accent)]" />
              {v === 'ok' ? 'ผ่าน' : 'ไม่ผ่าน'}
            </label>
          ))}
        </div>
        {marks[k] === 'fix' && (
          <input value={notes[k] ?? ''} onChange={(e) => setNotes((n) => ({ ...n, [k]: e.target.value }))}
            placeholder="ต้องแก้อะไร (บังคับ)" aria-label="เหตุผลที่ไม่ผ่าน"
            className="w-full rounded-xl border border-danger/50 bg-bg px-3 py-2.5 text-sm outline-none focus:border-danger" />
        )}
      </div>
    );
  }

  const border = (k: string) =>
    !openKeys.has(k) ? 'border-border opacity-75' : marks[k] === 'ok' ? 'border-ok/50' : marks[k] === 'fix' ? 'border-danger/50' : 'border-border';

  let button: React.ReactNode;
  if (!canReview) button = <button disabled className="flex-1 rounded-xl bg-accent px-4 py-3.5 text-sm font-medium text-accent-fg opacity-50">{blockReason}</button>;
  else if (open.length === 0) button = <button onClick={submit} disabled={pending} className="flex-1 rounded-xl bg-accent px-4 py-3.5 text-sm font-medium text-accent-fg disabled:opacity-50">ทุกส่วนผ่านแล้ว · อนุมัติ</button>;
  else if (undecided) button = <button disabled className="flex-1 rounded-xl bg-accent px-4 py-3.5 text-sm font-medium text-accent-fg opacity-50">ยังไม่ได้ติ๊ก {undecided} ส่วน</button>;
  else if (!fixes.length) button = <button onClick={submit} disabled={pending} className="flex-1 rounded-xl bg-accent px-4 py-3.5 text-sm font-medium text-accent-fg disabled:opacity-50">ผ่านทั้งหมด · อนุมัติ</button>;
  else button = (
    <button onClick={submit} disabled={pending || missingNote}
      className="flex-1 rounded-xl border border-danger px-4 py-3.5 text-sm font-medium text-danger disabled:opacity-50">
      {missingNote ? 'ใส่เหตุผลทุกส่วนที่ไม่ผ่าน' : `ส่งกลับแก้ ${fixes.length} ส่วน · ผ่าน ${open.length - fixes.length}`}
    </button>
  );

  const live = placements.filter((p) => !p.skipped_reason);

  return (
    <div className="space-y-3">
      {canReview && open.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setMarks(Object.fromEntries(open.map((p) => [p.part_key, 'ok' as Mark])))}
            className="rounded-xl border border-border px-3 py-2 text-sm">ติ๊กผ่านทั้งหมด</button>
          <span className="text-xs text-muted">แล้วค่อยติ๊ก “ไม่ผ่าน” เฉพาะส่วนที่ต้องแก้</span>
        </div>
      )}

      {images.map((m, i) => (
        <div key={m.id} className={'rounded-2xl border bg-surface p-3 ' + border(`img:${m.id}`)}>
          <div className="flex gap-3">
            <a href={m.url} target="_blank" rel="noreferrer"
              className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-xl border border-border bg-bg text-xs text-muted">
              {isDirectImage(m.url)
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={m.url} alt={`ภาพ ${i + 1}`} className="h-full w-full object-cover" />
                : <span>เปิดภาพ ↗</span>}
            </a>
            <div className="min-w-0 flex-1 space-y-2">
              <div className="text-sm font-semibold">ภาพ {i + 1}{i === 0 ? ' · key visual' : ''}</div>
              <Verdicts k={`img:${m.id}`} />
            </div>
          </div>
        </div>
      ))}

      {live.map((p) => (
        <div key={p.id} className={'space-y-2 rounded-2xl border bg-surface p-4 ' + border(`ch:${p.channel_id}`)}>
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold">{channelName(p.channel_id)}</h3>
            {p.planned_on && <span className="text-xs text-muted">ลง {new Date(p.planned_on).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}</span>}
          </div>
          {p.channel_id === 'website' && (
            <dl className="grid grid-cols-[88px_1fr] gap-x-2 gap-y-1 text-sm">
              <dt className="text-muted">หัวเรื่อง</dt><dd>{p.web_title || '—'}</dd>
              <dt className="text-muted">คำค้นหลัก</dt><dd>{p.web_keyword || '—'}</dd>
              <dt className="text-muted">Meta</dt><dd>{p.web_meta || '—'}</dd>
            </dl>
          )}
          {p.hook && <p className="text-sm"><span className="text-xs text-muted">Hook · </span>{p.hook}</p>}
          <p className="whitespace-pre-wrap text-sm">{p.copy_text || <span className="text-muted">ยังไม่มีข้อความ</span>}</p>
          {p.first_comment && <p className="text-xs text-muted">คอมเมนต์แรก · {p.first_comment}</p>}
          <Verdicts k={`ch:${p.channel_id}`} />
        </div>
      ))}

      {error && (
        <div className="rounded-2xl border border-danger/40 bg-danger/5 p-4 text-sm">
          <div className="font-medium text-danger">ตรวจไม่สำเร็จ</div>
          <p className="mt-1">{error}</p>
        </div>
      )}

      <div className="sticky bottom-0 flex gap-2 border-t border-border bg-bg py-3">{button}</div>
    </div>
  );
}
