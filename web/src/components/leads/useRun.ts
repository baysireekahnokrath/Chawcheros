'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

type Result = { ok: true } | { ok: false; error: string };

/** กดปุ่ม → เรียก server action → ผิดพลาดแสดงข้อความ · สำเร็จโหลดข้อมูลหน้าใหม่ */
export function useRun() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const router = useRouter();

  function run(fn: () => Promise<Result>, message?: string, after?: () => void) {
    setError(null);
    setDone(null);
    start(async () => {
      const r = await fn();
      if (!r.ok) {
        setError(r.error);
        return;
      }
      if (message) setDone(message);
      after?.();
      router.refresh();
    });
  }
  return { pending, error, done, run, setError };
}

export const btn =
  'inline-flex min-h-11 items-center justify-center rounded-xl border border-accent bg-accent px-4 py-2 text-sm font-medium text-accent-fg disabled:opacity-50';
export const btnGhost =
  'inline-flex min-h-11 items-center justify-center rounded-xl border border-border bg-surface px-4 py-2 text-sm font-medium disabled:opacity-50';
export const chipCls = (on: boolean, past = false) =>
  'inline-flex min-h-9 shrink-0 items-center whitespace-nowrap rounded-full border px-3 py-1 text-sm disabled:opacity-50 ' +
  (on
    ? 'border-accent bg-accent font-medium text-accent-fg'
    : past
      ? 'border-accent/40 bg-accent/10'
      : 'border-border bg-surface');
export const field =
  'w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-base outline-none focus:border-accent';
