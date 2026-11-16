'use client';

import { useId, useRef, useState } from 'react';
import { btnGhost, field } from './useRun';

/** ร่างข้อความ แก้ได้ก่อนคัดลอก · ระบบไม่ส่งเอง พนักงานไปวางในแชทของลูกค้าแล้วกดส่ง */
export default function DraftBox({ label, text, primary = false }: { label: string; text: string; primary?: boolean }) {
  const id = useId();
  const ref = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState(text);
  const [state, setState] = useState<'idle' | 'copied' | 'selected'>('idle');

  async function copy() {
    let ok = false;
    try {
      await navigator.clipboard.writeText(value);
      ok = true;
    } catch {
      // เบราว์เซอร์ในแอป (เช่น เปิดจาก LINE) บางตัวไม่ให้ใช้ clipboard · เลือกข้อความให้แทน
      ref.current?.focus();
      ref.current?.select();
      try {
        ok = document.execCommand('copy');
      } catch {
        ok = false;
      }
    }
    setState(ok ? 'copied' : 'selected');
    setTimeout(() => setState('idle'), 2500);
  }

  return (
    <div className="mt-2">
      <label htmlFor={id} className="mb-1 block text-xs text-muted">
        {label} (แก้ได้ก่อนคัดลอก)
      </label>
      <textarea id={id} ref={ref} rows={4} value={value} onChange={(e) => setValue(e.target.value)} className={field} />
      <button
        type="button"
        onClick={copy}
        className={
          (primary ? btnGhost.replace('border-border bg-surface', 'border-accent bg-accent text-accent-fg') : btnGhost) +
          ' mt-2 w-full'
        }
      >
        {state === 'copied' ? 'คัดลอกแล้ว ไปวางในแชทของลูกค้าได้เลย' : state === 'selected' ? 'เลือกข้อความให้แล้ว กดคัดลอกเองได้เลย' : 'คัดลอกข้อความ'}
      </button>
    </div>
  );
}
