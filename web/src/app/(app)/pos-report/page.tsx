'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type Item = { name: string; v: string; price: number; qty: number };
type Sale = {
  id: string; bill_no: string; sold_at: string; sold_on: string; seller: string; items: Item[];
  subtotal: number; discount: number; total: number; pay: string; customer: string; phone: string;
  status: string; ship_method?: string; ship_address?: string; label_printed_at?: string | null;
};

const baht = (n: number) => '฿' + Math.round(Number(n)).toLocaleString('th-TH');
const ymd = (d: Date) => d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Bangkok' });
const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return ymd(d); };
const thDay = (s: string) => new Date(s + 'T12:00:00').toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short' });

const RANGES = [
  { key: 'today', label: 'วันนี้', from: () => daysAgo(0) },
  { key: '4d', label: '4 วันล่าสุด', from: () => daysAgo(3) },
  { key: '7d', label: '7 วัน', from: () => daysAgo(6) },
  { key: '30d', label: '30 วัน', from: () => daysAgo(29) },
] as const;

function Bars({ rows, max }: { rows: { label: string; value: number; sub?: string }[]; max: number }) {
  return (
    <ul className="grid min-w-0 grid-cols-1 gap-2.5">
      {rows.map((r) => (
        <li key={r.label} className="grid min-w-0 gap-1">
          <div className="flex min-w-0 items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 flex-1 truncate">{r.label}</span>
            <span className="shrink-0 tabular-nums font-medium">{baht(r.value)}{r.sub && <span className="ml-1.5 text-xs font-normal text-muted">{r.sub}</span>}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-border/60">
            <div className="h-full rounded-full bg-accent" style={{ width: `${max ? Math.max(2, (r.value / max) * 100) : 0}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function Card({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="min-w-0 rounded-2xl border border-border bg-surface p-4">
      <div className="mb-3 flex items-center justify-between gap-2"><h2 className="text-sm font-semibold">{title}</h2>{right}</div>
      {children}
    </section>
  );
}

export default function PosReportPage() {
  const supabase = useMemo(() => createClient(), []);
  const [range, setRange] = useState<(typeof RANGES)[number]['key']>('4d');
  const [rows, setRows] = useState<Sale[] | null>(null);
  const [err, setErr] = useState('');

  const from = RANGES.find((r) => r.key === range)!.from();
  const to = daysAgo(0);

  useEffect(() => {
    let alive = true;
    const run = async () => {
      const { data, error } = await supabase.schema('pos').from('sales').select('*')
        .gte('sold_on', from).lte('sold_on', to).order('sold_at', { ascending: false }).limit(5000);
      if (!alive) return;
      if (error) setErr('โหลดยอดขายไม่ได้: ' + error.message);
      else { setErr(''); setRows((data ?? []) as Sale[]); }
    };
    run();
    const t = setInterval(run, 60000);
    return () => { alive = false; clearInterval(t); };
  }, [supabase, from, to]);

  const ok = (rows ?? []).filter((r) => r.status !== 'ยกเลิก');
  const total = ok.reduce((a, r) => a + Number(r.total), 0);
  const disc = ok.reduce((a, r) => a + Number(r.discount), 0);
  const avg = ok.length ? total / ok.length : 0;

  const group = (key: (r: Sale) => string) => {
    const m = new Map<string, { value: number; n: number }>();
    ok.forEach((r) => { const k = key(r) || 'ไม่ระบุ'; const g = m.get(k) ?? { value: 0, n: 0 }; g.value += Number(r.total); g.n += 1; m.set(k, g); });
    return [...m.entries()].map(([label, g]) => ({ label, value: g.value, sub: `${g.n} บิล` })).sort((a, b) => b.value - a.value);
  };

  // รายวัน ครบทุกวันในช่วง (วันที่ไม่มีขายเป็น 0)
  const days: { label: string; value: number; sub?: string }[] = [];
  for (let d = new Date(from + 'T12:00:00'); ymd(d) <= to; d.setDate(d.getDate() + 1)) {
    const k = ymd(d); const day = ok.filter((r) => r.sold_on === k);
    days.push({ label: thDay(k), value: day.reduce((a, r) => a + Number(r.total), 0), sub: `${day.length} บิล` });
  }
  const dayRows = range === '30d' ? days.filter((d) => d.value > 0) : days;

  const prodMap = new Map<string, { value: number; qty: number }>();
  ok.forEach((r) => r.items.forEach((l) => {
    const k = l.name + (l.v ? ' · ' + l.v : ''); const g = prodMap.get(k) ?? { value: 0, qty: 0 };
    g.value += l.price * l.qty; g.qty += l.qty; prodMap.set(k, g);
  }));
  const products = [...prodMap.entries()].map(([label, g]) => ({ label, value: g.value, sub: `${g.qty} ชิ้น` })).sort((a, b) => b.value - a.value);

  const toShip = ok.filter((r) => r.ship_method && r.ship_method !== 'รับเอง');
  const unprinted = toShip.filter((r) => r.ship_method === 'EMS' && !r.label_printed_at).length;
  const contacts = ok.filter((r) => r.customer || r.phone);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">รายงานยอดขายหน้าบูธ</h1>
          <p className="mt-1 text-sm text-muted">{thDay(from)} – {thDay(to)} · ไม่นับบิลยกเลิก · อัปเดตเองทุกนาที</p>
        </div>
        <Link href="/pos-admin" className="rounded-xl border border-border bg-surface px-3 py-2 text-sm">ไปหลังบ้าน →</Link>
      </div>

      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="ช่วงวันที่">
        {RANGES.map((r) => (
          <button key={r.key} onClick={() => setRange(r.key)} aria-pressed={range === r.key}
            className={'rounded-xl border px-3 py-2 text-sm ' + (range === r.key ? 'border-accent bg-accent/10 font-medium text-accent' : 'border-border bg-surface text-muted')}>
            {r.label}
          </button>
        ))}
      </div>

      {err && <p className="mt-4 rounded-xl border border-danger px-3 py-2 text-sm text-danger">{err}</p>}

      {rows === null ? <p className="mt-6 text-sm text-muted">กำลังโหลด…</p> : (
        <>
          <div className="mt-4 rounded-2xl bg-accent p-5 text-accent-fg">
            <p className="text-sm opacity-80">ยอดขายสุทธิ</p>
            <p className="text-4xl font-semibold tabular-nums break-words">{baht(total)}</p>
            <p className="mt-1 text-sm opacity-80">{ok.length} บิล · เฉลี่ย {baht(avg)} ต่อบิล · ให้ส่วนลดไป {baht(disc)}</p>
          </div>

          {(unprinted > 0 || toShip.length > 0) && (
            <Link href="/pos-admin" className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-warn bg-warn/10 p-4 text-sm">
              <span className="min-w-0"><b className="font-semibold">ต้องส่งของ {toShip.length} บิล</b>{unprinted > 0 && ` · EMS ยังไม่พิมพ์ใบปะหน้า ${unprinted} บิล`}</span>
              <span className="shrink-0 font-medium">พิมพ์ใบปะหน้า →</span>
            </Link>
          )}

          {ok.length === 0 ? (
            <p className="mt-6 rounded-2xl border border-border bg-surface p-4 text-sm text-muted">ยังไม่มีบิลในช่วงนี้ · ลองเลือกช่วงวันที่ยาวขึ้น</p>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <Card title="ยอดรายวัน"><Bars rows={dayRows} max={Math.max(...dayRows.map((d) => d.value), 0)} /></Card>
              <Card title="สินค้าขายดี" right={<span className="text-xs text-muted">ยอดก่อนส่วนลด</span>}>
                <Bars rows={products.slice(0, 10)} max={products[0]?.value ?? 0} />
              </Card>
              <Card title="วิธีชำระเงิน"><Bars rows={group((r) => r.pay)} max={total} /></Card>
              <Card title="คนขาย"><Bars rows={group((r) => r.seller)} max={group((r) => r.seller)[0]?.value ?? 0} /></Card>
              <Card title="วิธีรับสินค้า"><Bars rows={group((r) => r.ship_method ?? 'รับเอง')} max={total} /></Card>
              <Card title={`ลูกค้าที่ทิ้งชื่อ/เบอร์ (${contacts.length})`} right={<span className="text-xs text-muted">ทักขอบคุณได้</span>}>
                {contacts.length === 0 ? <p className="text-sm text-muted">ยังไม่มี</p> : (
                  <ul className="grid min-w-0 grid-cols-1 gap-2 text-sm">
                    {contacts.slice(0, 20).map((r) => (
                      <li key={r.id} className="flex min-w-0 items-baseline justify-between gap-3 border-b border-border pb-2 last:border-0">
                        <span className="min-w-0 flex-1"><span className="block truncate"><span className="font-medium">{r.customer || 'ไม่ระบุชื่อ'}</span> <span className="text-muted">{r.phone}</span></span><span className="block truncate text-xs text-muted">{r.items.map((l) => l.name).join(', ')}</span></span>
                        <span className="shrink-0 tabular-nums">{baht(r.total)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          )}
        </>
      )}
    </>
  );
}
