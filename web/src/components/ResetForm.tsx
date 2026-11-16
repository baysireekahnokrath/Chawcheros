'use client';

/**
 * ตั้งรหัสผ่านใหม่ · ปลายทางของลิงก์ที่ส่งไปทางอีเมล
 *
 * ★ ไม่ต้องแลกโค้ดเอง
 *   createBrowserClient เปิดมาพร้อม detectSessionInUrl · มันแลก ?code= ให้เสร็จ
 *   ก่อน getSession() คืนค่า (getSession รอ initializePromise อยู่แล้ว)
 *   เรียก exchangeCodeForSession ซ้ำจะพังเพราะกุญแจถูกใช้ไปแล้ว
 *
 * ★ มี session อยู่แล้ว (ล็อกอินปกติ) ก็ใช้หน้านี้เปลี่ยนรหัสผ่านได้เหมือนกัน
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const MIN = 8;

/** ข้อความจาก Supabase ที่เด้งกลับมาทาง query หรือ hash ตอนลิงก์ใช้ไม่ได้ */
function whyBad(code: string | null): string {
  if (!code) return 'ลิงก์นี้ใช้ไม่ได้แล้ว';
  if (/expired/i.test(code)) return 'ลิงก์หมดอายุแล้ว';
  if (/access_denied|otp/i.test(code)) return 'ลิงก์นี้ถูกใช้ไปแล้ว หรือหมดอายุ';
  return 'ลิงก์นี้ใช้ไม่ได้แล้ว';
}

export default function ResetForm() {
  const router = useRouter();
  const [state, setState] = useState<'checking' | 'form' | 'bad'>('checking');
  const [why, setWhy] = useState('');
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const q = new URLSearchParams(window.location.search);
      const h = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const bad = q.get('error_code') ?? q.get('error') ?? h.get('error_code') ?? h.get('error');
      const sb = createClient();

      /**
       * ★ magic link ต้องรับเองตรงนี้ · ปล่อยให้ไลบรารีจัดการไม่ได้
       *
       * createBrowserClient ของ @supabase/ssr บังคับ flowType = 'pkce' ตายตัว
       * (ตั้งทับ options เสมอ แก้ไม่ได้) แล้วในไลบรารีเขียนไว้ว่า
       *   case 'implicit': if (this.flowType === 'pkce') throw 'Not a valid PKCE flow url.'
       * แปลว่า token ที่มาทางแฮช (#access_token=...) ถูกปฏิเสธทิ้งทุกครั้ง
       *
       * ลิงก์กู้รหัสจากหน้า Supabase (Authentication > Users > Send magic link)
       * ส่ง token มาทางแฮชแบบนี้ · ถ้าไม่รับเอง คนกดจะเข้าระบบไม่ได้เลย
       * ทั้งที่ token ใช้ได้จริง · Bay เจอของจริง 2026-11-12
       *
       * setSession ไม่สนใจ flowType จึงใช้ได้
       */
      const at = h.get('access_token'), rt = h.get('refresh_token');
      if (at && rt) await sb.auth.setSession({ access_token: at, refresh_token: rt });

      // getSession รอให้แลกโค้ดในลิงก์เสร็จก่อน จึงตอบได้แน่นอนว่ามี session ไหม
      const { data } = await sb.auth.getSession();
      if (!alive) return;
      if (data.session) {
        setState('form');
        // เก็บ token ออกจากแถบที่อยู่ ทั้ง query และแฮช · กันกดรีเฟรชแล้วงง และกัน token ติดอยู่ในประวัติ
        window.history.replaceState(null, '', window.location.pathname);
        return;
      }
      setWhy(whyBad(bad));
      setState('bad');
    })();
    return () => { alive = false; };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (pw1.length < MIN) { setError(`รหัสผ่านต้องยาวอย่างน้อย ${MIN} ตัว`); return; }
    if (pw1 !== pw2) { setError('รหัสผ่านสองช่องไม่ตรงกัน'); return; }

    setBusy(true);
    const { error } = await createClient().auth.updateUser({ password: pw1 });
    if (error) {
      setError(
        /same.*password|should be different/i.test(error.message)
          ? 'รหัสใหม่ซ้ำกับรหัสเดิม · ตั้งรหัสอื่น'
          : /weak|short|least/i.test(error.message)
            ? `รหัสผ่านสั้นเกินไป · อย่างน้อย ${MIN} ตัว`
            : error.message,
      );
      setBusy(false);
      return;
    }
    router.push('/');
    router.refresh();
  }

  if (state === 'checking') {
    return (
      <div className="rounded-2xl border border-border bg-surface p-6 text-center shadow-sm">
        <p className="text-sm text-muted">กำลังตรวจลิงก์…</p>
      </div>
    );
  }

  if (state === 'bad') {
    return (
      <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <p role="alert" className="rounded-lg bg-warn/10 px-3 py-2 text-sm text-warn">{why}</p>
        <ul className="mt-4 list-disc space-y-1 pl-5 text-xs text-muted">
          <li>
            ลิงก์ต้องเปิดใน<span className="font-medium">เครื่องเดียวกับที่กดขอ</span>
            {' '}— กดขอในมือถือแล้วเปิดในคอม จะใช้ไม่ได้
          </li>
          <li>ลิงก์ใช้ได้ครั้งเดียว และมีอายุจำกัด</li>
        </ul>
        <Link
          href="/login"
          className="mt-6 block w-full rounded-xl bg-accent px-4 py-3 text-center font-medium text-accent-fg"
        >
          ขอลิงก์ใหม่
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <label className="block text-sm font-medium" htmlFor="pw1">
        รหัสผ่านใหม่
      </label>
      <input
        id="pw1"
        type="password"
        required
        autoFocus
        autoComplete="new-password"
        value={pw1}
        onChange={(e) => setPw1(e.target.value)}
        className="mt-1.5 w-full rounded-xl border border-border bg-bg px-3 py-2.5 outline-none focus:border-accent"
      />
      <p className="mt-1.5 text-xs text-muted">อย่างน้อย {MIN} ตัว</p>

      <label className="mt-4 block text-sm font-medium" htmlFor="pw2">
        พิมพ์อีกครั้ง
      </label>
      <input
        id="pw2"
        type="password"
        required
        autoComplete="new-password"
        value={pw2}
        onChange={(e) => setPw2(e.target.value)}
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
        {busy ? 'กำลังบันทึก…' : 'บันทึกรหัสผ่านใหม่'}
      </button>

      {/* มาถึงหน้านี้ด้วย magic link ก็เท่ากับล็อกอินแล้ว · ไม่อยากเปลี่ยนรหัสก็ข้ามได้ */}
      <Link href="/" className="mt-4 block text-center text-xs text-muted underline underline-offset-2">
        เข้าใช้งานเลย ไม่เปลี่ยนรหัสผ่าน
      </Link>
    </form>
  );
}
