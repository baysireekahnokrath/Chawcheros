'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * ช่องรับรหัสจากการสแกน
 *
 * รองรับสามทาง เรียงจากที่คนหน้าคลังจะใช้จริงมากที่สุด
 *   1. กล้องมือถือเปล่าๆ ส่อง QR แล้วกดลิงก์ที่เด้งมา — ไม่ต้องมาหน้านี้เลย
 *   2. เครื่องยิงบาร์โค้ด — มันพิมพ์ลงช่องนี้แล้วเคาะ Enter ให้เอง
 *   3. พิมพ์มือ ตอนสติกเกอร์เลอะจนสแกนไม่ติด
 *
 * ช่องนี้ autofocus ไว้ เครื่องยิงจะได้ยิงแล้วไปเลยโดยไม่ต้องแตะจอ
 */
export default function ScanBox() {
  const [code, setCode] = useState('');
  const [hint, setHint] = useState<string | null>(null);
  const ref = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => { ref.current?.focus(); }, []);

  function go(raw: string) {
    const m = raw.trim().match(/U\d{7}/i);
    if (!m) {
      setHint('รหัสต้องเป็นตัว U ตามด้วยตัวเลข 7 หลัก เช่น U0000042');
      return;
    }
    router.push(`/stock/u/${m[0].toUpperCase()}`);
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => { e.preventDefault(); go(code); }}
        className="rounded-2xl border border-border bg-surface p-4"
      >
        <label className="block text-sm font-medium" htmlFor="code">
          รหัสบนสติกเกอร์
        </label>
        <input
          ref={ref}
          id="code"
          value={code}
          onChange={(e) => { setCode(e.target.value); setHint(null); }}
          inputMode="text"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="U0000042"
          className="mt-1.5 w-full rounded-xl border border-border bg-bg px-3 py-3 font-mono text-lg tracking-wider outline-none focus:border-accent"
        />
        {hint && <p className="mt-2 text-xs text-danger">{hint}</p>}
        <button
          type="submit"
          disabled={!code.trim()}
          className="mt-4 w-full rounded-xl bg-accent px-4 py-3.5 font-medium text-accent-fg disabled:opacity-50"
        >
          เปิดตัวนี้
        </button>
      </form>

      <div className="rounded-2xl border border-border bg-surface p-4 text-sm">
        <div className="font-medium">เร็วกว่านั้น: ใช้กล้องมือถือเลย</div>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted">
          <li>เปิดแอปกล้องในมือถือ (ไม่ต้องลงแอปอะไรเพิ่ม)</li>
          <li>ส่องที่ QR บนสติกเกอร์</li>
          <li>กดลิงก์ที่เด้งขึ้นมา → เข้าหน้าตัวนั้นเลย</li>
        </ol>
        <p className="mt-2 text-xs text-muted">
          ถ้าใช้เครื่องยิงบาร์โค้ด ให้ยิงตอนที่ช่องข้างบนกะพริบอยู่ แล้วมันจะไปเองโดยไม่ต้องแตะจอ
        </p>
      </div>
    </div>
  );
}
