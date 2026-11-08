import { createClient } from '@/lib/supabase/server';
import { getMyCapabilities } from '@/modules/registry';
import { LINE_MODELS } from '@/modules/line-agent/intent';
import { botInfo, lineSecrets } from '@/modules/line-agent/line';
import { closeChange, decideRoom, saveRoomFlags, saveSettings, setFlag, syncSheetsNow, togglePause } from '@/modules/line-agent/admin';
import { serviceEmail } from '@/modules/sheets/google';

export const metadata = { title: 'ผู้ช่วย LINE · Chaw Cher OS' };

type Room = {
  id: string; name: string | null; group_id: string; status: string; joined_at: string;
  see_price: boolean; see_customer: boolean; see_money: boolean; see_address: boolean;
  customer_draft: boolean; draft_polite: string; can_slip: boolean; can_photo: boolean; push_worksheet: boolean;
};
type Change = { id: string; bls: string | null; text: string; display_name: string | null; created_at: string };
type Photo = { id: string; bls: string; image_path: string; display_name: string | null; created_at: string };
const FLAG_LABELS: [keyof Room, string][] = [
  ['see_price', 'เห็นราคาขาย / Clearance'], ['see_customer', 'เห็นชื่อลูกค้า'], ['see_money', 'เห็นยอดขาย / ยอดค้าง'],
  ['see_address', 'เห็นที่ส่ง / รายละเอียดการส่ง'], ['customer_draft', 'แนบข้อความพร้อมส่งลูกค้า'],
  ['can_slip', 'อ่านสลิป (Reply รูป + "สลิป")'], ['can_photo', 'เก็บรูปงานเสร็จ (Reply รูป + "งานเสร็จ BLS…")'],
  ['push_worksheet', 'รับใบงานผลิตอัตโนมัติ (บอทพูดเอง · นับโควตา LINE)'],
];
type Req = {
  id: string; created_at: string; display_name: string | null; question: string; answer: string | null;
  status: string; error: string | null; data_used: string | null; flagged: boolean;
  input_tokens: number | null; output_tokens: number | null;
  usd_per_mtok_in: number | null; usd_per_mtok_out: number | null; thb_per_usd: number | null;
};
type Source = {
  id: string; name_th: string; tab: string | null; rows: number | null; expires_on: string | null;
  last_ok_at: string | null; last_try_at: string | null; last_error: string | null; warnings: string[];
};
type Budget = {
  model: string; monthly_budget_thb: number; thb_per_usd: number; paused: boolean;
  spent_thb: number; remaining_thb: number; answered: number; flagged: number;
};

const when = (iso: string) =>
  new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    .format(new Date(iso));
const thb = (r: Req) =>
  r.input_tokens == null ? 0
    : ((r.input_tokens * Number(r.usd_per_mtok_in) + (r.output_tokens ?? 0) * Number(r.usd_per_mtok_out)) / 1e6) * Number(r.thb_per_usd);
const pill = (tone: 'ok' | 'warn' | 'bad') =>
  'rounded-lg px-2 py-0.5 text-xs ' +
  (tone === 'ok' ? 'bg-ok/15 text-ok' : tone === 'warn' ? 'bg-warn/15 text-warn' : 'bg-danger/15 text-danger');
const card = 'rounded-2xl border border-border bg-surface p-4';

export default async function LinePage({ searchParams }: PageProps<'/line'>) {
  const caps = await getMyCapabilities();
  if (!caps.has('admin')) {
    return <p className={card + ' text-sm text-muted'}>หน้านี้สำหรับ Bay เท่านั้น</p>;
  }
  const { only } = await searchParams;
  const supabase = await createClient();
  const db = supabase.schema('line_agent');
  let reqQ = db.from('requests').select('*').order('created_at', { ascending: false }).limit(50);
  if (only === 'flagged') reqQ = reqQ.eq('flagged', true);
  const [{ data: changes }, { data: photos }, { count: slipsWaiting }] = await Promise.all([
    db.from('change_requests').select('*').eq('status', 'เปิด').order('created_at', { ascending: false }).limit(20),
    db.from('work_photos').select('*').order('created_at', { ascending: false }).limit(12),
    db.from('slips').select('id', { count: 'exact', head: true }).in('status', ['รอเลือก BLS', 'รอการเงินยืนยัน', 'ยืนยันแล้ว']),
  ]);
  const photoUrls = new Map<string, string>();
  if ((photos as Photo[] | null)?.length) {
    const { data: signed } = await supabase.storage.from('line-images')
      .createSignedUrls((photos as Photo[]).map((p) => p.image_path), 600);
    (signed ?? []).forEach((x) => { if (x.path && x.signedUrl) photoUrls.set(x.path, x.signedUrl); });
  }
  const [{ data: rooms }, { data: budget }, { data: reqs }, { data: sources }] = await Promise.all([
    db.from('rooms').select('*').order('joined_at', { ascending: false }),
    db.from('v_budget').select('*').maybeSingle(),
    reqQ,
    supabase.schema('sheets').from('sources').select('*').order('id'),
  ]);
  const gEmail = serviceEmail();
  const b = budget as Budget | null;
  const keys = lineSecrets();
  const info = keys ? await botInfo(keys.token) : null;
  const hasSecret = Boolean(process.env.SUPABASE_SECRET_KEY);
  const hasClaude = Boolean(process.env.ANTHROPIC_API_KEY);

  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight">ผู้ช่วย LINE</h1>
      <p className="mt-1 text-sm text-muted">
        บอทในกลุ่ม CC · แต่ละกลุ่มเห็นข้อมูลไม่เท่ากัน ตั้งได้ด้านล่าง · ต้นทุนและกำไรไม่มีทางเห็น
      </p>

      {/* LR-21 · ปุ่มพักบอท */}
      <form action={togglePause} className={card + ' mt-4 flex items-center justify-between gap-3'}>
        <div>
          <div className="font-medium">{b?.paused ? '⏸ บอทพักอยู่ · เงียบทุกห้อง' : '▶️ บอททำงานอยู่'}</div>
          <div className="text-xs text-muted">กดพักแล้วบอทเงียบทันที ทีมคุยกันแบบเดิมได้เลย</div>
        </div>
        <input type="hidden" name="paused" value={b?.paused ? 'false' : 'true'} />
        <button className={'shrink-0 rounded-xl px-4 py-2 text-sm font-medium ' +
          (b?.paused ? 'bg-accent text-accent-fg' : 'border border-danger text-danger')}>
          {b?.paused ? 'เปิดบอท' : 'พักบอท'}
        </button>
      </form>

      {/* LR-23 · การเชื่อมต่อ */}
      <div className={card + ' mt-3 space-y-1 text-sm'}>
        <div className="flex justify-between"><span>LINE</span>
          {info ? <span className={pill('ok')}>เชื่อมต่อได้ · {info.displayName}</span>
            : <span className={pill('bad')}>{keys ? 'token ใช้ไม่ได้' : 'ยังไม่ได้ใส่ key ใน Vercel'}</span>}</div>
        <div className="flex justify-between"><span>ฐานข้อมูล (SUPABASE_SECRET_KEY)</span>
          <span className={pill(hasSecret ? 'ok' : 'bad')}>{hasSecret ? 'มีแล้ว' : 'ยังไม่ได้ใส่'}</span></div>
        <div className="flex justify-between"><span>Claude (ANTHROPIC_API_KEY)</span>
          <span className={pill(hasClaude ? 'ok' : 'bad')}>{hasClaude ? 'มีแล้ว' : 'ยังไม่ได้ใส่'}</span></div>
      </div>

      {/* ข้อมูลจาก Google Sheet · ชุด 1 */}
      <div className="mt-6 mb-2 flex items-center justify-between gap-3">
        <h2 className="font-semibold">ข้อมูลจาก Google Sheet</h2>
        <form action={syncSheetsNow}><button className="rounded-xl border border-border px-3 py-1.5 text-sm">ดึงตอนนี้</button></form>
      </div>
      <div className={card + ' space-y-2 text-sm'}>
        <p className="text-xs text-muted">
          อ่านอย่างเดียว ไม่แก้ชีต · ดึงเองเมื่อมีคนถามบอทและข้อมูลเก่ากว่า 10 นาที + ทุกเช้า 6 โมง
          {gEmail ? <> · แชร์ชีตให้ <span className="select-all font-mono">{gEmail}</span> แบบผู้ดู</> : <span className="text-danger"> · ยังไม่ได้ใส่ GOOGLE_SERVICE_ACCOUNT_JSON</span>}
        </p>
        {((sources as Source[] | null) ?? []).map((s) => (
          <div key={s.id} className="border-t border-border pt-2">
            <div className="flex justify-between gap-2">
              <span className="min-w-0 truncate">{s.name_th}{s.tab ? <span className="text-muted"> · {s.tab}</span> : null}</span>
              {s.last_error
                ? <span className={pill('bad')}>ดึงไม่ได้</span>
                : s.last_ok_at ? <span className={pill('ok')}>{s.rows ?? 0} แถว · {when(s.last_ok_at)}</span>
                : <span className={pill('warn')}>ยังไม่เคยดึง</span>}
            </div>
            {s.last_error && <div className="mt-1 text-xs text-danger">{s.last_error}</div>}
            {s.expires_on && <div className="mt-1 text-xs text-muted">ราคาหมดอายุ {s.expires_on}</div>}
            {s.warnings?.length > 0 && (
              <details className="mt-1 text-xs text-muted">
                <summary>อ่านไม่ออก {s.warnings.length} จุด</summary>
                <ul className="mt-1 list-disc pl-5">{s.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
              </details>
            )}
          </div>
        ))}
      </div>

      {/* LR-3 · ห้อง */}
      <h2 className="mt-6 mb-2 font-semibold">ห้อง</h2>
      {(rooms as Room[] | null)?.length ? (rooms as Room[]).map((r) => (
        <div key={r.id} className={card + ' mb-2 text-sm'}>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate font-medium">{r.name ?? 'ห้องไม่มีชื่อ'}</div>
              <div className="text-xs text-muted">เชิญเมื่อ {when(r.joined_at)}</div>
            </div>
            {r.status === 'รออนุมัติ' ? (
              <div className="flex shrink-0 gap-2">
                <form action={decideRoom}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="status" value="อนุมัติ" />
                  <button className="rounded-xl bg-accent px-3 py-1.5 text-sm text-accent-fg">อนุมัติ</button></form>
                <form action={decideRoom}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="status" value="ปฏิเสธ" />
                  <button className="rounded-xl border border-border px-3 py-1.5 text-sm">ปฏิเสธ</button></form>
              </div>
            ) : (
              <span className={pill(r.status === 'อนุมัติ' ? 'ok' : r.status === 'ปฏิเสธ' ? 'bad' : 'warn')}>{r.status}</span>
            )}
          </div>
          {r.status !== 'รออนุมัติ' && r.status !== 'บอทออกแล้ว' && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-muted">
                ตั้งค่ากลุ่มนี้ · {FLAG_LABELS.filter(([k]) => r[k]).map(([, l]) => l.split(' (')[0]).join(' · ') || 'ปิดหมด'}
              </summary>
              <form action={saveRoomFlags} className="mt-2 space-y-1.5">
                <input type="hidden" name="id" value={r.id} />
                {FLAG_LABELS.map(([k, label]) => (
                  <label key={k} className="flex items-center gap-2">
                    <input type="checkbox" name={k} defaultChecked={Boolean(r[k])} className="h-4 w-4 accent-[var(--accent)]" /> {label}
                  </label>
                ))}
                <label className="flex items-center gap-2">คำลงท้ายข้อความถึงลูกค้า
                  <select name="draft_polite" defaultValue={r.draft_polite} className="rounded-lg border border-border bg-bg p-1">
                    <option>ค่ะ</option><option>ครับ</option>
                  </select>
                </label>
                <label className="flex items-center gap-2">สถานะ
                  <select name="status" defaultValue={r.status} className="rounded-lg border border-border bg-bg p-1">
                    <option>อนุมัติ</option><option>ปฏิเสธ</option>
                  </select>
                </label>
                <button className="rounded-xl bg-accent px-3 py-1.5 text-sm text-accent-fg">บันทึกกลุ่มนี้</button>
              </form>
            </details>
          )}
        </div>
      )) : (
        <p className={card + ' text-sm text-muted'}>ยังไม่มีห้อง · เชิญบอทเข้าห้อง LINE แล้วห้องจะขึ้นที่นี่ให้กดอนุมัติ</p>
      )}

      {/* ชุด B · สลิป */}
      <a href="/line/slips" className={card + ' mt-3 flex items-center justify-between text-sm'}>
        <span>🧾 สลิปรอดำเนินการ</span>
        <span className={pill((slipsWaiting ?? 0) > 0 ? 'warn' : 'ok')}>{slipsWaiting ?? 0} ใบ · เปิดหน้าสลิป →</span>
      </a>

      {/* ชุด C · คำขอค้าง */}
      <h2 className="mt-6 mb-2 font-semibold">คำขอเลื่อน / เปลี่ยน ที่ยังไม่ปิด</h2>
      {(changes as Change[] | null)?.length ? (changes as Change[]).map((c) => (
        <div key={c.id} className={card + ' mb-2 flex items-start justify-between gap-3 text-sm'}>
          <div className="min-w-0">
            <div className="text-xs text-muted">{when(c.created_at)} · {c.display_name ?? '—'}{c.bls ? ` · ${c.bls}` : ''}</div>
            <div className="mt-1 whitespace-pre-wrap">{c.text}</div>
          </div>
          <form action={closeChange}><input type="hidden" name="id" value={c.id} />
            <button className="shrink-0 rounded-xl border border-border px-3 py-1.5 text-xs">ปิดแล้ว</button></form>
        </div>
      )) : <p className={card + ' text-sm text-muted'}>ไม่มีคำขอค้าง</p>}

      {/* ชุด B · รูปงานเสร็จล่าสุด */}
      {(photos as Photo[] | null)?.length ? (
        <>
          <h2 className="mt-6 mb-2 font-semibold">รูปงานเสร็จล่าสุด</h2>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {(photos as Photo[]).map((p) => (
              <a key={p.id} href={photoUrls.get(p.image_path) ?? '#'} target="_blank" className="block overflow-hidden rounded-xl border border-border bg-surface text-xs">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {photoUrls.get(p.image_path) ? <img src={photoUrls.get(p.image_path)} alt={p.bls} className="aspect-square w-full object-cover" /> : <div className="aspect-square" />}
                <div className="p-1.5">{p.bls}<span className="block text-muted">{when(p.created_at)}</span></div>
              </a>
            ))}
          </div>
        </>
      ) : null}

      {/* LR-20 · LR-22 · งบ */}
      <h2 className="mt-6 mb-2 font-semibold">งบ Claude เดือนนี้</h2>
      <form action={saveSettings} className={card + ' space-y-3 text-sm'}>
        <div className="flex justify-between">
          <span>ใช้ไป {Number(b?.spent_thb ?? 0).toFixed(2)} บาท</span>
          <span className="text-muted">เหลือ {Number(b?.remaining_thb ?? 0).toFixed(2)} บาท</span>
        </div>
        <div className="h-2 overflow-hidden rounded bg-border">
          <div className="h-full bg-accent" style={{ width: `${Math.min(100, (Number(b?.spent_thb ?? 0) / Math.max(1, Number(b?.monthly_budget_thb ?? 1))) * 100)}%` }} />
        </div>
        <label className="block">รุ่น
          <select name="model" defaultValue={b?.model} className="mt-1 w-full rounded-xl border border-border bg-bg p-2">
            {LINE_MODELS.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label>งบ/เดือน (บาท)<input name="monthly_budget_thb" type="number" min="0" step="1" defaultValue={b?.monthly_budget_thb}
            className="mt-1 w-full rounded-xl border border-border bg-bg p-2" /></label>
          <label>บาท/ดอลลาร์<input name="thb_per_usd" type="number" min="1" step="0.01" defaultValue={b?.thb_per_usd}
            className="mt-1 w-full rounded-xl border border-border bg-bg p-2" /></label>
        </div>
        <input type="hidden" name="paused" value={b?.paused ? 'on' : ''} />
        <button className="rounded-xl bg-accent px-4 py-2 font-medium text-accent-fg">บันทึก</button>
      </form>

      {/* LR-32 · ความแม่นยำ */}
      <div className={card + ' mt-3 flex items-center justify-between text-sm'}>
        <span>เดือนนี้ตอบ {b?.answered ?? 0} ครั้ง</span>
        <span className={pill(Number(b?.flagged ?? 0) > 0 ? 'bad' : 'ok')}>ถูกแจ้งผิด {b?.flagged ?? 0}</span>
      </div>

      {/* LR-19 · LR-30 · บันทึก */}
      <div className="mt-6 mb-2 flex items-center justify-between">
        <h2 className="font-semibold">บันทึกคำถาม-คำตอบ</h2>
        <a href={only === 'flagged' ? '/line' : '/line?only=flagged'} className="text-sm text-accent">
          {only === 'flagged' ? 'ดูทั้งหมด' : 'ดูเฉพาะที่ถูกแจ้งผิด'}
        </a>
      </div>
      {(reqs as Req[] | null)?.length ? (reqs as Req[]).map((r) => (
        <div key={r.id} className={card + ' mb-2 text-sm ' + (r.flagged ? 'border-danger' : '')}>
          <div className="flex justify-between gap-2 text-xs text-muted">
            <span>{when(r.created_at)} · {r.display_name ?? '—'} · ดึง {r.data_used ?? '—'} · ฿{thb(r).toFixed(2)}</span>
            <span className={pill(r.status === 'ตอบแล้ว' ? 'ok' : r.status === 'ส่งต่อทีม' || r.status === 'ตอบไม่ได้' ? 'warn' : 'bad')}>{r.status}</span>
          </div>
          <div className="mt-2"><b>ถาม:</b> {r.question}</div>
          {r.answer && <div className="mt-1 whitespace-pre-wrap"><b>ตอบ:</b> {r.answer}</div>}
          {r.error && <div className="mt-1 text-xs text-danger">{r.error}</div>}
          <form action={setFlag} className="mt-2">
            <input type="hidden" name="id" value={r.id} />
            <input type="hidden" name="flagged" value={r.flagged ? 'false' : 'true'} />
            <button className="text-xs text-muted underline">{r.flagged ? '⚠️ ถูกแจ้งผิด · กดเพื่อยกเลิกธง' : 'แจ้งว่าคำตอบนี้ผิด'}</button>
          </form>
        </div>
      )) : (
        <p className={card + ' text-sm text-muted'}>ยังไม่มีใครถาม</p>
      )}
    </>
  );
}
