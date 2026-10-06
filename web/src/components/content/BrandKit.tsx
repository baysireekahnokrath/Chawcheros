'use client';

/**
 * แบรนด์ (R6) · Brand Kit (Q-70) · ตัวอย่างใช่/ไม่ใช่ (Q-71) · สีแคมเปญ (K6) · เส้นทาง agent (Q-08) · คลังงาน (Q-72)
 */
import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { saveBrandKit, addExample, removeExample, setCampaignColor, setRoute } from '@/modules/content/plan-actions';
import {
  PHASE1_FORMATS, PHASE1_CHANNELS, channelName,
  type BrandKit as Kit, type BrandExample, type AgentRoute, type Pillar, type Theme, type Model,
} from '@/modules/content/types';

type R = { ok: true } | { ok: false; error: string };
type ArchiveItem = {
  id: string; title: string; hook: string | null; stage: string; pillar_id: string | null;
  theme_id: string | null; campaign_id: string | null; updated_at: string; products: string[];
};
const panel = 'rounded-2xl border border-border bg-surface p-4';
const input = 'mt-1 w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-sm outline-none focus:border-accent';
const btn = 'rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-accent-fg disabled:opacity-50';
const btn2 = 'rounded-xl border border-border px-3 py-1.5 text-sm disabled:opacity-50';

function useRun() {
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOk] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const run = (fn: () => Promise<R>, msg?: string, after?: () => void) => {
    setError(null); setOk(null);
    start(async () => {
      const r = await fn();
      if (!r.ok) setError(r.error); else { if (msg) setOk(msg); after?.(); router.refresh(); }
    });
  };
  return { error, okMsg, pending, run };
}

function Copy({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" className="rounded-md border border-border px-1.5 text-xs"
      onClick={async () => { try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1200); } catch { /* เลือกเอง */ } }}>
      {done ? 'คัดลอกแล้ว' : 'คัดลอก'}
    </button>
  );
}

export function KitTab({ brandId, kit, voice, examples, picks, campaigns, admin }: {
  brandId: string; kit: Kit | null; voice: string | null; examples: BrandExample[];
  picks: ArchiveItem[]; campaigns: { id: string; name: string; color: string | null }[]; admin: boolean;
}) {
  const { error, okMsg, pending, run } = useRun();
  const [colors, setColors] = useState(kit?.colors?.length ? kit.colors : [{ name: '', hex: '#6b5b4a' }]);
  const [kind, setKind] = useState<'ใช่' | 'ไม่ใช่'>('ใช่');
  const itemName = (id: string | null) => picks.find((p) => p.id === id);
  const pickList = picks.filter((p) => (kind === 'ใช่' ? p.stage !== 'ตีกลับแก้' : p.stage === 'ตีกลับแก้'));

  return (
    <div className="space-y-4">
      {/* ── Brand Kit ── */}
      <section className={panel}>
        <h2 className="text-sm font-medium">Brand Kit</h2>
        {!admin ? (
          <div className="mt-2 space-y-2 text-sm">
            {kit?.logo_url && <p>โลโก้: <a href={kit.logo_url} target="_blank" rel="noreferrer" className="underline">เปิด ↗</a></p>}
            {kit?.fonts && <p>ฟอนต์: {kit.fonts}</p>}
            <div className="flex flex-wrap gap-2">
              {(kit?.colors ?? []).map((c) => (
                <span key={c.hex} className="flex items-center gap-1.5 rounded-lg border border-border px-2 py-1">
                  <i className="inline-block h-4 w-4 rounded" style={{ background: c.hex }} />{c.name} <code className="text-xs">{c.hex}</code><Copy text={c.hex} />
                </span>
              ))}
            </div>
            {!kit && <p className="text-muted">Bay ยังไม่ได้ตั้ง Brand Kit</p>}
          </div>
        ) : (
          <form className="mt-3 space-y-3" onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            fd.set('brand_id', brandId);
            run(() => saveBrandKit(fd), 'บันทึกแล้ว');
          }}>
            <label className="block text-sm">ลิงก์โลโก้ (Drive/Figma)<input name="logo_url" defaultValue={kit?.logo_url ?? ''} className={input} /></label>
            <label className="block text-sm">ฟอนต์<input name="fonts" defaultValue={kit?.fonts ?? ''} placeholder="เช่น หัวข้อ: Noto Serif Thai · เนื้อหา: Noto Sans Thai" className={input} /></label>
            <div className="text-sm">
              สี
              <ul className="mt-1 space-y-1.5">
                {colors.map((c, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(c.hex) ? c.hex : '#000000'} aria-label="เลือกสี"
                      onChange={(e) => setColors(colors.map((x, j) => (j === i ? { ...x, hex: e.target.value } : x)))} className="h-9 w-10 rounded" />
                    <input name="color_hex" value={c.hex} onChange={(e) => setColors(colors.map((x, j) => (j === i ? { ...x, hex: e.target.value } : x)))}
                      aria-label="รหัสสี" className="w-24 rounded-lg border border-border bg-bg px-2 py-1.5 font-mono text-sm" />
                    <input name="color_name" value={c.name} placeholder="ชื่อสี" onChange={(e) => setColors(colors.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                      aria-label="ชื่อสี" className="min-w-0 flex-1 rounded-lg border border-border bg-bg px-2 py-1.5 text-sm" />
                    <Copy text={c.hex} />
                    <button type="button" className="text-xs text-muted" onClick={() => setColors(colors.filter((_, j) => j !== i))}>ลบ</button>
                  </li>
                ))}
              </ul>
              <button type="button" className={btn2 + ' mt-2'} onClick={() => setColors([...colors, { name: '', hex: '#000000' }])}>+ สี</button>
            </div>
            <button className={btn} disabled={pending}>บันทึก Brand Kit</button>
          </form>
        )}
        <div className="mt-3 rounded-xl bg-bg p-3 text-sm">
          <p className="text-xs text-muted">น้ำเสียงแบรนด์ (จาก Brand model)</p>
          <p className="mt-0.5">{voice || <Link href="/content/brain?tab=model" className="underline">ยังไม่ได้ตั้ง · สัมภาษณ์หัวข้อน้ำเสียง</Link>}</p>
        </div>
      </section>

      {/* ── ตัวอย่างใช่/ไม่ใช่ ── */}
      <section className={panel}>
        <h2 className="text-sm font-medium">ตัวอย่างที่ใช่ / ไม่ใช่</h2>
        <p className="text-xs text-muted">agent อ่านทุกครั้งที่เขียน · หยิบจากงานที่ผ่านหรือโดนตีกลับ หรือแปะลิงก์</p>
        <form className="mt-3 grid gap-2 sm:grid-cols-2" onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          fd.set('brand_id', brandId); fd.set('kind', kind);
          const f = e.currentTarget;
          run(() => addExample(fd), undefined, () => f.reset());
        }}>
          <div className="flex gap-1 sm:col-span-2" role="group" aria-label="ชนิดตัวอย่าง">
            {(['ใช่', 'ไม่ใช่'] as const).map((k) => (
              <button key={k} type="button" onClick={() => setKind(k)} aria-pressed={kind === k}
                className={'flex-1 rounded-lg border px-3 py-1.5 text-sm ' + (kind === k ? (k === 'ใช่' ? 'border-ok bg-ok/10 text-ok' : 'border-danger bg-danger/10 text-danger') : 'border-border')}>
                {k}
              </button>
            ))}
          </div>
          <label className="text-sm">งานในระบบ
            <select name="item_id" className={input}>
              <option value="">— ไม่เลือก —</option>
              {pickList.slice(0, 60).map((p) => <option key={p.id} value={p.id}>{p.hook || p.title}</option>)}
            </select>
          </label>
          <label className="text-sm">หรือลิงก์<input name="url" placeholder="https://…" className={input} /></label>
          <label className="text-sm sm:col-span-2">ทำไมถึง{kind}<input name="note" required className={input} /></label>
          <button className={btn + ' sm:col-span-2'} disabled={pending}>เพิ่มตัวอย่าง{kind}</button>
        </form>
        <ul className="mt-3 divide-y divide-border">
          {examples.map((x) => (
            <li key={x.id} className="flex items-start justify-between gap-2 py-2 text-sm">
              <div className="min-w-0">
                <span className={'mr-1 rounded-md px-1.5 text-xs font-medium ' + (x.kind === 'ใช่' ? 'bg-ok/10 text-ok' : 'bg-danger/10 text-danger')}>{x.kind}</span>
                {x.item_id ? <Link href={`/content/${x.item_id}`} className="underline">{itemName(x.item_id)?.hook || itemName(x.item_id)?.title || 'งานในระบบ'}</Link>
                  : <a href={x.url ?? '#'} target="_blank" rel="noreferrer" className="underline">ลิงก์ ↗</a>}
                <p className="text-xs text-muted">{x.note}</p>
              </div>
              <button className={btn2} disabled={pending} onClick={() => run(() => removeExample(x.id))}>เอาออก</button>
            </li>
          ))}
        </ul>
      </section>

      {/* ── สีแคมเปญ ── */}
      <section className={panel}>
        <h2 className="text-sm font-medium">สีแคมเปญ</h2>
        <p className="text-xs text-muted">ใช้ในปฏิทินเมื่อเลือก “สีตามแคมเปญ”</p>
        {campaigns.length === 0 ? <p className="mt-2 text-sm text-muted">ยังไม่มีแคมเปญ</p> : (
          <ul className="mt-2 space-y-1.5">
            {campaigns.map((c) => (
              <li key={c.id} className="flex items-center gap-2 text-sm">
                <input type="color" defaultValue={c.color ?? '#999999'} aria-label={`สี ${c.name}`} disabled={pending}
                  onBlur={(e) => { if (e.target.value !== c.color) run(() => setCampaignColor(c.id, e.target.value)); }} className="h-8 w-10 rounded" />
                <span>{c.name}</span>
                {!c.color && <span className="text-xs text-muted">(ยังไม่ตั้ง)</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
      {error && <p className="text-sm text-danger">{error}</p>}
      {okMsg && <p className="text-sm text-ok">{okMsg}</p>}
    </div>
  );
}

export function RoutesTab({ routes, admin }: { routes: AgentRoute[]; admin: boolean }) {
  const { error, pending, run } = useRun();
  const agentOf = (f: string, c: string) => routes.find((r) => r.format === f && r.channel_id === c)?.agent;
  return (
    <section className={panel}>
      <h2 className="text-sm font-medium">เส้นทาง agent</h2>
      <p className="text-xs text-muted">งานประเภทไหน ช่องทางไหน ให้ใครเขียน · เฟส 1 มี Content agent ตัวเดียว · “คนทำเอง” = agent ข้ามช่องนั้น</p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr><th className="py-1 text-left font-medium text-muted">ประเภท</th>{PHASE1_CHANNELS.map((c) => <th key={c.id} className="py-1 text-left font-medium text-muted">{c.name}</th>)}</tr></thead>
          <tbody>
            {PHASE1_FORMATS.map((f) => (
              <tr key={f} className="border-t border-border">
                <td className="py-2 pr-2">{f}</td>
                {PHASE1_CHANNELS.map((c) => {
                  const a = agentOf(f, c.id);
                  return (
                    <td key={c.id} className="py-2 pr-2">
                      {!a ? <span className="text-xs text-muted">ลงไม่ได้</span> : admin ? (
                        <select value={a} disabled={pending} aria-label={`${f} ${channelName(c.id)}`}
                          onChange={(e) => run(() => setRoute(f, c.id, e.target.value))} className="rounded-lg border border-border bg-bg px-2 py-1 text-sm">
                          <option>Content agent</option><option>คนทำเอง</option>
                        </select>
                      ) : <span>{a}</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </section>
  );
}

export function ArchiveTab({ items, pillars, themes, campaigns, models }: {
  items: ArchiveItem[]; pillars: Pillar[]; themes: Theme[]; campaigns: { id: string; name: string }[]; models: Model[];
}) {
  const [f, setF] = useState({ product: '', pillar: '', theme: '', campaign: '' });
  const [q, setQ] = useState('');
  const list = useMemo(() => items.filter((i) => i.stage === 'โพสต์แล้ว'
    && (!f.product || i.products.includes(f.product)) && (!f.pillar || i.pillar_id === f.pillar)
    && (!f.theme || i.theme_id === f.theme) && (!f.campaign || i.campaign_id === f.campaign)
    && (!q || (i.hook ?? i.title).toLowerCase().includes(q.toLowerCase()))), [items, f, q]);
  const used = new Set(items.flatMap((i) => i.products));
  const sel = (key: keyof typeof f, label: string, opts: [string, string][]) => (
    <select value={f[key]} onChange={(e) => setF({ ...f, [key]: e.target.value })} aria-label={label}
      className={'shrink-0 rounded-full border bg-surface px-3 py-1.5 text-sm ' + (f[key] ? 'border-accent text-accent' : 'border-border')}>
      <option value="">{label}: ทั้งหมด</option>
      {opts.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
    </select>
  );
  return (
    <section className={panel}>
      <h2 className="text-sm font-medium">คลังงานที่โพสต์แล้ว · {list.length}</h2>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นจาก hook" aria-label="ค้นหา" className={input} />
      <div className="mt-2 flex gap-1.5 overflow-x-auto pb-0.5">
        {sel('product', 'สินค้า', models.filter((m) => used.has(m.id)).map((m) => [m.id, `${m.collection}${m.name_th ? ` ${m.name_th}` : ''}`]))}
        {sel('pillar', 'Pillar', pillars.map((p) => [p.id, p.name]))}
        {sel('theme', 'ธีม', themes.map((t) => [t.id, t.name]))}
        {sel('campaign', 'แคมเปญ', campaigns.map((c) => [c.id, c.name]))}
      </div>
      {list.length === 0 ? <p className="mt-3 text-sm text-muted">ยังไม่มีงานที่โพสต์แล้วตามตัวกรองนี้</p> : (
        <ul className="mt-3 divide-y divide-border">
          {list.map((i) => (
            <li key={i.id} className="py-2">
              <Link href={`/content/${i.id}`} className="block text-sm">
                <span className="font-medium">{i.hook || i.title}</span>
                <span className="block text-xs text-muted">{new Date(i.updated_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
