'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

/**
 * เข้าสู่ระบบ · และขอลิงก์ตั้งรหัสใหม่เมื่อลืมรหัสผ่าน
 *
 * ★ ลิงก์ที่ส่งไปทางอีเมลต้องเปิดในเครื่องเดียวกับที่กดขอ
 *   Supabase ใช้ PKCE · ตอนกดขอ เครื่องจะเก็บกุญแจครึ่งหนึ่งไว้ในเบราว์เซอร์
 *   เปิดลิงก์คนละเครื่องจึงต่อกุญแจไม่ติด · หน้า /reset บอกเรื่องนี้ไว้แล้ว
 *
 * ★ ไม่บอกว่าอีเมลนี้มีบัญชีอยู่หรือเปล่า
 *   ตอบข้อความเดียวกันทั้งสองกรณี คนนอกจะได้ไม่ใช้ช่องนี้ไล่เดาว่าใครมีบัญชี
 */
export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = useState<'login' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const supabase = createClient();

    if (mode === 'forgot') {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset`,
      });
      if (error) {
        // ดูที่รหัสสถานะ ไม่ใช่ข้อความ · ข้อความของ Supabase เปลี่ยนถ้อยคำอยู่เรื่อย
        const tooOften = error.status === 429 || /rate|limit|too many/i.test(error.message);
        setError(tooOften ? 'ขอถี่เกินไป · รอสักครู่แล้วลองใหม่' : error.message);
        setBusy(false);
        return;
      }
      setSent(email.trim());
      setBusy(false);
      return;
    }

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

  if (sent) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <p className="text-sm">
          ถ้า <span className="font-medium">{sent}</span> มีบัญชีอยู่ในระบบ
          จะได้รับลิงก์ตั้งรหัสใหม่ภายในไม่กี่นาที
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-muted">
          <li>ไม่เจอในกล่องจดหมาย ลองดูในถังขยะหรือจดหมายขยะ</li>
          <li>
            <span className="font-medium">เปิดลิงก์ในเครื่องนี้</span>
            {' '}เครื่องเดียวกับที่กดขอ — เปิดคนละเครื่องจะใช้ไม่ได้
          </li>
          <li>ลิงก์มีอายุจำกัด ถ้าหมดอายุกดขอใหม่ได้</li>
        </ul>
        <button
          type="button"
          onClick={() => { setSent(null); setMode('login'); setPassword(''); }}
          className="mt-6 w-full rounded-xl border border-border px-4 py-2.5 text-sm font-medium"
        >
          กลับไปหน้าเข้าสู่ระบบ
        </button>
      </div>
    );
  }

  const forgot = mode === 'forgot';

  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
      {forgot && (
        <p className="mb-4 text-sm text-muted">
          ใส่อีเมลที่ใช้เข้าระบบ แล้วเราจะส่งลิงก์สำหรับตั้งรหัสใหม่ไปให้
        </p>
      )}

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

      {!forgot && (
        <>
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
        </>
      )}

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
        {busy
          ? forgot ? 'กำลังส่ง…' : 'กำลังเข้าสู่ระบบ…'
          : forgot ? 'ส่งลิงก์ตั้งรหัสใหม่' : 'เข้าสู่ระบบ'}
      </button>

      <button
        type="button"
        onClick={() => { setMode(forgot ? 'login' : 'forgot'); setError(null); }}
        className="mt-4 block w-full text-center text-sm text-muted underline underline-offset-2"
      >
        {forgot ? 'กลับไปหน้าเข้าสู่ระบบ' : 'ลืมรหัสผ่าน?'}
      </button>
    </form>
  );
}
