import { createClient } from '@/lib/supabase/server';
import { getMyCapabilities } from '@/modules/registry';
import { addKbItem, digestNow, saveKbItem } from '@/modules/line-agent/kb-admin';
import { KB_CATEGORIES } from '@/modules/line-agent/kb-digest';

export const metadata = { title: 'คลังความรู้ · Chaw Cher OS' };

type Item = {
  id: string; title: string; body: string; category: string; bls: string | null; source: string;
  source_refs: { kind: string; id: string | null; excerpt: string }[]; noted_by: string | null;
  status: 'ร่าง' | 'ยืนยันแล้ว' | 'ไม่ใช้'; bot_use: boolean; is_public: boolean;
  public_title: string | null; public_body: string | null; reviewed_at: string | null; created_at: string;
};
type Digest = {
  run_by: string; created_at: string; messages: number; requests: number; items_created: number;
  input_tokens: number | null; output_tokens: number | null; usd_per_mtok_in: number | null;
  usd_per_mtok_out: number | null; thb_per_usd: number | null; error: string | null;
};

const TABS = [['draft', 'ร่างรอตรวจ', 'ร่าง'], ['ok', 'ยืนยันแล้ว', 'ยืนยันแล้ว'], ['off', 'ไม่ใช้', 'ไม่ใช้']] as const;
const card = 'rounded-2xl border border-border bg-surface p-4';
const input = 'w-full rounded-lg border border-border bg-bg p-2 text-sm';
const pill = (tone: 'ok' | 'warn' | 'bad' | 'mute') =>
  'rounded-lg px-2 py-0.5 text-xs ' +
  (tone === 'ok' ? 'bg-ok/15 text-ok' : tone === 'warn' ? 'bg-warn/15 text-warn' : tone === 'bad' ? 'bg-danger/15 text-danger' : 'bg-border text-muted');
const when = (iso: string) =>
  new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
const CATS = ['ยังไม่จัดหมวด', ...KB_CATEGORIES];
const daysAgo = (n: number) => new Date(Date.now() - n * 864e5).toISOString();

export default async function KnowledgePage({ searchParams }: PageProps<'/knowledge'>) {
  const caps = await getMyCapabilities();
  const isAdmin = caps.has('admin');
  if (!isAdmin && !caps.has('sales.write')) {
    return <p className={card + ' text-sm text-muted'}>หน้านี้สำหรับทีม CC เท่านั้น</p>;
  }
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const tab = TABS.find(([k]) => k === one(sp.tab)) ?? (isAdmin ? TABS[0] : TABS[1]);
  const catFilter = one(sp.cat);
  const ok = one(sp.ok); const err = one(sp.err);

  const supabase = await createClient();
  const db = supabase.schema('line_agent');
  let q = db.from('kb_items').select('*').eq('status', tab[2]).order('created_at', { ascending: false }).limit(100);
  if (catFilter) q = q.eq('category', catFilter);
  const monthAgo = daysAgo(30);
  const [{ data }, counts, digest, waiting, collecting, asked] = await Promise.all([
    q,
    Promise.all(TABS.map(([, , st]) => db.from('kb_items').select('id', { count: 'exact', head: true }).eq('status', st))),
    isAdmin ? db.from('kb_digests').select('*').order('created_at', { ascending: false }).limit(1).maybeSingle() : Promise.resolve({ data: null }),
    isAdmin ? db.from('chat_log').select('id', { count: 'exact', head: true }).is('digested_at', null) : Promise.resolve({ count: 0 }),
    isAdmin ? db.from('rooms').select('id', { count: 'exact', head: true }).eq('kb_collect', true) : Promise.resolve({ count: 0 }),
    isAdmin ? db.from('requests').select('question').eq('status', 'ตอบไม่ได้').gte('created_at', monthAgo).order('created_at', { ascending: false }).limit(60)
      : Promise.resolve({ data: [] }),
  ]);
  const items = (data ?? []) as Item[];
  const n = counts.map((c) => c.count ?? 0);
  const d = digest.data as Digest | null;
  const unanswered = [...new Set(((asked.data ?? []) as { question: string }[]).map((r) => r.question.trim()))].slice(0, 8);
  const spent = d && d.input_tokens != null
    ? ((d.input_tokens * Number(d.usd_per_mtok_in) + (d.output_tokens ?? 0) * Number(d.usd_per_mtok_out)) / 1e6) * Number(d.thb_per_usd) : 0;
  const href = (t: string, c?: string) => `/knowledge?tab=${t}${c ? `&cat=${encodeURIComponent(c)}` : ''}`;

  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight">คลังความรู้</h1>
      <p className="mt-1 text-sm text-muted">
        ความรู้ที่เก็บจากกลุ่ม LINE · AI เป็นคนร่าง Bay เป็นคนยืนยัน · บอทใช้เฉพาะข้อที่ยืนยันและติ๊กให้ใช้ ·
        FAQ บนเว็บเฉพาะข้อที่ติ๊ก &quot;สาธารณะ&quot;
      </p>

      {ok && <p className={pill('ok') + ' mt-3 block !rounded-xl !px-3 !py-2 text-sm'}>{ok}</p>}
      {err && <p className={pill('bad') + ' mt-3 block !rounded-xl !px-3 !py-2 text-sm'}>{err}</p>}

      {isAdmin && (
        <div className={card + ' mt-4 space-y-2 text-sm'}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-medium">เก็บบทสนทนา {(collecting.count ?? 0) > 0 ? `${collecting.count} ห้อง` : '· ยังไม่ได้เปิดห้องไหน'}</div>
              <div className="text-xs text-muted">
                ข้อความรอ AI สรุป {waiting.count ?? 0} ข้อความ · เปิดเก็บที่หน้า <a className="underline" href="/line">ผู้ช่วย LINE</a> (ต้องโพสต์แจ้งทีมก่อน)
              </div>
            </div>
            <form action={digestNow}>
              <button className="shrink-0 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-accent-fg">สรุปตอนนี้</button>
            </form>
          </div>
          <div className="border-t border-border pt-2 text-xs text-muted">
            {d ? <>รอบล่าสุด {when(d.created_at)} ({d.run_by}) · อ่าน {d.messages} ข้อความ · ได้ร่าง {d.items_created} ข้อ · ค่า Claude ≈ ฿{spent.toFixed(2)}
              {d.error ? <span className="text-danger"> · {d.error}</span> : null}</>
              : 'ยังไม่เคยสรุป · ระบบสรุปให้เองทุกสัปดาห์ (คืนวันอาทิตย์) · หรือกดปุ่มด้านบน'}
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {TABS.filter(([k]) => isAdmin || k === 'ok').map(([k, label], i) => (
          <a key={k} href={href(k)} className={'rounded-xl border px-3 py-1.5 text-sm ' +
            (k === tab[0] ? 'border-accent bg-accent text-accent-fg' : 'border-border')}>
            {label} <span className="opacity-70">{n[i]}</span>
          </a>
        ))}
        {catFilter && <a href={href(tab[0])} className="rounded-xl border border-border px-3 py-1.5 text-sm text-muted">หมวด: {catFilter} ✕</a>}
      </div>

      <div className="mt-3 space-y-2">
        {items.length === 0 && (
          <p className={card + ' text-sm text-muted'}>
            {tab[0] === 'draft' ? 'ไม่มีร่างรอตรวจ · พิมพ์ "@Team Bay จดเรื่องนี้ …" ในกลุ่ม หรือกด "สรุปตอนนี้"' : 'ยังไม่มีรายการ'}
          </p>
        )}
        {items.map((it) => isAdmin ? (
          <details key={it.id} className={card + ' text-sm'} open={tab[0] === 'draft' && items.length <= 3}>
            <summary className="cursor-pointer">
              <span className="font-medium">{it.title}</span>
              <span className="ml-2 inline-flex flex-wrap gap-1 align-middle">
                <a href={href(tab[0], it.category)} className={pill('mute')}>{it.category}</a>
                <span className={pill('mute')}>{it.source}</span>
                {it.bls && <span className={pill('mute')}>{it.bls}</span>}
                {it.bot_use && <span className={pill('ok')}>บอทใช้</span>}
                {it.is_public && <span className={pill('ok')}>สาธารณะ</span>}
              </span>
            </summary>
            <form action={saveKbItem} className="mt-3 space-y-2">
              <input type="hidden" name="id" value={it.id} />
              <input type="hidden" name="tab" value={tab[0]} />
              <label className="block text-xs text-muted">คำถาม / หัวข้อ (ภายในทีม)
                <input name="title" defaultValue={it.title} required className={input} /></label>
              <label className="block text-xs text-muted">คำตอบ / วิธีทำ (ภายในทีม · บอทใช้ข้อความนี้ตามที่เขียน)
                <textarea name="body" defaultValue={it.body} rows={4} required className={input} /></label>
              <div className="flex flex-wrap gap-2">
                <label className="text-xs text-muted">หมวด
                  <select name="category" defaultValue={it.category} className={input + ' mt-0.5'}>
                    {CATS.map((c) => <option key={c}>{c}</option>)}
                  </select></label>
                <label className="text-xs text-muted">ผูกกับงาน (BLS)
                  <input name="bls" defaultValue={it.bls ?? ''} className={input + ' mt-0.5'} placeholder="ไม่บังคับ" /></label>
              </div>

              {it.source_refs?.length > 0 && (
                <div className="rounded-lg bg-bg p-2 text-xs text-muted">
                  <div className="mb-1 font-medium text-text">หลักฐานต้นทาง{it.noted_by ? ` · จดโดย ${it.noted_by}` : ''}</div>
                  <ul className="list-disc space-y-0.5 pl-4">
                    {it.source_refs.map((r, i) => <li key={i}>{r.kind === 'request' ? '[ถามบอท] ' : ''}{r.excerpt}</li>)}
                  </ul>
                </div>
              )}

              <div className="rounded-lg border border-border p-2">
                <label className="flex items-center gap-2"><input type="checkbox" name="bot_use" defaultChecked={it.bot_use} className="h-4 w-4 accent-[var(--accent)]" />
                  ให้บอทตอบจากข้อนี้ (กลุ่มที่เปิด &quot;ตอบจากคลังความรู้&quot;)</label>
                <label className="mt-2 flex items-center gap-2"><input type="checkbox" name="is_public" defaultChecked={it.is_public} className="h-4 w-4 accent-[var(--accent)]" />
                  ขึ้น FAQ สาธารณะ (chawcher.com)</label>
                <div className="mt-2 space-y-2">
                  <label className="block text-xs text-muted">หัวข้อสำหรับลูกค้า (เขียนใหม่ · ห้ามมีเลข BLS เบอร์โทร ต้นทุน กำไร)
                    <input name="public_title" defaultValue={it.public_title ?? ''} className={input} /></label>
                  <label className="block text-xs text-muted">คำตอบสำหรับลูกค้า
                    <textarea name="public_body" defaultValue={it.public_body ?? ''} rows={3} className={input} /></label>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button name="act" value="confirm" className="rounded-xl bg-accent px-3 py-1.5 text-sm text-accent-fg">
                  {it.status === 'ยืนยันแล้ว' ? 'ยืนยันใหม่' : 'ยืนยัน'}</button>
                <button name="act" value="save" className="rounded-xl border border-border px-3 py-1.5 text-sm">บันทึกแก้</button>
                {it.status !== 'ไม่ใช้' && <button name="act" value="reject" className="rounded-xl border border-danger px-3 py-1.5 text-sm text-danger">ไม่ใช้</button>}
                {it.status !== 'ร่าง' && <button name="act" value="reopen" className="rounded-xl border border-border px-3 py-1.5 text-sm">กลับเป็นร่าง</button>}
              </div>
              <p className="text-xs text-muted">
                {it.reviewed_at ? `ยืนยันเมื่อ ${when(it.reviewed_at)} · ` : ''}สร้างเมื่อ {when(it.created_at)}
                {it.status === 'ยืนยันแล้ว' ? ' · "บันทึกแก้" โดยไม่กดยืนยันใหม่ จะกลับเป็นร่างเอง' : ''}
              </p>
            </form>
          </details>
        ) : (
          <div key={it.id} className={card + ' text-sm'}>
            <div className="font-medium">{it.title} <span className={pill('mute')}>{it.category}</span></div>
            <p className="mt-1 whitespace-pre-line">{it.body}</p>
          </div>
        ))}
      </div>

      {isAdmin && (
        <>
          {unanswered.length > 0 && (
            <>
              <h2 className="mt-6 mb-2 font-semibold">คำถามที่บอทตอบไม่ได้ (30 วันล่าสุด)</h2>
              <p className="mb-2 text-xs text-muted">ถ้ารู้คำตอบ เขียนตรงนี้ → เป็นร่าง → ตรวจแล้วยืนยัน บอทจะตอบได้คราวหน้า</p>
              {unanswered.map((t) => (
                <form key={t} action={addKbItem} className={card + ' mb-2 space-y-2 text-sm'}>
                  <input type="hidden" name="from_request" value="1" />
                  <input type="hidden" name="title" value={t} />
                  <div className="font-medium">{t}</div>
                  <textarea name="body" rows={2} required placeholder="คำตอบ" className={input} />
                  <button className="rounded-xl border border-border px-3 py-1.5 text-sm">เพิ่มเป็นร่าง</button>
                </form>
              ))}
            </>
          )}

          <details className={card + ' mt-6 text-sm'}>
            <summary className="cursor-pointer font-medium">+ เขียนเอง</summary>
            <form action={addKbItem} className="mt-3 space-y-2">
              <input name="title" required placeholder="คำถาม / หัวข้อ" className={input} />
              <textarea name="body" rows={4} required placeholder="คำตอบ / วิธีทำ" className={input} />
              <select name="category" defaultValue="ยังไม่จัดหมวด" className={input}>{CATS.map((c) => <option key={c}>{c}</option>)}</select>
              <button className="rounded-xl bg-accent px-3 py-1.5 text-sm text-accent-fg">เพิ่มเป็นร่าง</button>
            </form>
          </details>

          <p className={card + ' mt-6 text-xs text-muted'}>
            FAQ สาธารณะ: <a className="underline" href="/faq" target="_blank" rel="noreferrer">/faq</a> (หน้า) ·{' '}
            <a className="underline" href="/api/faq" target="_blank" rel="noreferrer">/api/faq</a> (ข้อมูลให้ chawcher.com ดึงไปแสดง) ·
            ตอนนี้มี {n[1] > 0 ? 'ข้อที่ยืนยันแล้ว ' + n[1] + ' ข้อ' : 'ยังไม่มีข้อที่ยืนยัน'}
          </p>
        </>
      )}
    </>
  );
}
