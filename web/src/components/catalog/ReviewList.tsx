'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  approveSelection,
  rejectSelection,
  fetchGroupRows,
  type GroupRef,
} from '@/modules/catalog/actions';
import type { ImportGroup, ImportRow } from '@/modules/catalog/queries';

const baht = (n: number | null) =>
  n === null ? '—' : n.toLocaleString('th-TH', { maximumFractionDigits: 0 });

const key = (g: ImportGroup) => `${g.collection}\u0000${g.category}`;
const isPending = (g: ImportGroup) => g.รอตรวจ > 0;

const ATTRS = [
  ['wood', 'ไม้/โครง'],
  ['wood_colour', 'สี'],
  ['material_grade', 'วัสดุหุ้ม'],
  ['sub_category', 'รูปทรง'],
] as const;

const dimsOf = (r: ImportRow) =>
  [r.width_cm, r.depth_cm, r.height_cm].map((v) => v ?? '—').join('×') +
  (r.seat_height_cm !== null ? ` (นั่ง ${r.seat_height_cm})` : '');

/** ช่องไหนในกลุ่มนี้ที่ค่าไม่เหมือนกัน — ช่องพวกนั้นคือตัวที่ทำให้แต่ละตัวต่างกัน */
function varyingFields(rows: ImportRow[]): Set<string> {
  const out = new Set<string>();
  for (const [k] of ATTRS) {
    if (new Set(rows.map((r) => r[k] ?? '')).size > 1) out.add(k);
  }
  if (new Set(rows.map(dimsOf)).size > 1) out.add('size');
  if (new Set(rows.map((r) => r.list_price_incl_vat)).size > 1) out.add('price');
  return out;
}

/**
 * สิ่งที่เลือกไว้ของกลุ่มหนึ่ง
 *   'all'  = ติ๊กทั้งกลุ่มที่หัวการ์ด ยังไม่ต้องรู้ว่าข้างในมีอะไรบ้าง
 *   Set    = กางลงมาแล้วติ๊กทีละตัว
 * แยกสองแบบเพราะติ๊กทั้งกลุ่มต้องทำได้โดยไม่ต้องโหลดแถวก่อน
 */
type Pick = 'all' | Set<string>;

export default function ReviewList({ groups }: { groups: ImportGroup[] }) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [rows, setRows] = useState<Record<string, ImportRow[]>>({});
  const [sel, setSel] = useState<Record<string, Pick>>({});
  const [error, setError] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [busy, startBusy] = useTransition();
  const [, start] = useTransition();
  const router = useRouter();

  const pendingGroups = groups.filter(isPending);
  const doneGroups = groups.filter((g) => !isPending(g));
  const visible = showDone ? groups : pendingGroups;

  const pendingRowsOf = (k: string) =>
    (rows[k] ?? []).filter((r) => r.review_status === 'รอตรวจ');

  /** จำนวนตัวที่เลือกไว้ในกลุ่มนี้ */
  function countIn(g: ImportGroup): number {
    const p = sel[key(g)];
    if (p === undefined) return 0;
    if (p === 'all') return g.รอตรวจ;
    return p.size;
  }

  function loadRows(g: ImportGroup, then?: (rs: ImportRow[]) => void) {
    const k = key(g);
    if (rows[k]) { then?.(rows[k]); return; }
    start(async () => {
      const res = await fetchGroupRows(g.collection, g.category);
      if (!res.ok) { setError(res.error); return; }
      setRows((prev) => ({ ...prev, [k]: res.rows }));
      then?.(res.rows);
    });
  }

  function toggleOpen(g: ImportGroup) {
    const k = key(g);
    if (openKey === k) { setOpenKey(null); return; }
    setOpenKey(k);
    loadRows(g);
  }

  /** ติ๊กที่หัวกลุ่ม = เลือก/ไม่เลือกทั้งกลุ่ม */
  function toggleGroupPick(g: ImportGroup) {
    const k = key(g);
    setSel((prev) => {
      const next = { ...prev };
      if (next[k] === undefined) next[k] = 'all';
      else delete next[k];
      return next;
    });
  }

  /** ติ๊กรายตัว — ถ้าก่อนหน้าเป็น 'all' ต้องกางออกเป็นรายตัวก่อน */
  function toggleRowPick(g: ImportGroup, id: string) {
    const k = key(g);
    const all = pendingRowsOf(k).map((r) => r.id);
    setSel((prev) => {
      const cur = prev[k];
      const set = cur === 'all' ? new Set(all) : new Set(cur ?? []);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      const next = { ...prev };
      if (set.size === 0) delete next[k];
      else next[k] = set;
      return next;
    });
  }

  function pickAllVisible(on: boolean) {
    if (!on) { setSel({}); return; }
    const next: Record<string, Pick> = {};
    for (const g of pendingGroups) next[key(g)] = 'all';
    setSel(next);
  }

  /** แยกสิ่งที่เลือกเป็น "ทั้งกลุ่ม" กับ "รายตัว" เพื่อส่งให้ server */
  function splitSelection(): { wholeGroups: GroupRef[]; rowIds: string[]; total: number } {
    const wholeGroups: GroupRef[] = [];
    const rowIds: string[] = [];
    let total = 0;

    for (const g of pendingGroups) {
      const p = sel[key(g)];
      if (p === undefined) continue;
      if (p === 'all') {
        wholeGroups.push({ collection: g.collection, category: g.category });
        total += g.รอตรวจ;
      } else {
        for (const id of p) rowIds.push(id);
        total += p.size;
      }
    }
    return { wholeGroups, rowIds, total };
  }

  function afterWrite() {
    setSel({});
    setRows({});
    setOpenKey(null);
    router.refresh();
  }

  function onApprove() {
    const { wholeGroups, rowIds, total } = splitSelection();
    if (total === 0) return;
    if (!confirm(
      `อนุมัติ ${total} ตัว ใช่ไหม\n\n` +
      `จะออก SKU ให้ ${total} ตัวนี้\n` +
      `SKU ออกแล้วออกเลย ใช้ซ้ำไม่ได้ และแก้ไม่ได้ตลอดอายุสินค้า`,
    )) return;

    setError(null);
    startBusy(async () => {
      const res = await approveSelection(wholeGroups, rowIds);
      if (!res.ok) setError(res.error);
      else afterWrite();
    });
  }

  function onReject() {
    const { wholeGroups, rowIds, total } = splitSelection();
    if (total === 0) return;
    const note = prompt(
      `ไม่เอา ${total} ตัว — เพราะอะไร?\n\n` +
      `(เช่น เลิกขายแล้ว / ซ้ำกับรุ่นอื่น / สีเลือกตอนสั่ง)\n` +
      `ข้อมูลไม่ได้ถูกลบ แค่เปลี่ยนสถานะ ย้อนดูทีหลังได้`,
      '',
    );
    if (note === null) return;

    setError(null);
    startBusy(async () => {
      const res = await rejectSelection(wholeGroups, rowIds, note);
      if (!res.ok) setError(res.error);
      else afterWrite();
    });
  }

  const { total: picked } = splitSelection();
  const pickedGroups = Object.keys(sel).length;
  const totalGroups = groups.length;
  const done = doneGroups.length;

  return (
    <div className="space-y-4 pb-28">
      <div className="rounded-2xl border border-border bg-surface p-4">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-medium">ตรวจแล้ว {done} จาก {totalGroups} กลุ่ม</span>
          <span className="text-xs text-muted">เหลือ {totalGroups - done}</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-border">
          <div
            className="h-full rounded-full bg-ok transition-all"
            style={{ width: totalGroups === 0 ? '0%' : `${(done / totalGroups) * 100}%` }}
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs">
          {pendingGroups.length > 0 && (
            <>
              <button onClick={() => pickAllVisible(true)} className="text-accent">
                เลือกทุกกลุ่มที่เหลือ ({pendingGroups.length})
              </button>
              {pickedGroups > 0 && (
                <button onClick={() => pickAllVisible(false)} className="text-accent">
                  ล้างที่เลือก
                </button>
              )}
            </>
          )}
          {doneGroups.length > 0 && (
            <button onClick={() => setShowDone((v) => !v)} className="text-accent">
              {showDone ? 'ซ่อนกลุ่มที่ตรวจแล้ว' : `แสดงกลุ่มที่ตรวจแล้ว (${done})`}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-danger/40 bg-danger/5 p-4 text-sm">
          <div className="font-medium text-danger">ทำรายการไม่สำเร็จ</div>
          <p className="mt-1 whitespace-pre-wrap">{error}</p>
        </div>
      )}

      {visible.length === 0 && (
        <p className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted">
          {totalGroups === 0
            ? 'ยังไม่มีข้อมูลรอตรวจ — ไปอัปโหลดไฟล์ราคาก่อน'
            : 'ตรวจครบทุกกลุ่มแล้ว 🎉'}
        </p>
      )}

      <ul className="space-y-3">
        {visible.map((g) => {
          const k = key(g);
          const open = openKey === k;
          const pending = isPending(g);
          const p = sel[k];
          const n = countIn(g);
          const loaded = rows[k];
          const pend = pendingRowsOf(k);
          const partial = p !== undefined && p !== 'all' && loaded != null && p.size < pend.length;

          return (
            <li
              key={k}
              className={
                'overflow-hidden rounded-2xl border bg-surface transition ' +
                (n > 0 ? 'border-accent' : 'border-border')
              }
            >
              <div className="flex items-start gap-3 p-4">
                {pending && (
                  <input
                    type="checkbox"
                    checked={n > 0}
                    ref={(el) => { if (el) el.indeterminate = !!partial; }}
                    onChange={() => toggleGroupPick(g)}
                    aria-label={`เลือกทั้งกลุ่ม ${g.collection} ${g.category}`}
                    className="mt-1 h-5 w-5 shrink-0 accent-[var(--accent)]"
                  />
                )}

                <button
                  onClick={() => toggleOpen(g)}
                  aria-expanded={open}
                  className="flex min-w-0 flex-1 items-start justify-between gap-3 text-left"
                >
                  <div className="min-w-0">
                    <div className="font-medium">{g.collection}</div>
                    <div className="text-sm text-muted">{g.category}</div>
                    <div className="mt-1.5 text-xs text-muted">
                      {g.จำนวนแถว} ตัว · {baht(g.ราคาต่ำสุด)}–{baht(g.ราคาสูงสุด)} บาท
                    </div>
                    {partial && (
                      <div className="mt-1 text-xs text-accent">เลือกไว้ {n} จาก {pend.length} ตัว</div>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    {pending ? (
                      <span className="rounded-lg bg-warn/10 px-2 py-1 text-xs text-warn">
                        รอตรวจ {g.รอตรวจ}
                      </span>
                    ) : (
                      <span className="rounded-lg bg-ok/10 px-2 py-1 text-xs text-ok">
                        {g.อนุมัติแล้ว > 0 ? `อนุมัติ ${g.อนุมัติแล้ว}` : ''}
                        {g.อนุมัติแล้ว > 0 && g.ไม่เอา > 0 ? ' · ' : ''}
                        {g.ไม่เอา > 0 ? `ไม่เอา ${g.ไม่เอา}` : ''}
                      </span>
                    )}
                    <div className="mt-1 text-xs text-muted">{open ? '▲ ปิด' : '▼ ดูรายตัว'}</div>
                  </div>
                </button>
              </div>

              <div className="border-t border-border px-4 py-2.5 text-xs text-muted">
                {g.วัสดุที่มี && <div>วัสดุ: {g.วัสดุที่มี}</div>}
                {g.รูปทรงที่มี && <div className="mt-0.5">รูปทรง: {g.รูปทรงที่มี}</div>}
                {g.ไม่มีราคา > 0 && (
                  <div className="mt-0.5 text-warn">ไม่มีราคา {g.ไม่มีราคา} ตัว — จะยังตั้งราคาไม่ได้</div>
                )}
              </div>

              {open && (
                <div className="border-t border-border">
                  {!loaded ? (
                    <p className="p-4 text-sm text-muted">กำลังโหลด…</p>
                  ) : (
                    <>
                      <ul>
                        {loaded.map((r) => {
                          const canPick = r.review_status === 'รอตรวจ';
                          const on = p === 'all' ? canPick : !!p && p.has(r.id);
                          const vary = varyingFields(loaded);
                          const parts = ATTRS.filter(([kk]) => r[kk]).map(([kk, label]) => ({
                            k: kk,
                            label,
                            value: r[kk] as string,
                            differs: vary.has(kk),
                          }));

                          return (
                            <li
                              key={r.id}
                              onClick={canPick ? () => toggleRowPick(g, r.id) : undefined}
                              className={
                                'flex items-start gap-3 border-t border-border px-4 py-3 ' +
                                (canPick ? 'cursor-pointer ' : 'opacity-50 ') +
                                (canPick && !on ? 'opacity-45' : '')
                              }
                            >
                              <span className="pt-0.5">
                                {canPick ? (
                                  <input
                                    type="checkbox"
                                    checked={on}
                                    onChange={() => toggleRowPick(g, r.id)}
                                    onClick={(e) => e.stopPropagation()}
                                    aria-label={`เลือกแถว ${r.source_row_no}`}
                                    className="h-4 w-4 accent-[var(--accent)]"
                                  />
                                ) : (
                                  <span
                                    className={
                                      'text-xs ' +
                                      (r.review_status === 'อนุมัติแล้ว' ? 'text-ok' : 'text-danger')
                                    }
                                  >
                                    {r.review_status === 'อนุมัติแล้ว' ? '✓' : '✕'}
                                  </span>
                                )}
                              </span>

                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap gap-x-2 gap-y-1 text-xs">
                                  {parts.length === 0 && <span className="text-muted">—</span>}
                                  {parts.map((a) => (
                                    <span
                                      key={a.k}
                                      className={
                                        a.differs
                                          ? 'rounded bg-accent/15 px-1.5 py-0.5 font-medium text-accent'
                                          : 'px-0.5 py-0.5 text-muted'
                                      }
                                    >
                                      {a.value}
                                    </span>
                                  ))}
                                </div>
                                <div className="mt-1 text-[11px] text-muted">
                                  แถว {r.source_row_no} ·{' '}
                                  <span className={vary.has('size') ? 'text-accent' : ''}>
                                    {dimsOf(r)}
                                  </span>
                                </div>
                              </div>

                              <div className="shrink-0 text-right">
                                <div
                                  className={
                                    'text-xs whitespace-nowrap ' +
                                    (vary.has('price') ? 'font-medium text-accent' : '')
                                  }
                                >
                                  {baht(r.list_price_incl_vat)}
                                </div>
                                <div className="text-[11px] text-muted">
                                  {r.discount_pct === null ? '' : `ลด ${r.discount_pct}%`}
                                </div>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                      {varyingFields(loaded).size > 0 && (
                        <p className="border-t border-border px-4 py-2 text-[11px] text-muted">
                          ช่องที่
                          <span className="mx-1 rounded bg-accent/15 px-1.5 py-0.5 text-accent">เน้นสี</span>
                          คือช่องที่ทำให้แต่ละตัวต่างกัน
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {/* แถบล่าง · โผล่เมื่อเลือกอะไรไว้ ติดขอบล่างเพราะตรวจกันบนมือถือ */}
      {picked > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface/95 backdrop-blur">
          <div className="mx-auto max-w-5xl px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <div className="mb-2 text-center text-xs text-muted">
              เลือกไว้ <span className="font-medium text-text">{picked}</span> ตัว
              จาก {pickedGroups} กลุ่ม
            </div>
            <div className="flex gap-2">
              <button
                onClick={onApprove}
                disabled={busy}
                className="flex-1 rounded-xl bg-accent px-4 py-3.5 text-sm font-medium text-accent-fg disabled:opacity-50"
              >
                {busy ? 'กำลังออก SKU…' : `อนุมัติ ${picked} ตัว`}
              </button>
              <button
                onClick={onReject}
                disabled={busy}
                className="rounded-xl border border-border px-4 py-3.5 text-sm text-danger disabled:opacity-50"
              >
                ไม่เอา
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
