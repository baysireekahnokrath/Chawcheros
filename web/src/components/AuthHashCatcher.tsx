'use client';

/**
 * ดักลิงก์กู้รหัสผ่านที่ไปลงผิดหน้า แล้วพามาที่ /reset
 *
 * ★ ทำไมต้องดักฝั่งเบราว์เซอร์ ทั้งที่ middleware ดักให้แล้ว
 *   Supabase ส่งผลลัพธ์กลับมาทาง "แฮช" (#) ด้วย ซึ่งเบราว์เซอร์ไม่ส่งไปให้เซิร์ฟเวอร์เลย
 *   middleware จึงมองไม่เห็น · ต้องมีตัวดักฝั่งนี้คู่กัน
 *
 * ★ เคสจริงที่ Bay เจอ (2026-11-12)
 *   http://localhost:3000/?error=access_denied&error_code=otp_expired
 *       #error=access_denied&error_code=otp_expired&...
 *   ลิงก์ไปลงหน้าแรกพร้อมข้อความ error ทั้งใน query และแฮช
 *   ถ้าไม่ดัก คนกดจะเจอหน้าแรกเฉย ๆ ไม่รู้ว่าเกิดอะไรขึ้น
 *
 * ใช้ window.location แทน router เพราะต้องพาแฮชไปด้วย · router ตัดแฮชทิ้ง
 */

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export default function AuthHashCatcher() {
  const path = usePathname();

  useEffect(() => {
    if (path === '/reset') return;
    const h = window.location.hash.replace(/^#/, '');
    if (!h) return;
    let p: URLSearchParams;
    try { p = new URLSearchParams(h); } catch { return; }
    const isAuth = p.has('error_code') || p.has('error')
      || p.has('access_token') || p.get('type') === 'recovery';
    if (!isAuth) return;
    window.location.replace(`/reset#${h}`);
  }, [path]);

  return null;
}
