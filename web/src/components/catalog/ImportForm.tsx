'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { uploadPriceFile, cancelBatch, type UploadResult } from '@/modules/catalog/actions';
import type { Batch } from '@/modules/catalog/queries';

type Props = { batches: Batch[]; pendingRows: number };

export default function ImportForm({ batches, pendingRows }: Props) {
  const [result, setResult] = useState<UploadResult | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setResult(null);
    start(async () => {
      const res = await uploadPriceFile(fd);
      setResult(res);
      router.refresh();
    });
  }

  function onCancel(batchId: string, label: string) {
    if (!confirm(`ยกเลิกไฟล์ "${label}" ใช่ไหม\n\nแถวที่ยังไม่ได้ตรวจจะกลายเป็น "ไม่เอา"\nแถวที่อนุมัติไปแล้วจะไม่ถูกแตะ เพราะออก SKU ไปแล้ว`)) return;
    start(async () => {
      await cancelBatch(batchId);
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      {pendingRows > 0 && (
        <div className="rounded-2xl border border-warn/40 bg-warn/5 p-4 text-sm">
          <div className="font-medium text-warn">มีของรอตรวจอยู่แล้ว {pendingRows.toLocaleString('th-TH')} แถว</div>
          <p className="mt-1 text-muted">
            ถ้าอัปโหลดไฟล์เดิมซ้ำ จะได้ของซ้ำกันสองชุด และตอนอนุมัติจะออก SKU ให้ทั้งสองชุด
            ซึ่งเอาคืนไม่ได้ — ตรวจของเดิมให้จบก่อน หรือกดยกเลิกไฟล์เดิมข้างล่าง
          </p>
        </div>
      )}

      <form onSubmit={onSubmit} className="rounded-2xl border border-border bg-surface p-4">
        <label className="block text-sm font-medium" htmlFor="file">
          ไฟล์ราคา (.csv จาก Airtable)
        </label>
        <input
          id="file"
          name="file"
          type="file"
          accept=".csv,text/csv"
          required
          onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
          className="mt-2 block w-full cursor-pointer rounded-xl border border-border bg-bg px-3 py-2.5 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-accent-fg"
        />
        <p className="mt-2 text-xs text-muted">
          ต้องมีหัวตาราง Full name · Brand · Category · Collection Name · Retail Price include VAT
          ครบถึงจะอ่านได้ · บันทึกเป็น UTF-8
        </p>

        <button
          type="submit"
          disabled={pending || !fileName}
          className="mt-4 w-full rounded-xl bg-accent px-4 py-3 font-medium text-accent-fg disabled:opacity-50"
        >
          {pending ? 'กำลังอ่านไฟล์…' : 'อัปโหลดเข้าที่พักข้อมูล'}
        </button>

        <p className="mt-3 text-center text-xs text-muted">
          อัปโหลดแล้วยังไม่ใช่สินค้า — ยังไม่มี SKU และเซลส์ยังไม่เห็น
          <br />
          SKU จะออกตอนกดอนุมัติในหน้าตรวจเท่านั้น
        </p>
      </form>

      {result && !result.ok && (
        <div className="rounded-2xl border border-danger/40 bg-danger/5 p-4 text-sm">
          <div className="font-medium text-danger">อัปโหลดไม่สำเร็จ</div>
          <p className="mt-1 whitespace-pre-wrap">{result.error}</p>
        </div>
      )}

      {result && result.ok && (
        <div className="rounded-2xl border border-ok/40 bg-ok/5 p-4 text-sm">
          <div className="font-medium text-ok">
            เข้าที่พักข้อมูลแล้ว {result.inserted.toLocaleString('th-TH')} แถว
          </div>
          <p className="mt-1 text-muted">
            จัดเป็น {result.groups} กลุ่มให้ตรวจ — ตรวจ {result.groups} กลุ่ม
            แทนที่จะไล่ทีละ {result.inserted.toLocaleString('th-TH')} แถว
          </p>
          {result.problems.length > 0 && (
            <details className="mt-3">
              <summary className="cursor-pointer text-warn">
                มีข้อสังเกต {result.problems.length} รายการ
              </summary>
              <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-xs text-muted">
                {result.problems.map((p, i) => (
                  <li key={i}>แถว {p.row}: {p.message}</li>
                ))}
              </ul>
            </details>
          )}
          <a
            href="/catalog/review"
            role="button"
            className="mt-4 block rounded-xl bg-accent px-4 py-3 text-center font-medium text-accent-fg"
          >
            ไปหน้าตรวจ
          </a>
        </div>
      )}

      <section>
        <h2 className="text-sm font-medium text-muted">ไฟล์ที่เคยอัปโหลด</h2>
        {batches.length === 0 ? (
          <p className="mt-2 rounded-xl border border-border bg-surface p-4 text-sm text-muted">
            ยังไม่เคยอัปโหลดไฟล์ราคา
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {batches.map((b) => (
              <li
                key={b.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{b.source_file}</div>
                  <div className="text-xs text-muted">
                    {new Date(b.imported_at).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })}
                    {b.note ? ` · ${b.note}` : ''}
                  </div>
                </div>
                <button
                  onClick={() => onCancel(b.id, b.source_file)}
                  disabled={pending}
                  className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs text-danger disabled:opacity-50"
                >
                  ยกเลิกไฟล์
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
