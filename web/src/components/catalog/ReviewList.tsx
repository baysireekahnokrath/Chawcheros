'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { approveGroup, rejectGroup, fetchGroupRows } from '@/modules/catalog/actions';
import type { ImportGroup, ImportRow } from '@/modules/catalog/queries';

const baht = (n: number | null) =>
  n === null ? '—' : n.toLocaleString('th-TH', { maximumFractionDigits: 0 });

const key = (g: ImportGroup) => `${g.collection}\u0000${g.category}`;

/** ยังตรวจไม่เสร็จ = ยังมีแถวรอตรวจอยู่ */
const isPending = (g: ImportGroup) => g.รอตรวจ > 0;

export default function ReviewList({ groups }: { groups: ImportGroup[] }) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [rows, setRows] = useState<Record<string, ImportRow[]>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [, start] = useTransition();
  const router = useRouter();

  const pendingGroups = groups.filter(isPending);
  const doneGroups = groups.filter((g) => !isPending(g));
  const visible = showDone ? groups : pendingGroups;

  function toggle(g: ImportGroup) {
    const k = key(g);
    if (openKey === k) { setOpenKey(null); return; }
    setOpenKey(k);
    if (rows[k]) return;
    start(async () => {
      const res = await fetchGroupRows(g.collection, g.category);
      if (res.ok) setRows((prev) => ({ ...prev, [k]: res.rows }));
      else setError(res.error);
    });
  }

  function onApprove(g: ImportGroup) {
    const msg =
      `อนุมัติ "${g.collection} · ${g.category}" ใช่ไหม\n\n` +
      `จะออก SKU ให้ ${g.รอตรวจ} ตัว\n\n` +
      `SKU ออกแล้วออกเลย ใช้ซ้ำไม่ได้ และแก้ไม่ได้ตลอดอายุสินค้า`;
    if (!confirm(msg)) return;

    setError(null);
    setBusy(key(g));
    start(async () => {
      const res = await approveGroup(g.collection, g.category);
      setBusy(null);
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  function onReject(g: ImportGroup) {
    const note = prompt(
      `ไม่เอากลุ่ม "${g.collection} · ${g.category}" — เพราะอะไร?\n\n` +
        `(เช่น เลิกขายแล้ว / ซ้ำกับรุ่นอื่น / ราคายังไม่นิ่ง)\n` +
        `ข้อมูลไม่ได้ถูกลบ แค่เปลี่ยนสถานะ ย้อนดูทีหลังได้`,
      '',
    );
    if (note === null) return;

    setError(null);
    setBusy(key(g));
    start(async () => {
      const res = await rejectGroup(g.collection, g.category, note);
      setBusy(null);
      if (!res.ok) setError(res.error);
      else router.refresh();
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

          return (
            <li key={k} className="overflow-hidden rounded-2xl border border-border bg-surface">
              <button
                onClick={() => toggle(g)}
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
                      {g.อนุมัติแล้ว > 0 ? `อนุมัติ ${g.อนุมัติแล้ว}` : `ไม่เอา ${g.ไม่เอา}`}
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
              </div>

              {open && (
                <div className="border-t border-border">
                  {!rows[k] ? (
                    <p className="p-4 text-sm text-muted">กำลังโหลด…</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-bg text-muted">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium">แถว</th>
                            <th className="px-3 py-2 text-left font-medium">วัสดุ / ไม้</th>
                            <th className="px-3 py-2 text-left font-medium">รูปทรง</th>
                            <th className="px-3 py-2 text-left font-medium">ขนาด (ก×ล×ส)</th>
                            <th className="px-3 py-2 text-right font-medium">ราคา</th>
                            <th className="px-3 py-2 text-right font-medium">ลด</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows[k].map((r) => (
                            <tr key={r.id} className="border-t border-border">
                              <td className="px-3 py-2 text-muted">{r.source_row_no}</td>
                              <td className="px-3 py-2">
                                {r.material_grade ?? [r.wood, r.wood_colour].filter(Boolean).join(' ') ?? '—'}
                              </td>
                              <td className="px-3 py-2">{r.sub_category ?? '—'}</td>
                              <td className="px-3 py-2 whitespace-nowrap">
                                {[r.width_cm, r.depth_cm, r.height_cm].map((v) => v ?? '—').join('×')}
                                {r.seat_height_cm !== null && (
                                  <span className="text-muted"> (นั่ง {r.seat_height_cm})</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-right whitespace-nowrap">
                                {baht(r.list_price_incl_vat)}
                              </td>
                              <td className="px-3 py-2 text-right text-muted">
                                {r.discount_pct === null ? '—' : `${r.discount_pct}%`}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {pending && (
                <div className="flex gap-2 border-t border-border p-3">
                  <button
                    onClick={() => onApprove(g)}
                    disabled={working}
                    className="flex-1 rounded-xl bg-accent px-4 py-3 text-sm font-medium text-accent-fg disabled:opacity-50"
                  >
                    {working ? 'กำลังออก SKU…' : `อนุมัติ ${g.รอตรวจ} ตัว`}
                  </button>
                  <button
                    onClick={() => onReject(g)}
                    disabled={working}
                    className="rounded-xl border border-border px-4 py-3 text-sm text-danger disabled:opacity-50"
                  >
                    ไม่เอา
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
