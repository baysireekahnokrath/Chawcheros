'use client';

import { useState, useTransition } from 'react';
import { testWordpress } from '@/modules/content/wp-actions';
import type { WpHealth } from '@/modules/content/wordpress';

const panel = 'rounded-2xl border border-border bg-surface p-4';

type Row = { key: string; name: string; detail: string; env: string[]; round?: string };

/**
 * แบรนด์ → เชื่อมต่อ (X-01–03)
 * ไม่มีช่องพิมพ์ token ในระบบ · token อยู่ใน Vercel เท่านั้น หน้านี้บอกแค่ชื่อตัวแปร
 */
export default function ConnectTab({ wp }: { wp: { connected: boolean; site: string } }) {
  const [res, setRes] = useState<WpHealth | null>(null);
  const [pending, start] = useTransition();

  const rows: Row[] = [
    { key: 'wp', name: 'WordPress', detail: `${wp.site.replace(/^https?:\/\//, '')} · ส่งบทความเป็น Draft · ผู้ใช้สิทธิ์ Author`, env: ['WP_USER', 'WP_APP_PASSWORD'] },
    { key: 'line', name: 'Line OA', detail: 'ส่งข้อความหาเพื่อน · 1 แบรนด์ 1 บัญชี', env: [], round: 'R8' },
    { key: 'meta', name: 'Meta · Facebook + Instagram', detail: 'ดึงยอดโพสต์', env: [], round: 'R9' },
    { key: 'ga', name: 'Google Analytics 4 + Search Console', detail: 'ยอดเว็บ · conversion (book_showroom)', env: [], round: 'R10' },
  ];

  function pill(key: string) {
    if (key !== 'wp') return <span className="rounded-lg bg-muted/10 px-2 py-0.5 text-xs text-muted">— ยังไม่ต่อ</span>;
    if (!wp.connected) return <span className="rounded-lg bg-muted/10 px-2 py-0.5 text-xs text-muted">— ยังไม่ต่อ</span>;
    if (res && !res.ok) return <span className="rounded-lg bg-danger/10 px-2 py-0.5 text-xs text-danger">⚠️ เสีย</span>;
    if (res?.ok) return <span className="rounded-lg bg-ok/10 px-2 py-0.5 text-xs text-ok">✅ ใช้ได้</span>;
    return <span className="rounded-lg bg-muted/10 px-2 py-0.5 text-xs text-muted">ตั้งค่าแล้ว · กดทดสอบ</span>;
  }

  return (
    <div className="space-y-4">
      <div className={panel + ' divide-y divide-border py-1'}>
        {rows.map((r) => (
          <div key={r.key} className="py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold">{r.name}</h3>
                <p className="text-xs text-muted">{r.detail}{r.round ? ` · ต่อในรอบ ${r.round}` : ''}</p>
              </div>
              <div className="flex items-center gap-2">
                {pill(r.key)}
                {r.key === 'wp' && (
                  <button onClick={() => { setRes(null); start(async () => setRes(await testWordpress())); }} disabled={pending || !wp.connected}
                    className="rounded-lg border border-border px-2.5 py-1 text-xs disabled:opacity-40">
                    {pending ? 'กำลังทดสอบ…' : 'ทดสอบ'}
                  </button>
                )}
              </div>
            </div>
            {r.env.length > 0 && (
              <p className="mt-1 text-xs text-muted">ตัวแปรใน Vercel: {r.env.map((e) => <code key={e} className="mr-1 rounded bg-bg px-1">{e}</code>)}</p>
            )}
            {r.key === 'wp' && res && (
              <div role="status" className={'mt-2 rounded-xl px-3 py-2 text-xs ' + (res.ok ? 'bg-ok/5' : 'bg-danger/5 text-danger')}>
                {res.ok ? (
                  <>
                    <p>✓ ล็อกอินได้ในชื่อ <b>{res.name}</b> · สิทธิ์ {res.roles.join(', ') || '(ไม่ทราบ)'}</p>
                    {res.roles.includes('administrator') || res.roles.includes('editor')
                      ? <p className="mt-1 text-warn">⚠️ ผู้ใช้นี้ Publish ได้ · แนะนำเปลี่ยนเป็น Author ใน wp-admin</p> : null}
                    <p className="mt-1">{res.yoast
                      ? '✓ ช่อง Yoast เปิดแล้ว · ระบบใส่ meta description กับคำค้นหลักให้เอง'
                      : '— ช่อง Yoast ยังไม่เปิด · ระบบส่งบทความได้ แต่ meta description ต้องใส่เองในกล่อง Yoast (เปิดได้ด้วย snippet 1 ชิ้น ดูคู่มือจากผม)'}</p>
                  </>
                ) : res.error}
              </div>
            )}
            {r.key === 'wp' && (
              <a href={`${wp.site}/wp-admin/`} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-accent underline">เปิด wp-admin ↗</a>
            )}
          </div>
        ))}
      </div>
      <p className="text-xs text-muted">ไม่มีช่องพิมพ์ token ในระบบ · token และรหัสใส่ใน Vercel → Settings → Environment Variables เท่านั้น</p>
    </div>
  );
}
