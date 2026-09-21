'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(
        error.message === 'Invalid login credentials'
          ? 'อีเมลหรือรหัสผ่านไม่ถูกต้อง'
          : error.message,
      );
      setBusy(false);
      return;
    }
    router.push(params.get('next') || '/');
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <label className="block text-sm font-medium" htmlFor="email">
        อีเมล
      </label>
      <input
        id="email"
        type="email"
        required
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="mt-1.5 w-full rounded-xl border border-border bg-bg px-3 py-2.5 outline-none focus:border-accent"
      />

      <label className="mt-4 block text-sm font-medium" htmlFor="password">
        รหัสผ่าน
      </label>
      <input
        id="password"
        type="password"
        required
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
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
        {busy ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}
      </button>
    </form>
  );
}
