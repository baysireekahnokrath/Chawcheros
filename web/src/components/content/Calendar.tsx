'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { movePlacements } from '@/modules/content/actions';
import {
  PHASE1_CHANNELS, channelShort,
  type CalItem, type CalPlacement, type Pillar, type Model, type Person,
} from '@/modules/content/types';

/**
 * ปฏิทินคอนเทนต์ (R4 · Q-20–29)
 * การ์ด 1 ใบ = ชิ้นงาน × วัน · โชว์เฉพาะช่องทางของวันนั้น (Q-23)
 * มือถือเปิดมาเป็นกำหนดการ · คอมเปิดมาเป็นเดือน (Q-20 Q-21)
 * คอมลากการ์ดเปลี่ยนวัน · มือถือแตะการ์ดแล้วเลือกวัน (Q-26)
 */

type View = 'agenda' | 'day' | '3day' | 'week' | 'month';
type Card = { item: CalItem; date: string; placements: CalPlacement[] };

const VIEWS: [View, string][] = [['agenda', 'กำหนดการ'], ['day', 'วัน'], ['3day', '3 วัน'], ['week', 'สัปดาห์'], ['month', 'เดือน']];
const WD = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
const MON = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const MON_S = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

// วันที่เป็นข้อความ YYYY-MM-DD ตลอด · เลี่ยงปัญหาเขตเวลา
const toD = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const toS = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (s: string, n: number) => { const d = toD(s); d.setDate(d.getDate() + n); return toS(d); };
const addMonths = (s: string, n: number) => { const d = toD(s); return toS(new Date(d.getFullYear(), d.getMonth() + n, 1)); };
const short = (s: string) => { const d = toD(s); return `${d.getDate()} ${MON_S[d.getMonth()]}`; };
const isDirectImage = (u: string) => /\.(jpe?g|png|webp|gif|avif)(\?|$)/i.test(u);

/** สีแถบสถานะเล็กบนการ์ด (Q-27) */
const STAGE_COLOR: Record<string, string> = {
  ไอเดีย: 'var(--muted)', กำลังทำ: 'var(--warn)', รอตรวจ: 'var(--locked)', ตีกลับแก้: 'var(--danger)',
  พร้อมโพสต์: 'var(--ok)', โพสต์แล้ว: 'var(--ok)',
};
/** แคมเปญยังไม่มีสีในระบบ · ให้สีจากรหัสแคมเปญ คงที่ทุกครั้ง */
const CAMPAIGN_COLORS = ['#b45309', '#0f766e', '#7c3aed', '#be185d', '#1d4ed8', '#4d7c0f', '#c2410c', '#0e7490'];
const hashColor = (id: string) => CAMPAIGN_COLORS[[...id].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7) % CAMPAIGN_COLORS.length];

export default function Calendar({ items, placements, pillars, campaigns, models, team, today }: {
  items: CalItem[]; placements: CalPlacement[]; pillars: Pillar[]; campaigns: { id: string; name: string }[];
  models: Model[]; team: Person[]; today: string;
}) {
  const [view, setView] = useState<View>('agenda');
  const [cursor, setCursor] = useState(today);
  const [colorBy, setColorBy] = useState<'pillar' | 'campaign'>('pillar');
  const [f, setF] = useState({ ch: '', pillar: '', campaign: '', product: '', owner: '' });
  const [open, setOpen] = useState<Card | null>(null);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  // คอมเปิดมาเป็นเดือนเต็ม · จำมุมมองล่าสุดไว้ในเครื่อง
  useEffect(() => {
    let saved: string | null = null;
    try { saved = localStorage.getItem('content.calView'); } catch { /* โหมดส่วนตัว */ }
    const wide = window.matchMedia('(min-width: 1024px)').matches;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setView((VIEWS.some(([v]) => v === saved) ? saved : wide ? 'month' : 'agenda') as View);
    setDrag(window.matchMedia('(pointer: fine)').matches);
  }, []);
  function pickView(v: View) {
    setView(v);
    try { localStorage.setItem('content.calView', v); } catch { /* ไม่เป็นไร */ }
  }

  const pillarOf = useMemo(() => new Map(pillars.map((p) => [p.id, p])), [pillars]);
  const colorOf = (it: CalItem) =>
    colorBy === 'pillar'
      ? (it.pillar_id && pillarOf.get(it.pillar_id)?.color) || 'var(--border)'
      : it.campaign_id ? hashColor(it.campaign_id) : 'var(--border)';

  // การ์ด = ชิ้นงาน × วัน หลังผ่านตัวกรอง
  const cards = useMemo(() => {
    const byItem = new Map(items.map((i) => [i.id, i]));
    const map = new Map<string, Card>();
    for (const p of placements) {
      const it = byItem.get(p.item_id);
      if (!it) continue;
      if (f.ch && p.channel_id !== f.ch) continue;
      if (f.pillar && it.pillar_id !== f.pillar) continue;
      if (f.campaign && it.campaign_id !== f.campaign) continue;
      if (f.product && !it.products.includes(f.product)) continue;
      if (f.owner && it.owner_id !== f.owner) continue;
      const k = `${it.id}|${p.planned_on}`;
      const c = map.get(k) ?? { item: it, date: p.planned_on, placements: [] };
      c.placements.push(p);
      map.set(k, c);
    }
    const order = PHASE1_CHANNELS.map((c) => c.id) as string[];
    for (const c of map.values()) c.placements.sort((a, b) => order.indexOf(a.channel_id) - order.indexOf(b.channel_id));
    return [...map.values()];
  }, [items, placements, f]);
  const on = (d: string) => cards.filter((c) => c.date === d);

  function move(card: Card, date: string) {
    if (!date || date === card.date) return;
    const ids = card.placements.filter((p) => !p.published_at).map((p) => p.id);
    setError(null);
    start(async () => {
      const r = await movePlacements(ids, date, card.item.id);
      if (!r.ok) setError(r.error);
      else { setOpen(null); router.refresh(); }
    });
  }

  function step(n: number) {
    if (view === 'month' || view === 'agenda') setCursor(addMonths(cursor, n));
    else setCursor(addDays(cursor, n * (view === 'day' ? 1 : view === '3day' ? 3 : 7)));
  }

  // ── การ์ด ──
  const tags = (c: Card) => (
    <>
      {c.placements.map((p) => (
        <span key={p.id} className={'rounded-md border px-1 text-[10.5px] font-bold ' + (p.published_at ? 'border-ok/50 text-ok' : 'border-border')}>
          {channelShort(p.channel_id)}{p.published_at ? '✓' : ''}
        </span>
      ))}
    </>
  );
  const thumb = (it: CalItem, className: string) =>
    it.visual && isDirectImage(it.visual)
      // eslint-disable-next-line @next/next/no-img-element
      ? <img src={it.visual} alt="" className={className + ' object-cover'} />
      : it.visual ? <span className={className + ' grid place-items-center bg-bg text-[10px] text-muted'}>ภาพ</span> : null;

  function cardBox(c: Card, compact?: boolean) {
    return (
      <div key={c.item.id + c.date} role="button" tabIndex={0} draggable={drag}
        onDragStart={(e) => e.dataTransfer.setData('text/plain', `${c.item.id}|${c.date}`)}
        onClick={() => setOpen(c)} onKeyDown={(e) => { if (e.key === 'Enter') setOpen(c); }}
        className={'relative cursor-pointer overflow-hidden rounded-xl border border-border border-l-4 bg-surface text-left ' +
          (compact ? 'p-1.5' : 'flex gap-2.5 p-2')}
        style={{ borderLeftColor: colorOf(c.item) }}>
        <span className="absolute right-1.5 top-1.5 h-1.5 w-4 rounded-full" style={{ background: STAGE_COLOR[c.item.stage] ?? 'var(--muted)' }}
          title={c.item.stage} />
        {thumb(c.item, compact ? 'mb-1 aspect-[4/3] w-full rounded-lg' : 'h-14 w-14 shrink-0 rounded-lg')}
        <div className="min-w-0 flex-1">
          <div className={(compact ? 'text-xs' : 'text-sm') + ' pr-5 font-medium leading-snug'}>{c.item.hook || c.item.title}</div>
          <div className="mt-1 flex flex-wrap items-center gap-1 text-xs">
            {tags(c)}
            {c.item.off_plan && <span className="rounded-md bg-warn/10 px-1 text-[10.5px] font-medium text-warn">นอกแผน</span>}
          </div>
        </div>
      </div>
    );
  }

  function dropProps(date: string) {
    if (!drag) return {};
    return {
      onDragOver: (e: React.DragEvent) => e.preventDefault(),
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        const [id, from] = e.dataTransfer.getData('text/plain').split('|');
        const c = cards.find((x) => x.item.id === id && x.date === from);
        if (c) move(c, date);
      },
    };
  }

  // ── เนื้อหาตามมุมมอง ──
  const cur = toD(cursor);
  let title = `${MON[cur.getMonth()]} ${cur.getFullYear() + 543}`;
  let body: React.ReactNode;

  if (view === 'month') {
    const first = new Date(cur.getFullYear(), cur.getMonth(), 1);
    const start0 = addDays(toS(first), -first.getDay());
    const days: string[] = [];
    for (let i = 0; i < 42; i++) {
      const d = addDays(start0, i);
      if (i >= 35 && toD(d).getMonth() !== cur.getMonth()) break;
      days.push(d);
    }
    body = (
      <div className="grid grid-cols-7 overflow-hidden rounded-xl border-l border-t border-border bg-surface">
        {WD.map((w) => <div key={w} className="border-b border-r border-border bg-bg py-1.5 text-center text-xs text-muted">{w}</div>)}
        {days.map((d) => {
          const out = toD(d).getMonth() !== cur.getMonth();
          return (
            <div key={d} {...dropProps(d)}
              className={'min-h-24 min-w-0 space-y-1 border-b border-r border-border p-1 ' + (out ? 'bg-bg/60' : '')}>
              <div className={'text-xs ' + (d === today ? 'font-bold text-accent' : out ? 'text-muted/60' : 'text-muted')}>{toD(d).getDate()}</div>
              {on(d).map((c) => (
                <div key={c.item.id + c.date}>
                  {/* มือถือ: แถบสั้น · คอม: การ์ดเต็ม */}
                  <div role="button" tabIndex={0} onClick={() => setOpen(c)} onKeyDown={(e) => { if (e.key === 'Enter') setOpen(c); }}
                    className="truncate rounded border-l-[3px] bg-bg px-1 text-[10.5px] leading-5 lg:hidden"
                    style={{ borderLeftColor: colorOf(c.item) }}>
                    {c.item.hook || c.item.title}
                  </div>
                  <div className="hidden lg:block">{cardBox(c, true)}</div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    );
  } else if (view === 'agenda') {
    const month = cursor.slice(0, 7);
    const dates = [...new Set(cards.map((c) => c.date))].filter((d) => d.slice(0, 7) === month).sort();
    body = dates.length === 0
      ? <p className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted">เดือนนี้ยังไม่มีชิ้นงานตามตัวกรองที่เลือก</p>
      : (
        <div className="space-y-4">
          {dates.map((d) => (
            <div key={d} className="grid grid-cols-[48px_1fr] gap-3">
              <div className="pt-1 text-center">
                <b className={'block text-xl leading-none ' + (d === today ? 'text-accent' : '')}>{toD(d).getDate()}</b>
                <span className="text-xs text-muted">{WD[toD(d).getDay()]}</span>
              </div>
              <div className="space-y-2">{on(d).map((c) => cardBox(c))}</div>
            </div>
          ))}
        </div>
      );
  } else {
    const n = view === 'day' ? 1 : view === '3day' ? 3 : 7;
    const start0 = view === 'week' ? addDays(cursor, -cur.getDay()) : cursor;
    const cols = Array.from({ length: n }, (_, i) => addDays(start0, i));
    title = n === 1 ? `${WD[cur.getDay()]} ${short(cursor)} ${cur.getFullYear() + 543}` : `${short(cols[0])} – ${short(cols[n - 1])}`;
    body = (
      <div className="overflow-x-auto">
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${n}, minmax(${n > 3 ? 110 : 0}px, 1fr))` }}>
          {cols.map((d) => (
            <div key={d} {...dropProps(d)} className="min-h-32 min-w-0">
              <div className="mb-2 border-b border-border px-0.5 pb-1.5 text-xs text-muted">
                <b className={'mr-1 text-base ' + (d === today ? 'text-accent' : 'text-text')}>{toD(d).getDate()}</b>{WD[toD(d).getDay()]}
              </div>
              <div className="space-y-1.5">
                {on(d).map((c) => cardBox(c, n > 3))}
                {on(d).length === 0 && <span className="text-xs text-muted">—</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── ตัวกรอง (Q-24) ──
  const sel = (key: keyof typeof f, label: string, opts: [string, string][]) => (
    <select value={f[key]} onChange={(e) => setF({ ...f, [key]: e.target.value })} aria-label={label}
      className={'shrink-0 rounded-full border bg-surface px-3 py-1.5 text-sm ' + (f[key] ? 'border-accent font-medium text-accent' : 'border-border')}>
      <option value="">{label}: ทั้งหมด</option>
      {opts.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
    </select>
  );
  const usedProducts = new Set(items.flatMap((i) => i.products));
  const activeFilters = Object.values(f).filter(Boolean).length;
  const legend = colorBy === 'pillar'
    ? pillars.filter((p) => p.active).map((p) => ({ id: p.id, name: p.name, c: p.color }))
    : campaigns.filter((c) => items.some((i) => i.campaign_id === c.id)).map((c) => ({ id: c.id, name: c.name, c: hashColor(c.id) }));

  const openItem = open && items.find((i) => i.id === open.item.id);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5">
        <button onClick={() => step(-1)} aria-label="ก่อนหน้า" className="grid h-9 w-9 place-items-center rounded-xl border border-border bg-surface">‹</button>
        <button onClick={() => step(1)} aria-label="ถัดไป" className="grid h-9 w-9 place-items-center rounded-xl border border-border bg-surface">›</button>
        <h2 className="flex-1 truncate text-lg font-semibold">{title}</h2>
        <button onClick={() => setCursor(today)} className="rounded-xl border border-border px-3 py-1.5 text-sm">วันนี้</button>
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-surface p-1" role="group" aria-label="มุมมอง">
        {VIEWS.map(([v, t]) => (
          <button key={v} onClick={() => pickView(v)} aria-pressed={view === v}
            className={'flex-1 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm ' + (view === v ? 'bg-accent font-medium text-accent-fg' : 'text-muted')}>
            {t}
          </button>
        ))}
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-0.5">
        {sel('ch', 'ช่องทาง', PHASE1_CHANNELS.map((c) => [c.id, c.name]))}
        {sel('pillar', 'Pillar', pillars.filter((p) => p.active).map((p) => [p.id, p.name]))}
        {sel('campaign', 'แคมเปญ', campaigns.map((c) => [c.id, c.name]))}
        {sel('product', 'สินค้า', models.filter((m) => usedProducts.has(m.id)).map((m) => [m.id, `${m.collection}${m.name_th ? ` ${m.name_th}` : ''}`]))}
        {sel('owner', 'คนทำ', team.map((p) => [p.id, p.full_name]))}
        {activeFilters > 0 && (
          <button onClick={() => setF({ ch: '', pillar: '', campaign: '', product: '', owner: '' })}
            className="shrink-0 rounded-full px-3 py-1.5 text-sm text-muted underline">ล้าง {activeFilters}</button>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
          {legend.map((l) => <span key={l.id}><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm align-[-1px]" style={{ background: l.c }} />{l.name}</span>)}
          <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm align-[-1px]" style={{ background: 'var(--border)' }} />{colorBy === 'pillar' ? 'ไม่ผูก pillar' : 'ไม่ผูกแคมเปญ'}</span>
        </div>
        <div className="flex rounded-xl border border-border bg-surface p-0.5 text-xs" role="group" aria-label="ระบายสีตาม">
          {(['pillar', 'campaign'] as const).map((v) => (
            <button key={v} onClick={() => setColorBy(v)} aria-pressed={colorBy === v}
              className={'rounded-lg px-2.5 py-1 ' + (colorBy === v ? 'bg-accent text-accent-fg' : 'text-muted')}>
              สีตาม{v === 'pillar' ? ' pillar' : 'แคมเปญ'}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="rounded-xl border border-danger/40 bg-danger/5 p-3 text-sm">{error}</p>}
      <div className={pending ? 'opacity-60' : ''}>{body}</div>
      {drag && <p className="text-xs text-muted">ลากการ์ดไปวันอื่นเพื่อย้ายวันลง · กดการ์ดเพื่อดูรายละเอียด</p>}

      {/* ── แตะการ์ด: ดู · เปิดงาน · ย้ายวัน ── */}
      {open && openItem && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 sm:items-center" onClick={() => setOpen(null)}>
          <div className="w-full max-w-md space-y-3 rounded-t-2xl bg-surface p-4 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex gap-3">
              {thumb(openItem, 'h-16 w-16 shrink-0 rounded-lg')}
              <div className="min-w-0">
                <p className="text-xs text-muted">{short(open.date)} · {openItem.stage}</p>
                <p className="font-medium">{openItem.hook || openItem.title}</p>
                <div className="mt-1 flex flex-wrap gap-1 text-xs">{tags(open)}</div>
              </div>
            </div>
            <label className="block text-sm">
              ย้ายไปวัน
              <input type="date" defaultValue={open.date} disabled={pending}
                onChange={(e) => move(open, e.target.value)}
                className="mt-1 w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-base" />
            </label>
            {open.placements.some((p) => p.published_at) && <p className="text-xs text-muted">ช่องทางที่ลงแล้วไม่ย้าย</p>}
            <div className="flex gap-2">
              <button onClick={() => setOpen(null)} className="rounded-xl border border-border px-4 py-2.5 text-sm">ปิด</button>
              <Link href={`/content/${openItem.id}`} className="flex-1 rounded-xl bg-accent px-4 py-2.5 text-center text-sm font-medium text-accent-fg">เปิดงาน</Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
