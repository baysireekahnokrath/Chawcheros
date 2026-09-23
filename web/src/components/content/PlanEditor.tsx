'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  createPlan, addSlot, removeSlot, submitPlan, approvePlan, bouncePlan, markChangesSeen, addTheme, setThemeWeek, aiDraftPlan,
} from '@/modules/content/plan-actions';
import { aiWrite } from '@/modules/content/agent-actions';
import {
  PHASE1_FORMATS, PHASE1_CHANNELS, TONE, channelShort, planDeadline,
  type Plan, type PlanSlot, type PlanChange, type Pillar, type Theme, type ThemeWeek, type Model, type Person,
} from '@/modules/content/types';

type R = { ok: true } | { ok: false; error: string };
const panel = 'rounded-2xl border border-border bg-surface p-4';
const input = 'mt-1 w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-sm outline-none focus:border-accent';
const btn = 'rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-accent-fg disabled:opacity-50';
const btn2 = 'rounded-xl border border-border px-3 py-2 text-sm disabled:opacity-50';

const WD = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
const MON_S = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const toD = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const toS = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const label = (s: string) => { const d = toD(s); return `${WD[d.getDay()]} ${d.getDate()} ${MON_S[d.getMonth()]}`; };
const STATUS_TONE: Record<string, string> = {
  ร่าง: 'bg-border text-muted', รออนุมัติ: 'bg-locked/10 text-locked', ตีกลับ: 'bg-danger/10 text-danger', อนุมัติแล้ว: 'bg-ok/10 text-ok',
};

function useRun() {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const run = (fn: () => Promise<R>, after?: () => void) => {
    setError(null);
    start(async () => {
      const r = await fn();
      if (!r.ok) setError(r.error); else { after?.(); router.refresh(); }
    });
  };
  return { error, pending, run };
}

/**
 * แผนเดือน (R6 · Q-12 Q-14–18)
 * ร่าง → ส่งให้ Bay → อนุมัติ = การ์ดไอเดียในปฏิทิน · ตีกลับ = แก้แล้วส่งใหม่
 * หลังอนุมัติ เพิ่ม/ตัดชิ้นได้ ระบบบันทึกแจ้ง Bay
 */
export default function PlanEditor(p: {
  brandId: string; month: string; today: string; plan: Plan | null; slots: PlanSlot[]; changes: PlanChange[];
  pillars: Pillar[]; themes: Theme[]; weeks: ThemeWeek[]; campaigns: { id: string; name: string }[];
  models: Model[]; team: Person[]; canApprove: boolean; canWrite: boolean;
}) {
  const { error, pending, run } = useRun();
  const [adding, setAdding] = useState(false);
  const [format, setFormat] = useState<string>('ภาพเดี่ยว');
  const [note, setNote] = useState('');
  const [count, setCount] = useState(8);
  const [direction, setDirection] = useState('');
  const [aiMsg, setAiMsg] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const router = useRouter();
  const { plan } = p;

  // agent ร่างทั้งเดือน (Bay ขอ 2026-09-23)
  function draft() {
    if (!plan) return;
    setAiMsg(null);
    run(async () => {
      const r = await aiDraftPlan(plan.id, count, direction);
      if (r.ok) setAiMsg(r.message);
      return r.ok ? { ok: true } : r;
    });
  }
  // หลังอนุมัติ · agent เขียนทีละชิ้นจนครบ (แต่ละชิ้น 30-90 วินาที)
  const toWrite = p.slots.filter((s) => s.item_id && ['ไอเดีย', 'กำลังทำ'].includes(s.item_stage ?? ''));
  async function writeAll() {
    const fails: string[] = [];
    for (let i = 0; i < toWrite.length; i++) {
      setProgress(`agent กำลังเขียนชิ้นที่ ${i + 1} จาก ${toWrite.length} · ${toWrite[i].hook ?? ''}`);
      const r = await aiWrite(toWrite[i].item_id!);
      if (!r.ok) fails.push(`${label(toWrite[i].planned_on)}: ${r.error}`);
    }
    setProgress(fails.length ? `เขียนเสร็จ ${toWrite.length - fails.length}/${toWrite.length} · ไม่สำเร็จ: ${fails.join(' · ')}` : `เขียนครบ ${toWrite.length} ชิ้น · ชิ้นที่ภาพพร้อม/ข้อความล้วนส่งตรวจแล้ว`);
    router.refresh();
  }
  const deadline = planDeadline(p.month);
  const daysLeft = Math.round((toD(deadline).getTime() - toD(p.today).getTime()) / 864e5);
  const editable = p.canWrite && plan && plan.status !== 'รออนุมัติ';
  const approved = plan?.status === 'อนุมัติแล้ว';
  const unseen = p.changes.filter((c) => !c.seen_at);
  const themeName = (id: string | null) => p.themes.find((t) => t.id === id)?.name;
  const pillar = (id: string | null) => p.pillars.find((x) => x.id === id);
  const monthEnd = toS(new Date(toD(p.month).getFullYear(), toD(p.month).getMonth() + 1, 0));

  // ── ธีม 3 เดือน เป็นแถบยาว (Q-18) ──
  const winStart = p.month;
  const winEnd = toS(new Date(toD(p.month).getFullYear(), toD(p.month).getMonth() + 3, 0));
  const span = (toD(winEnd).getTime() - toD(winStart).getTime()) / 864e5 + 1;
  const pos = (s: string) => Math.max(0, Math.min(span, (toD(s).getTime() - toD(winStart).getTime()) / 864e5));
  const visible = p.themes.filter((t) => t.ends_on >= winStart && t.starts_on <= winEnd);
  const mondays: string[] = [];
  for (let d = toD(p.month); d <= toD(monthEnd); d.setDate(d.getDate() + 1)) if (d.getDay() === 1) mondays.push(toS(d));

  return (
    <div className="space-y-4">
      {/* ── สถานะแผน ── */}
      <section className={panel}>
        {!plan ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm">
              <p className="font-medium">ยังไม่มีแผนเดือนนี้</p>
              <p className="text-xs text-muted">ส่งให้ Bay ภายใน {label(deadline)}{daysLeft >= 0 ? ` · อีก ${daysLeft} วัน` : ''}</p>
            </div>
            {p.canWrite && <button className={btn} disabled={pending} onClick={() => run(() => createPlan(p.brandId, p.month))}>เริ่มร่างแผน</button>}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className={`rounded-lg px-2.5 py-1 text-sm ${STATUS_TONE[plan.status]}`}>{plan.status}</span>
                <span className="text-sm">{p.slots.length} ชิ้น</span>
              </div>
              <span className="text-xs text-muted">ส่งภายใน {label(deadline)}{!plan.submitted_at && daysLeft >= 0 ? ` · อีก ${daysLeft} วัน` : ''}</span>
            </div>
            {plan.review_note && (
              <p className={'rounded-xl p-3 text-sm ' + (plan.status === 'ตีกลับ' ? 'bg-danger/5 text-danger' : 'bg-ok/5')}>
                {plan.status === 'ตีกลับ' ? 'Bay ตีกลับ: ' : 'Bay: '}{plan.review_note}
              </p>
            )}
            {p.canWrite && ['ร่าง', 'ตีกลับ'].includes(plan.status) && (
              <div className="space-y-2 rounded-xl border border-accent/30 bg-accent/5 p-3">
                <p className="text-sm font-medium">ให้ agent ร่างแผนทั้งเดือน</p>
                <p className="text-xs text-muted">คิดจาก brand model · pillar · ธีมและหัวข้อสัปดาห์ · สินค้าที่ไม่ได้พูดถึงนาน · แฟ้มคู่แข่ง · ร่างมาแล้วแก้/ตัด/เพิ่มได้ก่อนส่ง</p>
                <div className="flex gap-2">
                  <label className="text-sm">จำนวน
                    <input type="number" min={1} max={20} value={count} onChange={(e) => setCount(Number(e.target.value))}
                      className="mt-1 w-20 rounded-xl border border-border bg-bg px-3 py-2.5 text-sm" />
                  </label>
                  <label className="flex-1 text-sm">ทิศทาง (ไม่บังคับ)
                    <input value={direction} onChange={(e) => setDirection(e.target.value)} placeholder="เช่น เน้นโซฟาห้องเล็ก ช่วงปลายปี" className={input} />
                  </label>
                </div>
                <button className={btn + ' w-full'} disabled={pending} onClick={draft}>
                  {pending ? 'agent กำลังร่าง… (30-60 วินาที)' : `ให้ agent ร่าง ${count} ชิ้น`}
                </button>
                {aiMsg && <p className="text-sm text-ok">{aiMsg}</p>}
              </div>
            )}
            {p.canWrite && ['ร่าง', 'ตีกลับ'].includes(plan.status) && (
              <button className={btn + ' w-full'} disabled={pending || p.slots.length === 0} onClick={() => run(() => submitPlan(plan.id))}>
                ส่งแผนให้ Bay ({p.slots.length} ชิ้น)
              </button>
            )}
            {approved && toWrite.length > 0 && (
              <div className="space-y-2 rounded-xl border border-accent/30 bg-accent/5 p-3">
                <p className="text-sm font-medium">การ์ดที่ยังไม่มีข้อความ {toWrite.length} ชิ้น</p>
                <p className="text-xs text-muted">agent เขียนทุกช่องทางทีละชิ้น · ชิ้นละ 30-90 วินาที · Opus 5 ราว 5-8 บาท/ชิ้น · เปิดหน้านี้ค้างไว้จนเสร็จ</p>
                <button className={btn + ' w-full'} disabled={!!progress && !progress.startsWith('เขียน')} onClick={writeAll}>
                  ให้ agent เขียนทุกชิ้น
                </button>
              </div>
            )}
            {progress && <p className="rounded-xl bg-bg p-3 text-sm">{progress}</p>}
            {p.canApprove && plan.status === 'รออนุมัติ' && (
              <div className="space-y-2 rounded-xl border border-locked/40 bg-locked/5 p-3">
                <p className="text-sm font-medium">รอพี่อนุมัติ · อนุมัติแล้วทุกชิ้นกลายเป็นการ์ดไอเดียในปฏิทิน</p>
                <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="หมายเหตุ (ตีกลับต้องบอกเหตุผล)" aria-label="หมายเหตุ" className={input} />
                <div className="flex gap-2">
                  <button className={btn + ' flex-1'} disabled={pending} onClick={() => run(() => approvePlan(plan.id, note), () => setNote(''))}>อนุมัติทั้งแผน</button>
                  <button className={btn2} disabled={pending || !note.trim()} onClick={() => run(() => bouncePlan(plan.id, note), () => setNote(''))}>ตีกลับ</button>
                </div>
              </div>
            )}
          </div>
        )}
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      </section>

      {/* ── เพิ่ม/ตัดหลังอนุมัติ (Q-17) ── */}
      {approved && p.changes.length > 0 && (
        <section className={panel + (unseen.length ? ' border-warn/40' : '')}>
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-sm font-medium">เปลี่ยนหลังอนุมัติ{unseen.length ? ` · ใหม่ ${unseen.length}` : ''}</h2>
            {p.canApprove && unseen.length > 0 && <button className={btn2} disabled={pending} onClick={() => run(() => markChangesSeen(plan!.id))}>รับทราบ</button>}
          </div>
          <ul className="mt-2 space-y-1 text-sm">
            {p.changes.map((c) => (
              <li key={c.id} className={c.seen_at ? 'text-muted' : ''}>
                <b className={c.kind === 'เพิ่ม' ? 'text-ok' : 'text-danger'}>{c.kind}</b> {c.summary}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── ชิ้นในแผน ── */}
      {plan && (
        <section className={panel}>
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-sm font-medium">ชิ้นในแผน</h2>
            {editable && <button className={btn2} onClick={() => setAdding(!adding)}>{adding ? 'ปิด' : '+ เพิ่มชิ้น'}</button>}
          </div>
          {approved && editable && <p className="mt-1 text-xs text-muted">แผนอนุมัติแล้ว · เพิ่มชิ้น = สร้างการ์ดทันที · ตัดชิ้น = พับการ์ด · ระบบบันทึกแจ้ง Bay</p>}

          {adding && editable && (
            <form className="mt-3 grid gap-2 rounded-xl border border-border bg-bg p-3 sm:grid-cols-2" onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              fd.set('plan_id', plan.id);
              run(() => addSlot(fd), () => setAdding(false));
            }}>
              <label className="text-sm">วันลง<input name="planned_on" type="date" required min={p.month} max={monthEnd} className={input} /></label>
              <label className="text-sm">ประเภท
                <select name="format" value={format} onChange={(e) => setFormat(e.target.value)} className={input}>
                  {PHASE1_FORMATS.map((f) => <option key={f}>{f}</option>)}
                </select>
              </label>
              <fieldset className="text-sm sm:col-span-2">
                <legend>ช่องทาง</legend>
                <div className="mt-1 flex flex-wrap gap-3">
                  {PHASE1_CHANNELS.filter((c) => !(format === 'ข้อความล้วน' && c.id === 'instagram')).map((c) => (
                    <label key={c.id} className="flex items-center gap-1.5"><input type="checkbox" name="channels" value={c.id} defaultChecked={c.id !== 'website'} className="h-4 w-4" />{c.name}</label>
                  ))}
                </div>
              </fieldset>
              <label className="text-sm sm:col-span-2">Hook<input name="hook" className={input} /></label>
              <label className="text-sm sm:col-span-2">อยากให้คนจำอะไร<input name="key_message" className={input} /></label>
              <label className="text-sm sm:col-span-2">Visual<input name="visual" className={input} /></label>
              <label className="text-sm">Pillar
                <select name="pillar_id" className={input}><option value="">ไม่ผูก</option>{p.pillars.filter((x) => x.active).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
              </label>
              <label className="text-sm">ธีม
                <select name="theme_id" className={input}><option value="">ไม่ผูก</option>{visible.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
              </label>
              <label className="text-sm">แคมเปญ
                <select name="campaign_id" className={input}><option value="">ไม่ผูก</option>{p.campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
              </label>
              <label className="text-sm">คนทำ
                <select name="owner_id" className={input}><option value="">ยังไม่ระบุ</option>{p.team.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}</select>
              </label>
              <label className="text-sm sm:col-span-2">สินค้า (เลือกได้หลายรุ่น · กด Ctrl/⌘ ค้าง)
                <select name="product_ids" multiple size={4} className={input}>
                  {p.models.map((m) => <option key={m.id} value={m.id}>{m.collection}{m.name_th ? ` ${m.name_th}` : ''}</option>)}
                </select>
              </label>
              <button className={btn + ' sm:col-span-2'} disabled={pending}>{approved ? 'เพิ่มชิ้น + สร้างการ์ด' : 'เพิ่มเข้าแผน'}</button>
            </form>
          )}

          {p.slots.length === 0 ? <p className="mt-2 text-sm text-muted">ยังไม่มีชิ้น · กด “+ เพิ่มชิ้น”</p> : (
            <ul className="mt-3 divide-y divide-border">
              {p.slots.map((s) => (
                <li key={s.id} className="flex items-start gap-3 py-2.5">
                  <span className="w-20 shrink-0 text-xs text-muted">{label(s.planned_on)}</span>
                  <div className="min-w-0 flex-1 border-l-4 pl-2" style={{ borderLeftColor: pillar(s.pillar_id)?.color ?? 'var(--border)' }}>
                    <p className="text-sm font-medium">{s.hook || <span className="text-muted">ยังไม่มี hook</span>}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-muted">
                      {s.channels.map((c) => <span key={c} className="rounded-md border border-border px-1 text-[10.5px] font-bold">{channelShort(c)}</span>)}
                      <span>{s.format}</span>
                      {pillar(s.pillar_id) && <span>· {pillar(s.pillar_id)!.name}</span>}
                      {themeName(s.theme_id) && <span>· ธีม {themeName(s.theme_id)}</span>}
                      {s.item_id && s.item_stage && <span className={`rounded-md px-1 ${TONE[s.item_stage] ?? ''}`}>{s.item_stage}</span>}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {s.item_id && <Link href={`/content/${s.item_id}`} className={btn2}>การ์ด</Link>}
                    {editable && (
                      <button className={btn2} disabled={pending} onClick={() => {
                        const reason = approved ? (window.prompt('ตัดชิ้นนี้เพราะอะไร (แจ้ง Bay)') ?? '') : '';
                        if (approved && !reason.trim()) return;
                        run(() => removeSlot(s.id, reason));
                      }}>ตัด</button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* ── ธีม 3 เดือน + หัวข้อรายสัปดาห์ (Q-10 Q-12 Q-18) ── */}
      <ThemeBlock {...p} visible={visible} span={span} pos={pos} winStart={winStart} winEnd={winEnd} mondays={mondays} />
    </div>
  );
}

function ThemeBlock(p: {
  brandId: string; month: string; themes: Theme[]; weeks: ThemeWeek[]; canWrite: boolean;
  visible: Theme[]; span: number; pos: (s: string) => number; winStart: string; winEnd: string; mondays: string[];
}) {
  const { error, pending, run } = useRun();
  const [adding, setAdding] = useState(false);
  const [topic, setTopic] = useState<Record<string, string>>({});
  const months = [0, 1, 2].map((i) => { const d = toD(p.winStart); return new Date(d.getFullYear(), d.getMonth() + i, 1); });
  const inMonth = p.visible.filter((t) => t.starts_on <= p.mondays[p.mondays.length - 1] && t.ends_on >= p.month);

  return (
    <section className={panel}>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium">ธีม 3 เดือนข้างหน้า</h2>
        {p.canWrite && <button className={btn2} onClick={() => setAdding(!adding)}>{adding ? 'ปิด' : '+ ธีม'}</button>}
      </div>
      {adding && (
        <form className="mt-3 grid gap-2 rounded-xl border border-border bg-bg p-3 sm:grid-cols-2" onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          fd.set('brand_id', p.brandId);
          run(() => addTheme(fd), () => setAdding(false));
        }}>
          <label className="text-sm sm:col-span-2">ชื่อธีม<input name="name" required className={input} /></label>
          <label className="text-sm sm:col-span-2">เป้าหมาย<input name="goal" className={input} /></label>
          <label className="text-sm">เริ่ม<input name="starts_on" type="date" required defaultValue={p.month} className={input} /></label>
          <label className="text-sm">จบ (คร่อมเดือนได้)<input name="ends_on" type="date" required className={input} /></label>
          <button className={btn + ' sm:col-span-2'} disabled={pending}>เพิ่มธีม</button>
        </form>
      )}

      <div className="mt-3 grid grid-cols-3 text-xs text-muted">
        {months.map((m) => <span key={m.getMonth()} className="border-l border-border pl-1">{MON_S[m.getMonth()]} {m.getFullYear() + 543}</span>)}
      </div>
      {p.visible.length === 0 ? <p className="mt-2 text-sm text-muted">ยังไม่มีธีมในช่วงนี้</p> : (
        <div className="mt-1 space-y-1.5">
          {p.visible.map((t) => {
            const left = (p.pos(t.starts_on) / p.span) * 100;
            const width = Math.max(4, ((p.pos(t.ends_on) + 1 - p.pos(t.starts_on)) / p.span) * 100);
            return (
              <div key={t.id} className="relative h-7">
                <div className="absolute inset-y-0 truncate rounded-lg bg-accent/15 px-2 text-xs leading-7 text-accent" style={{ left: `${left}%`, width: `${Math.min(width, 100 - left)}%` }}
                  title={`${t.name}${t.goal ? ` · ${t.goal}` : ''}`}>
                  {t.name}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {inMonth.length > 0 && (
        <div className="mt-4 space-y-3">
          <h3 className="text-sm font-medium">หัวข้อรายสัปดาห์เดือนนี้</h3>
          {inMonth.map((t) => (
            <div key={t.id}>
              <p className="text-xs font-medium">{t.name}{t.goal ? <span className="font-normal text-muted"> · {t.goal}</span> : null}</p>
              <ul className="mt-1 space-y-1">
                {p.mondays.filter((w) => w >= t.starts_on.slice(0, 10) || true).filter((w) => {
                  const end = toS(new Date(toD(w).getFullYear(), toD(w).getMonth(), toD(w).getDate() + 6));
                  return end >= t.starts_on && w <= t.ends_on;
                }).map((w) => {
                  const k = `${t.id}|${w}`;
                  const cur = p.weeks.find((x) => x.theme_id === t.id && x.week_of === w)?.topic ?? '';
                  return (
                    <li key={k} className="flex items-center gap-2 text-sm">
                      <span className="w-24 shrink-0 text-xs text-muted">สัปดาห์ {label(w)}</span>
                      {p.canWrite ? (
                        <>
                          <input defaultValue={cur} onChange={(e) => setTopic({ ...topic, [k]: e.target.value })} placeholder="หัวข้อสัปดาห์นี้"
                            aria-label={`หัวข้อสัปดาห์ ${label(w)}`} className="min-w-0 flex-1 rounded-lg border border-border bg-bg px-2 py-1.5 text-sm" />
                          {topic[k] !== undefined && topic[k] !== cur && (
                            <button className={btn2} disabled={pending} onClick={() => run(() => setThemeWeek(t.id, w, topic[k]))}>บันทึก</button>
                          )}
                        </>
                      ) : <span>{cur || '—'}</span>}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </section>
  );
}
