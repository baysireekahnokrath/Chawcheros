import { createClient } from '@/lib/supabase/server';
import { getMyCapabilities } from '@/modules/registry';
import { slipAction } from '@/modules/line-agent/admin';

export const metadata = { title: 'สลิปรอยืนยัน · Chaw Cher OS' };

type Slip = {
  id: string; status: string; bls: string | null; amount: number | null; paid_on: string | null; paid_time: string | null;
  bank: string | null; ref: string | null; payer_name: string | null; receiver_name: string | null; display_name: string | null;
  image_path: string; created_at: string; note: string | null;
  candidates: { bls: string; customer_name: string | null; balance: number | null }[];
};

const TABS = [
  ['todo', 'ต้องทำ', ['รอเลือก BLS', 'รอการเงินยืนยัน', 'ยืนยันแล้ว']],
  ['done', 'ลงชีตแล้ว', ['ลงชีตแล้ว']],
  ['other', 'ซ้ำ / ไม่ใช่สลิป', ['ซ้ำ', 'ไม่ใช่สลิป']],
] as const;

const card = 'rounded-2xl border border-border bg-surface p-4';
const when = (iso: string) =>
  new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
const baht = (n: number | null) => (n == null ? '—' : Number(n).toLocaleString('th-TH', { maximumFractionDigits: 2 }));
const tone: Record<string, string> = {
  'รอเลือก BLS': 'bg-warn/15 text-warn', 'รอการเงินยืนยัน': 'bg-warn/15 text-warn', 'ยืนยันแล้ว': 'bg-accent/15 text-accent',
  'ลงชีตแล้ว': 'bg-ok/15 text-ok', 'ซ้ำ': 'bg-danger/15 text-danger', 'ไม่ใช่สลิป': 'bg-border text-muted',
};

export default async function SlipsPage({ searchParams }: PageProps<'/line/slips'>) {
  const caps = await getMyCapabilities();
  if (!caps.has('admin') && !caps.has('finance.write')) {
    return <p className={card + ' text-sm text-muted'}>หน้านี้สำหรับ Bay และฝ่ายการเงินเท่านั้น</p>;
  }
  const { tab } = await searchParams;
  const active = TABS.find(([k]) => k === tab) ?? TABS[0];
  const supabase = await createClient();
  const { data } = await supabase.schema('line_agent').from('slips').select('*')
    .in('status', [...active[2]]).order('created_at', { ascending: false }).limit(50);
  const slips = (data ?? []) as Slip[];
  const urls = new Map<string, string>();
  if (slips.length) {
    const { data: signed } = await supabase.storage.from('line-images').createSignedUrls(slips.map((s) => s.image_path), 600);
    (signed ?? []).forEach((x) => { if (x.path && x.signedUrl) urls.set(x.path, x.signedUrl); });
  }

  return (
    <>
      <a href="/line" className="text-sm text-muted">← ผู้ช่วย LINE</a>
      <h1 className="mt-2 text-xl font-semibold tracking-tight">สลิปรอยืนยัน</h1>
      <p className="mt-1 text-sm text-muted">
        AI อ่านสลิปเป็นร่าง · ตรวจกับรูปทุกครั้งก่อนกดยืนยัน · ยืนยันแล้วไปพิมพ์ลง Google Sheet ตามเดิม แล้วกด &quot;ลงชีตแล้ว&quot;
      </p>

      <div className="mt-4 flex gap-2">
        {TABS.map(([k, label]) => (
          <a key={k} href={`/line/slips?tab=${k}`}
            className={'rounded-xl border px-3 py-2 text-sm ' + (active[0] === k ? 'border-accent bg-accent/10 font-medium text-accent' : 'border-border bg-surface text-muted')}>
            {label}
          </a>
        ))}
      </div>

      {slips.length === 0 && <p className={card + ' mt-4 text-sm text-muted'}>ไม่มีสลิปในกลุ่มนี้</p>}

      {slips.map((s) => (
        <div key={s.id} className={card + ' mt-3 grid gap-3 sm:grid-cols-[160px_1fr]'}>
          <a href={urls.get(s.image_path) ?? '#'} target="_blank" className="block overflow-hidden rounded-xl border border-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {urls.get(s.image_path) ? <img src={urls.get(s.image_path)} alt="สลิป" className="w-full object-contain" /> : <div className="aspect-[3/4]" />}
          </a>
          <div className="min-w-0 space-y-2 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-lg font-semibold tabular-nums">฿{baht(s.amount)}</span>
              <span className={'rounded-lg px-2 py-0.5 text-xs ' + (tone[s.status] ?? '')}>{s.status}</span>
            </div>
            <div className="text-muted">
              {s.paid_on ?? 'ไม่มีวันที่'}{s.paid_time ? ` ${s.paid_time}` : ''} · {s.bank ?? 'ไม่รู้ธนาคาร'} · อ้างอิง {s.ref ?? '—'}
              <br />ผู้โอน {s.payer_name ?? '—'} → {s.receiver_name ?? '—'}
              <br />ส่งในกลุ่มโดย {s.display_name ?? '—'} · {when(s.created_at)}
            </div>
            {s.candidates?.length > 0 && !s.bls && (
              <div className="text-xs text-muted">น่าจะเป็น: {s.candidates.map((c) => `${c.bls} (${c.customer_name ?? '—'} · ค้าง ${baht(c.balance)})`).join(' · ')}</div>
            )}

            {['รอเลือก BLS', 'รอการเงินยืนยัน'].includes(s.status) && (
              <form action={slipAction} className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="id" value={s.id} />
                <input type="hidden" name="act" value="confirm" />
                <label className="text-xs">BLS
                  <input name="bls" defaultValue={s.bls ?? s.candidates?.[0]?.bls ?? ''} className="mt-1 block w-28 rounded-lg border border-border bg-bg p-1.5" />
                </label>
                <label className="text-xs">ยอด
                  <input name="amount" defaultValue={s.amount ?? ''} className="mt-1 block w-28 rounded-lg border border-border bg-bg p-1.5" />
                </label>
                <button className="rounded-xl bg-accent px-3 py-2 text-sm text-accent-fg">✅ ยืนยัน ตรงกับรูป</button>
              </form>
            )}
            {s.status === 'ยืนยันแล้ว' && (
              <form action={slipAction}>
                <input type="hidden" name="id" value={s.id} /><input type="hidden" name="act" value="posted" />
                <div className="mb-2">ผูกกับ <b>{s.bls}</b> · ไปพิมพ์ลง Order Tracking แล้วกดปุ่มนี้</div>
                <button className="rounded-xl bg-accent px-3 py-2 text-sm text-accent-fg">📗 ลงชีตแล้ว</button>
              </form>
            )}
            {['รอเลือก BLS', 'รอการเงินยืนยัน', 'ยืนยันแล้ว'].includes(s.status) && (
              <form action={slipAction} className="flex flex-wrap items-center gap-2">
                <input type="hidden" name="id" value={s.id} /><input type="hidden" name="act" value="reject" />
                <input name="note" placeholder="เหตุผล (ถ้ามี)" className="rounded-lg border border-border bg-bg p-1.5 text-xs" />
                <button className="rounded-xl border border-border px-3 py-1.5 text-xs">❌ ไม่ใช่สลิป / ไม่นับ</button>
              </form>
            )}
            {s.note && <div className="text-xs text-muted">หมายเหตุ: {s.note}</div>}
          </div>
        </div>
      ))}
    </>
  );
}
