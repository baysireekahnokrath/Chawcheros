'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { approveRows, rejectRows, fetchGroupRows } from '@/modules/catalog/actions';
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

/**
 * หาว่าในกลุ่มนี้ ช่องไหนที่ค่าไม่เหมือนกัน
 *
 * เดิมผมเขียนว่า "ถ้ามีเกรดผ้าให้โชว์เกรดผ้า ไม่งั้นค่อยโชว์ไม้"
 * ผลคือ กีวี่ อาร์มแชร์ ไม้วอลนัท 39,600 กับ ไม้โอ๊ค 33,600
 * ขึ้นหน้าจอว่า "ผ้า A" เหมือนกันทั้งคู่ คนตรวจแยกไม่ออกว่าตัวไหนเป็นตัวไหน
 * เลิกเดาว่าช่องไหนสำคัญ — แสดงทุกช่องที่มีค่า แล้วเน้นช่องที่ต่างกัน
 */
function varyingFields(rows: ImportRow[]): Set<string> {
  const out = new Set<string>();
  for (const [k] of ATTRS) {
    if (new Set(rows.map((r) => r[k] ?? '')).size > 1) out.add(k);
  }
  if (new Set(rows.map(dimsOf)).size > 1) out.add('size');
  if (new Set(rows.map((r) => r.list_price_incl_vat)).size > 1) out.add('price');
  return out;
}

export default function ReviewList({ groups }: { groups: ImportGroup[] }) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [rows, setRows] = useState<Record<string, ImportRow[]>>({});
  const [picked, setPicked] = useState<Record<string, Set<string>>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [, start] = useTransition();
  const router = useRouter();

  const pendingGroups = groups.filter(isPending);
  const doneGroups = groups.filter((g) => !isPending(g));
  const visible = showDone ? groups : pendingGroups;

  function toggleGroup(g: ImportGroup) {
    const k = key(g);
    if (openKey === k) { setOpenKey(null); return; }
    setOpenKey(k);
    if (rows[k]) return;

    start(async () => {
      const res = await fetchGroupRows(g.collection, g.category);
      if (!res.ok) { setError(res.error); return; }
      setRows((prev) => ({ ...prev, [k]: res.rows }));
      // เปิดมาติ๊กไว้ทุกตัวก่อน — ส่วนใหญ่เอาทั้งกลุ่ม คนตรวจค่อยเอาออกทีละตัว
      setPicked((prev) => ({
        ...prev,
        [k]: new Set(res.rows.filter((r) => r.review_status === 'รอตรวจ').map((r) => r.id)),
      }));
    });
  }

  function toggleRow(k: string, id: string) {
    setPicked((prev) => {
      const next = new Set(prev[k] ?? []);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { ...prev, [k]: next };
    });
  }

  function pickAll(k: string, all: boolean) {
    const pendingIds = (rows[k] ?? []).filter((r) => r.review_status === 'รอตรวจ').map((r) => r.id);
    setPicked((prev) => ({ ...prev, [k]: new Set(all ? pendingIds : []) }));
  }

  /** ตัวที่เลือกอยู่ · ถ้ายังไม่เปิดดูรายละเอียด ถือว่าเลือกทั้งกลุ่ม */
  function chosen(g: ImportGroup): string[] | null {
    const k = key(g);
    if (!rows[k]) return null;              // null = ยังไม่โหลด ใช้ทั้งกลุ่ม
    return Array.from(picked[k] ?? []);
  }

  function countFor(g: ImportGroup): number {
    const c = chosen(g);
    return c === null ? g.รอตรวจ : c.length;
  }

  async function idsFor(g: ImportGroup): Promise<string[]> {
    const c = chosen(g);
    if (c !== null) return c;
    const res = await fetchGroupRows(g.collection, g.category);
    if (!res.ok) throw new Error(res.error);
    return res.rows.filter((r) => r.review_status === 'รอตรวจ').map((r) => r.id);
  }

  function onApprove(g: ImportGroup) {
    const n = countFor(g);
    if (n === 0) { setError('ยังไม่ได้เลือกตัวไหนเลย'); return; }
    if (!confirm(
      `อนุมัติ ${n} ตัว ในรุ่น "${g.collection} · ${g.category}" ใช่ไหม\n\n` +
      `จะออก SKU ให้ ${n} ตัวนี้\n` +
      `SKU ออกแล้วออกเลย ใช้ซ้ำไม่ได้ และแก้ไม่ได้ตลอดอายุสินค้า`,
    )) return;

    setError(null);
    setBusy(key(g));
    start(async () => {
      try {
        const res = await approveRows(await idsFor(g));
        if (!res.ok) setError(res.error);
        else { setRows((p) => { const q = { ...p }; delete q[key(g)]; return q; }); router.refresh(); }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(null);
      }
    });
  }

  function onReject(g: ImportGroup) {
    const n = countFor(g);
    if (n === 0) { setError('ยังไม่ได้เลือกตัวไหนเลย'); return; }
    const note = prompt(
      `ไม่เอา ${n} ตัว ในรุ่น "${g.collection} · ${g.category}" — เพราะอะไร?\n\n` +
      `(เช่น เลิกขายแล้ว / ซ้ำกับรุ่นอื่น / ราคายังไม่นิ่ง)\n` +
      `ข้อมูลไม่ได้ถูกลบ แค่เปลี่ยนสถานะ ย้อนดูทีหลังได้`,
      '',
    );
    if (note === null) return;

    setError(null);
    setBusy(key(g));
    start(async () => {
      try {
        const res = await rejectRows(await idsFor(g), note);
        if (!res.ok) setError(res.error);
        else { setRows((p) => { const q = { ...p }; delete q[key(g)]; return q; }); router.refresh(); }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(null);
      }
    });
  }

  const total = groups.length;
  const done = doneGroups.length;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-surface p-4">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-medium">ตรวจแล้ว {done} จาก {total} กลุ่ม</span>
          <span className="text-xs text-muted">เหลือ {total - done}</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-border">
          <div
            className="h-full rounded-full bg-ok transition-all"
            style={{ width: total === 0 ? '0%' : `${(done / total) * 100}%` }}
          />
        </div>
        {doneGroups.length > 0 && (
          <button
            onClick={() => setShowDone((v) => !v)}
            className="mt-3 text-xs text-accent underline-offset-2 hover:underline"
          >
            {showDone ? 'ซ่อนกลุ่มที่ตรวจแล้ว' : `แสดงกลุ่มที่ตรวจแล้วด้วย (${done})`}
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-2xl border border-danger/40 bg-danger/5 p-4 text-sm">
          <div className="font-medium text-danger">ทำรายการไม่สำเร็จ</div>
          <p className="mt-1">{error}</p>
        </div>
      )}

      {visible.length === 0 && (
        <p className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted">
          {total === 0
            ? 'ยังไม่มีข้อมูลรอตรวจ — ไปอัปโหลดไฟล์ราคาก่อน'
            : 'ตรวจครบทุกกลุ่มแล้ว 🎉'}
        </p>
      )}

      <ul className="space-y-3">
        {visible.map((g) => {
          const k = key(g);
          const open = openKey === k;
          const working = busy === k;
          const pending = isPending(g);
          const loaded = rows[k];
          const sel = picked[k] ?? new Set<string>();
          const n = countFor(g);
          const pendingInGroup = (loaded ?? []).filter((r) => r.review_status === 'รอตรวจ');
          const partial = loaded != null && n > 0 && n < pendingInGroup.length;

          return (
            <li key={k} className="overflow-hidden rounded-2xl border border-border bg-surface">
              <button
                onClick={() => toggleGroup(g)}
                aria-expanded={open}
                className="flex w-full items-start justify-between gap-3 p-4 text-left"
              >
                <div className="min-w-0">
                  <div className="font-medium">{g.collection}</div>
                  <div className="text-sm text-muted">{g.category}</div>
                  <div className="mt-1.5 text-xs text-muted">
                    {g.จำนวนแถว} ตัว · {baht(g.ราคาต่ำสุด)}–{baht(g.ราคาสูงสุด)} บาท
                  </div>
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
                  <div className="mt-1 text-xs text-muted">{open ? '▲' : '▼'}</div>
                </div>
              </button>

              <div className="border-t border-border px-4 py-3 text-xs text-muted">
                {g.วัสดุที่มี && <div>วัสดุ: {g.วัสดุที่มี}</div>}
                {g.รูปทรงที่มี && <div className="mt-0.5">รูปทรง: {g.รูปทรงที่มี}</div>}
                {g.ไม่มีราคา > 0 && (
                  <div className="mt-0.5 text-warn">ไม่มีราคา {g.ไม่มีราคา} ตัว — จะยังตั้งราคาไม่ได้</div>
                )}
                {pending && !open && (
                  <div className="mt-1 text-accent">แตะเพื่อเลือกเฉพาะบางตัว</div>
                )}
              </div>

              {open && (
                <div className="border-t border-border">
                  {!loaded ? (
                    <p className="p-4 text-sm text-muted">กำลังโหลด…</p>
                  ) : (
                    <>
                      {pendingInGroup.length > 1 && (
                        <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-2 text-xs">
                          <span className="text-muted">เลือกไว้ {n} จาก {pendingInGroup.length} ตัว</span>
                          <span className="flex gap-3">
                            <button onClick={() => pickAll(k, true)} className="text-accent">เลือกทั้งหมด</button>
                            <button onClick={() => pickAll(k, false)} className="text-accent">ไม่เลือกเลย</button>
                          </span>
                        </div>
                      )}
                      <ul>
                        {loaded.map((r) => {
                          const canPick = r.review_status === 'รอตรวจ';
                          const on = sel.has(r.id);
                          const vary = varyingFields(loaded);
                          const parts = ATTRS.filter(([k]) => r[k]).map(([k, label]) => ({
                            k,
                            label,
                            value: r[k] as string,
                            differs: vary.has(k),
                          }));

                          return (
                            <li
                              key={r.id}
                              onClick={canPick ? () => toggleRow(k, r.id) : undefined}
                              className={
                                'flex items-start gap-3 border-t border-border px-3 py-3 ' +
                                (canPick ? 'cursor-pointer ' : '') +
                                (canPick && !on ? 'opacity-40' : '')
                              }
                            >
                              <span className="pt-0.5">
                                {canPick ? (
                                  <input
                                    type="checkbox"
                                    checked={on}
                                    onChange={() => toggleRow(k, r.id)}
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
                        <p className="border-t border-border px-3 py-2 text-[11px] text-muted">
                          ช่องที่<span className="mx-1 rounded bg-accent/15 px-1.5 py-0.5 text-accent">เน้นสี</span>
                          คือช่องที่ทำให้แต่ละตัวต่างกัน
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}

              {pending && (
                <div className="border-t border-border p-3">
                  {partial && (
                    <p className="mb-2 text-center text-xs text-warn">
                      เลือกไว้ {n} ตัว · อีก {pendingInGroup.length - n} ตัวจะยังค้างรอตรวจไว้
                    </p>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => onApprove(g)}
                      disabled={working || n === 0}
                      className="flex-1 rounded-xl bg-accent px-4 py-3 text-sm font-medium text-accent-fg disabled:opacity-50"
                    >
                      {working ? 'กำลังออก SKU…' : `อนุมัติ ${n} ตัว`}
                    </button>
                    <button
                      onClick={() => onReject(g)}
                      disabled={working || n === 0}
                      className="rounded-xl border border-border px-4 py-3 text-sm text-danger disabled:opacity-50"
                    >
                      ไม่เอา {n} ตัว
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
