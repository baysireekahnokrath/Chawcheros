'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

/**
 * ตั้งค่าครั้งแรก — ใช้ได้ครั้งเดียวตอนระบบยังไม่มีผู้ใช้เลย
 * คนแรกที่ตั้งค่า = เจ้าของ ได้สิทธิ์ครบทุกอย่าง
 */
export default function SetupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase
      .schema('core')
      .rpc('bootstrap_first_owner', { p_full_name: fullName });

    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }
    router.push('/');
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="text-xl font-semibold tracking-tight">ตั้งค่าครั้งแรก</h1>
      <p className="mt-1 text-sm text-muted">
        คุณเป็นคนแรกที่เข้าระบบนี้ จึงจะได้สิทธิ์เจ้าของทั้งหมด
        รวมถึงการเห็นต้นทุนและกำไร ซึ่งคนอื่นจะไม่เห็น
      </p>

      <form
        onSubmit={onSubmit}
        className="mt-6 rounded-2xl border border-border bg-surface p-6"
      >
        <label className="block text-sm font-medium" htmlFor="name">
          ชื่อที่ให้คนอื่นเห็น
        </label>
        <input
          id="name"
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="เช่น Bay"
          className="mt-1.5 w-full rounded-xl border border-border bg-bg px-3 py-2.5 outline-none focus:border-accent"
        />

        {error && (
          <p role="alert" className="mt-4 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="mt-6 w-full rounded-xl bg-accent px-4 py-3 font-medium text-accent-fg disabled:opacity-60"
        >
          {busy ? 'กำลังตั้งค่า…' : 'ตั้งค่าและเริ่มใช้งาน'}
        </button>
      </form>
    </div>
  );
}
