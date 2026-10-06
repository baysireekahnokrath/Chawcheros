'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  seedBrand, saveSection, addSection, setSectionActive, interview, savePlaybook, addNote, updateNote, saveAiSettings,
} from '@/modules/content/agent-actions';
import {
  AI_MODELS, channelName,
  type Brand, type BrandSection, type InterviewTurn, type NotebookEntry, type Playbook, type AiBudget, type AiRequest, type Person,
} from '@/modules/content/types';

const input = 'mt-1.5 w-full rounded-xl border border-border bg-bg px-3 py-3 text-base outline-none focus:border-accent';
const panel = 'rounded-2xl border border-border bg-surface p-4';
const btn = 'rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-accent-fg disabled:opacity-50';
const btn2 = 'rounded-xl border border-border px-3 py-2 text-sm disabled:opacity-50';

type Result = { ok: true } | { ok: false; error: string };

function useRun() {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const run = (fn: () => Promise<Result>, after?: () => void) => {
    setError(null);
    start(async () => {
      const r = await fn();
      if (!r.ok) setError(r.error); else { after?.(); router.refresh(); }
    });
  };
  return { error, pending, run };
}

export default function Brain(p: {
  tab: 'model' | 'book' | 'notebook' | 'playbook' | 'ai';
  brandId: string; brands: Brand[]; sections: BrandSection[]; turns: InterviewTurn[]; notebook: NotebookEntry[];
  playbooks: Playbook[]; budget: AiBudget | null; requests: AiRequest[]; team: Person[]; admin: boolean;
}) {
  if (p.tab === 'notebook') return <Notebook notebook={p.notebook} brands={p.brands} admin={p.admin} />;
  if (p.tab === 'playbook') return <Playbooks playbooks={p.playbooks} admin={p.admin} />;
  if (p.tab === 'ai') return <AiUsage budget={p.budget} requests={p.requests} team={p.team} admin={p.admin} />;
  return <Sections kind={p.tab} brandId={p.brandId} sections={p.sections.filter((s) => s.kind === p.tab)} turns={p.turns} admin={p.admin} />;
}

// ── Brand model / Brand book + สัมภาษณ์ ────────────────────────────────────

function Sections({ kind, brandId, sections, turns, admin }: {
  kind: 'model' | 'book'; brandId: string; sections: BrandSection[]; turns: InterviewTurn[]; admin: boolean;
}) {
  const { error, pending, run } = useRun();
  const [topic, setTopic] = useState('');
  const active = sections.filter((s) => s.active);
  const done = active.filter((s) => s.confirmed_at).length;

  if (sections.length === 0) {
    return (
      <div className={panel}>
        <p className="text-sm text-muted">แบรนด์นี้ยังไม่มีหัวข้อ</p>
        {admin && <button disabled={pending} onClick={() => run(() => seedBrand(brandId))} className={btn + ' mt-3'}>สร้างหัวข้อตั้งต้น</button>}
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        ยืนยันแล้ว {done} จาก {active.length} หัวข้อ ·{' '}
        {kind === 'model' ? 'แบรนด์คือใคร' : 'แบรนด์แสดงออกยังไง'} · กด “สัมภาษณ์” ให้ agent ถามทีละข้อ แล้วเขียนร่างให้ตรวจ
      </p>
      {active.map((s) => <SectionCard key={s.id} s={s} turns={turns.filter((t) => t.section_id === s.id)} admin={admin} />)}

      {admin && (
        <div className={panel}>
          <label className="block text-sm font-medium" htmlFor="new-topic">เพิ่มหัวข้อ</label>
          <div className="flex gap-2">
            <input id="new-topic" value={topic} onChange={(e) => setTopic(e.target.value)} className={input} />
            <button disabled={pending || !topic.trim()} onClick={() => run(() => addSection(brandId, kind, topic), () => setTopic(''))}
              className={btn + ' mt-1.5'}>เพิ่ม</button>
          </div>
          {error && <p className="mt-2 text-sm text-danger">{error}</p>}
        </div>
      )}
      {sections.some((s) => !s.active) && (
        <details className="text-sm text-muted">
          <summary>หัวข้อที่เลิกใช้</summary>
          {sections.filter((s) => !s.active).map((s) => (
            <div key={s.id} className="mt-2 flex items-center justify-between gap-2">
              <span>{s.topic}</span>
              {admin && <button className={btn2} disabled={pending} onClick={() => run(() => setSectionActive(s.id, true))}>ใช้อีกครั้ง</button>}
            </div>
          ))}
        </details>
      )}
    </div>
  );
}

function SectionCard({ s, turns, admin }: { s: BrandSection; turns: InterviewTurn[]; admin: boolean }) {
  const { error, pending, run } = useRun();
  const last = turns[turns.length - 1];
  const draft = last?.role === 'AI' && last.body.startsWith('ร่าง: ') ? last.body.slice(6) : null;
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(s.body ?? '');
  const [answer, setAnswer] = useState('');
  const talking = turns.length > 0 && !draft && !(s.confirmed_at && last && new Date(last.created_at) < new Date(s.confirmed_at));
  const asking = talking && last?.role === 'AI';

  return (
    <section className={panel}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">{s.topic} {s.confirmed_at ? <span className="font-normal text-ok">✓ ยืนยันแล้ว</span> : <span className="font-normal text-muted">· ยังว่าง</span>}</h2>
          {s.guide && <p className="text-xs text-muted">{s.guide}</p>}
        </div>
        {admin && !editing && (
          <div className="flex shrink-0 gap-1.5">
            <button className={btn2} disabled={pending} onClick={() => run(() => interview(s.id, ''))}>
              {pending && !answer ? 'กำลังคิด…' : turns.length ? 'ถามต่อ' : 'สัมภาษณ์'}
            </button>
            <button className={btn2} onClick={() => { setBody(s.body ?? ''); setEditing(true); }}>เขียนเอง</button>
          </div>
        )}
      </div>

      {s.body && !editing && <p className="mt-2 whitespace-pre-wrap text-sm">{s.body}</p>}

      {asking && admin && (
        <div className="mt-3 rounded-xl border border-accent/30 bg-accent/5 p-3">
          <p className="text-sm">{last.body}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {last.choices.map((c) => (
              <button key={c} onClick={() => setAnswer(c)}
                className={'rounded-full border px-3 py-1.5 text-sm ' + (answer === c ? 'border-accent bg-accent text-accent-fg' : 'border-border bg-bg')}>{c}</button>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <input value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="พิมพ์ตอบ" aria-label="คำตอบ"
              className="min-w-0 flex-1 rounded-xl border border-border bg-bg px-3 py-2.5 text-sm outline-none focus:border-accent" />
            <button className={btn} disabled={pending || !answer.trim()} onClick={() => run(() => interview(s.id, answer), () => setAnswer(''))}>
              {pending ? 'กำลังคิด…' : 'ตอบ'}
            </button>
          </div>
        </div>
      )}

      {draft && admin && !editing && (
        <div className="mt-3 rounded-xl border border-ok/40 bg-ok/5 p-3">
          <div className="text-xs text-muted">agent ร่างจากคำตอบของ Bay</div>
          <p className="mt-1 whitespace-pre-wrap text-sm">{draft}</p>
          <div className="mt-2 flex gap-2">
            <button className={btn} disabled={pending} onClick={() => run(() => saveSection(s.id, draft))}>ใช้ร่างนี้</button>
            <button className={btn2} onClick={() => { setBody(draft); setEditing(true); }}>แก้ก่อนใช้</button>
          </div>
        </div>
      )}

      {editing && (
        <div className="mt-2">
          <textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} className={input} aria-label={s.topic} />
          <div className="mt-2 flex gap-2">
            <button className={btn} disabled={pending} onClick={() => run(() => saveSection(s.id, body), () => setEditing(false))}>บันทึก = ยืนยัน</button>
            <button className={btn2} onClick={() => setEditing(false)}>ยกเลิก</button>
            <button className={btn2 + ' ml-auto'} disabled={pending} onClick={() => run(() => setSectionActive(s.id, false))}>เลิกใช้หัวข้อนี้</button>
          </div>
        </div>
      )}

      {turns.length > 0 && (
        <details className="mt-2 text-xs text-muted">
          <summary>บทสัมภาษณ์ {turns.length} ข้อความ</summary>
          <ul className="mt-1 space-y-1">
            {turns.map((t) => <li key={t.id}><b>{t.role === 'AI' ? 'agent' : 'Bay'}:</b> {t.body}</li>)}
          </ul>
        </details>
      )}
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </section>
  );
}

// ── สมุดความคิด Bay ──────────────────────────────────────────────────────────

function Notebook({ notebook, brands, admin }: { notebook: NotebookEntry[]; brands: Brand[]; admin: boolean }) {
  const { error, pending, run } = useRun();
  const [body, setBody] = useState('');
  const [brand, setBrand] = useState('');
  const [showOld, setShowOld] = useState(false);
  const brandName = (id: string | null) => (id ? brands.find((b) => b.id === id)?.name ?? '' : 'ทุกแบรนด์');
  const waiting = notebook.filter((n) => n.status === 'รอยืนยัน');
  const inUse = notebook.filter((n) => n.status === 'ใช้อยู่');
  const retired = notebook.filter((n) => n.status === 'เลิกใช้');

  const Row = ({ n }: { n: NotebookEntry }) => (
    <li className="flex items-start justify-between gap-3 py-2.5">
      <div className="min-w-0 text-sm">
        <p>{n.body}</p>
        <p className="mt-0.5 text-xs text-muted">
          {brandName(n.brand_id)} · {n.source}{n.reason ? ` · ${n.reason}` : ''}
          {n.from_item_id && <> · <Link href={`/content/${n.from_item_id}`} className="underline">จากงาน</Link></>}
        </p>
      </div>
      {admin && (
        <div className="flex shrink-0 gap-1.5">
          {n.status !== 'ใช้อยู่' && <button className={btn2} disabled={pending} onClick={() => run(() => updateNote(n.id, { status: 'ใช้อยู่' }))}>{n.status === 'รอยืนยัน' ? 'ยืนยัน' : 'ใช้อีกครั้ง'}</button>}
          {n.status !== 'เลิกใช้' && <button className={btn2} disabled={pending} onClick={() => run(() => updateNote(n.id, { status: 'เลิกใช้' }))}>{n.status === 'รอยืนยัน' ? 'ไม่เอา' : 'เลิกใช้'}</button>}
        </div>
      )}
    </li>
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">สิ่งที่ agent เรียนรู้จากคำตอบ เหตุผลตีกลับ และสิ่งที่คนแก้ · ใช้ได้เมื่อ Bay ยืนยันเท่านั้น · ไม่มีความจำลับ</p>
      {waiting.length > 0 && (
        <section className="rounded-2xl border border-warn/40 bg-warn/5 p-4">
          <h2 className="text-sm font-medium">agent เสนอ · รอ Bay ยืนยัน {waiting.length} ข้อ</h2>
          <ul className="divide-y divide-border">{waiting.map((n) => <Row key={n.id} n={n} />)}</ul>
        </section>
      )}
      <section className={panel}>
        <h2 className="text-sm font-medium">ใช้อยู่ {inUse.length} ข้อ</h2>
        {inUse.length === 0 && <p className="mt-2 text-sm text-muted">ยังไม่มี</p>}
        <ul className="divide-y divide-border">{inUse.map((n) => <Row key={n.id} n={n} />)}</ul>
        {admin && (
          <div className="mt-3 border-t border-border pt-3">
            <label className="block text-sm font-medium" htmlFor="note-body">Bay เขียนเพิ่มเอง</label>
            <textarea id="note-body" rows={2} value={body} onChange={(e) => setBody(e.target.value)} className={input}
              placeholder='เช่น ไม่ใช้คำว่า "ราคาพิเศษ"' />
            <div className="mt-2 flex gap-2">
              <select value={brand} onChange={(e) => setBrand(e.target.value)} aria-label="ใช้กับแบรนด์"
                className="rounded-xl border border-border bg-bg px-3 text-sm">
                <option value="">ทุกแบรนด์</option>
                {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              <button className={btn} disabled={pending || !body.trim()} onClick={() => run(() => addNote(body, brand || null), () => setBody(''))}>เพิ่ม</button>
            </div>
          </div>
        )}
      </section>
      {retired.length > 0 && (
        <div>
          <button className="text-sm text-muted underline" onClick={() => setShowOld(!showOld)}>เลิกใช้แล้ว {retired.length} ข้อ</button>
          {showOld && <ul className="divide-y divide-border">{retired.map((n) => <Row key={n.id} n={n} />)}</ul>}
        </div>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}

// ── คู่มือแพลตฟอร์ม ───────────────────────────────────────────────────────────

function Playbooks({ playbooks, admin }: { playbooks: Playbook[]; admin: boolean }) {
  const order = ['facebook', 'instagram', 'website'];
  const sorted = [...playbooks].sort((a, b) => order.indexOf(a.channel_id) - order.indexOf(b.channel_id));
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">agent คิดแยกตามช่องทางจากคู่มือนี้ · ผมเขียนตั้งต้นไว้ Bay แก้ได้เลย</p>
      {sorted.length === 0 && <p className="text-sm text-muted">แบรนด์นี้ยังไม่มีคู่มือ · สร้างได้จากแท็บ Brand model</p>}
      {sorted.map((pb) => <PlaybookCard key={pb.id} pb={pb} admin={admin} />)}
    </div>
  );
}

function PlaybookCard({ pb, admin }: { pb: Playbook; admin: boolean }) {
  const { error, pending, run } = useRun();
  const [body, setBody] = useState(pb.body);
  return (
    <section className={panel}>
      <h2 className="text-sm font-semibold">{channelName(pb.channel_id)}</h2>
      <textarea rows={8} value={body} onChange={(e) => setBody(e.target.value)} readOnly={!admin} className={input} aria-label={channelName(pb.channel_id)} />
      {admin && body !== pb.body && (
        <button className={btn + ' mt-2'} disabled={pending} onClick={() => run(() => savePlaybook(pb.id, body))}>บันทึก</button>
      )}
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </section>
  );
}

// ── งบ AI + บันทึกการใช้ ────────────────────────────────────────────────────

const baht = (n: number) => Number(n).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function AiUsage({ budget, requests, team, admin }: { budget: AiBudget | null; requests: AiRequest[]; team: Person[]; admin: boolean }) {
  const { error, pending, run } = useRun();
  const [saved, setSaved] = useState(false);
  if (!budget) return <p className="text-sm text-muted">อ่านงบไม่ได้</p>;
  const pct = budget.monthly_budget_thb > 0 ? Math.min(100, (budget.spent_thb / budget.monthly_budget_thb) * 100) : 100;
  const name = (id: string) => team.find((t) => t.id === id)?.full_name ?? '—';

  return (
    <div className="space-y-4">
      <section className={panel}>
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-medium">เดือนนี้ใช้ไป</h2>
          <span className="text-xs text-muted">{budget.requests} ครั้ง</span>
        </div>
        <div className="mt-1 text-2xl font-semibold tabular-nums">
          {baht(budget.spent_thb)} <span className="text-sm font-normal text-muted">/ {baht(budget.monthly_budget_thb)} บาท</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-bg">
          <div className={'h-full ' + (pct >= 90 ? 'bg-danger' : pct >= 70 ? 'bg-warn' : 'bg-ok')} style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-2 text-xs text-muted">
          ใช้ครบงบแล้ว agent หยุดเอง จนขึ้นเดือนใหม่หรือ Bay เพิ่มงบ · คิดที่ {budget.thb_per_usd} บาท/ดอลลาร์{budget.paused ? ' · ⏸ พักอยู่' : ''}
        </p>
      </section>

      {admin && (
        <form className={panel + ' space-y-3'} onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); setSaved(false); run(() => saveAiSettings(fd), () => setSaved(true)); }}>
          <h2 className="text-sm font-medium">ตั้งค่า (Bay)</h2>
          <div>
            <label className="block text-sm font-medium" htmlFor="model">รุ่น AI</label>
            <select id="model" name="model" defaultValue={budget.model} className={input}>
              {AI_MODELS.map((m) => <option key={m.id} value={m.id}>{m.name} · ${m.in}/${m.out} ต่อล้าน token</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium" htmlFor="budget">งบต่อเดือน (บาท)</label>
              <input id="budget" name="monthly_budget_thb" type="number" min={0} step={1} defaultValue={budget.monthly_budget_thb} className={input} />
            </div>
            <div>
              <label className="block text-sm font-medium" htmlFor="rate">บาทต่อดอลลาร์</label>
              <input id="rate" name="thb_per_usd" type="number" min={1} step={0.5} defaultValue={budget.thb_per_usd} className={input} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="paused" defaultChecked={budget.paused} className="h-5 w-5" /> พัก agent ไว้ก่อน
          </label>
          <button className={btn} disabled={pending}>{saved ? 'บันทึกแล้ว' : 'บันทึก'}</button>
          {error && <p className="text-sm text-danger">{error}</p>}
        </form>
      )}

      <section className={panel}>
        <h2 className="text-sm font-medium">บันทึกทุกครั้งที่ agent ทำงาน</h2>
        {requests.length === 0 && <p className="mt-2 text-sm text-muted">ยังไม่มี</p>}
        <ul className="mt-2 divide-y divide-border">
          {requests.map((r) => (
            <li key={r.id} className="flex items-start justify-between gap-3 py-2 text-sm">
              <div className="min-w-0">
                <div>
                  {r.kind} · <span className={r.status === 'สำเร็จ' || r.status === 'ถามก่อน' ? 'text-ok' : 'text-danger'}>{r.status}</span>
                  {r.item_id && <> · <Link href={`/content/${r.item_id}`} className="underline">งาน</Link></>}
                </div>
                <div className="truncate text-xs text-muted">
                  {name(r.requested_by)} · {new Date(r.created_at).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  {r.instruction ? ` · ${r.instruction}` : ''}{r.error ? ` · ${r.error}` : ''}
                </div>
              </div>
              <span className="shrink-0 tabular-nums text-muted">{baht(r.cost_thb)} ฿</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
