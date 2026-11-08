import { createClient } from '@/lib/supabase/server';
import { getMyCapabilities } from '@/modules/registry';
import { oaSecrets } from '@/modules/line-oa/arrivals';
import { setCounted } from '@/modules/line-oa/actions';

export const metadata = { title: 'มาโชว์รูม · Chaw Cher OS' };

type Arrival = {
  id: string; line_user_id: string; display_name: string | null; message: string;
  booking_code: string | null; arrived_at: string; arrived_on: string; counted: boolean;
};
type Day = { arrived_on: string; people: number; messages: number; with_code: number };

const card = 'rounded-2xl border border-border bg-surface p-4';
const TZ = 'Asia/Bangkok';
const ymd = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d); // YYYY-MM-DD
const time = (iso: string) =>
  new Intl.DateTimeFormat('th-TH', { timeZone: TZ, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    .format(new Date(iso));
const dayLabel = (s: string) =>
  new Intl.DateTimeFormat('th-TH', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short' })
    .format(new Date(s + 'T12:00:00+07:00'));

/** คนไม่ซ้ำในช่วงวัน (คนเดียวมาสองวัน = 2 ครั้ง · วันเดียวส่งสองรอบ = 1) */
function visits(rows: Arrival[], from: string) {
  return new Set(rows.filter((r) => r.counted && r.arrived_on >= from).map((r) => r.arrived_on + r.line_user_id)).size;
}

export default async function ArrivalsPage() {
  const caps = await getMyCapabilities();
  if (!caps.has('admin')) {
    return <p className={card + ' text-sm text-muted'}>หน้านี้สำหรับ Bay เท่านั้น</p>;
  }

  const now = new Date();
  const today = ymd(now);
  const d7 = ymd(new Date(now.getTime() - 6 * 864e5));
  const d30 = ymd(new Date(now.getTime() - 29 * 864e5));
  const month = today.slice(0, 8) + '01';
  const since = month < d30 ? month : d30;

  const supabase = await createClient();
  const db = supabase.schema('line_oa');
  const [{ data: rows }, { data: days }] = await Promise.all([
    db.from('arrivals').select('*').gte('arrived_on', since).order('arrived_at', { ascending: false }).limit(1000),
    db.from('v_daily').select('*').gte('arrived_on', d30).order('arrived_on', { ascending: false }),
  ]);
  const list = (rows as Arrival[] | null) ?? [];
  const daily = (days as Day[] | null) ?? [];
  const keys = oaSecrets();
  const hasSecret = Boolean(process.env.SUPABASE_SECRET_KEY);

  const stats: [string, number][] = [
    ['วันนี้', visits(list, today)],
    ['7 วัน', visits(list, d7)],
    ['เดือนนี้', visits(list, month)],
  ];

  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight">มาโชว์รูม</h1>
      <p className="mt-1 text-sm text-muted">
        นับจากลูกค้าที่สแกนป้าย A4 ในโชว์รูมแล้วกดส่ง &ldquo;มาถึงโชว์รูมแล้ว&rdquo; ทาง LINE @chawcher ·
        นับได้ทั้งเพื่อนใหม่และคนที่คุยกันอยู่แล้ว · คนเดียวส่งหลายครั้งในวันเดียว = 1
      </p>

      <div className="mt-4 grid grid-cols-3 gap-3">
        {stats.map(([label, n]) => (
          <div key={label} className={card + ' text-center'}>
            <div className="text-3xl font-semibold tabular-nums">{n}</div>
            <div className="text-xs text-muted">{label}</div>
          </div>
        ))}
      </div>

      {/* การเชื่อมต่อ */}
      <div className={card + ' mt-3 space-y-1 text-sm'}>
        <div className="flex justify-between gap-2"><span>LINE @chawcher (LINE_OA_CHANNEL_SECRET)</span>
          <span className={'rounded-lg px-2 py-0.5 text-xs ' + (keys ? 'bg-ok/15 text-ok' : 'bg-danger/15 text-danger')}>
            {keys ? 'มีแล้ว' : 'ยังไม่ได้ใส่'}</span></div>
        <div className="flex justify-between gap-2"><span>ชื่อลูกค้า (LINE_OA_CHANNEL_ACCESS_TOKEN)</span>
          <span className={'rounded-lg px-2 py-0.5 text-xs ' + (keys?.token ? 'bg-ok/15 text-ok' : 'bg-warn/15 text-warn')}>
            {keys?.token ? 'มีแล้ว' : 'ไม่มี · นับได้ แต่ไม่เห็นชื่อ'}</span></div>
        <div className="flex justify-between gap-2"><span>ฐานข้อมูล (SUPABASE_SECRET_KEY)</span>
          <span className={'rounded-lg px-2 py-0.5 text-xs ' + (hasSecret ? 'bg-ok/15 text-ok' : 'bg-danger/15 text-danger')}>
            {hasSecret ? 'มีแล้ว' : 'ยังไม่ได้ใส่'}</span></div>
      </div>

      <h2 className="mt-6 mb-2 font-semibold">รายวัน · 30 วันล่าสุด</h2>
      <div className={card + ' text-sm'}>
        {daily.length === 0 ? <p className="text-muted">ยังไม่มีใครแจ้งมาถึง</p> : (
          <table className="w-full">
            <thead className="text-xs text-muted"><tr>
              <th className="py-1 text-left font-normal">วัน</th>
              <th className="py-1 text-right font-normal">คน</th>
              <th className="py-1 text-right font-normal">มีรหัสนัด</th>
            </tr></thead>
            <tbody>{daily.filter((d) => d.people > 0).map((d) => (
              <tr key={d.arrived_on} className="border-t border-border">
                <td className="py-1.5">{dayLabel(d.arrived_on)}</td>
                <td className="py-1.5 text-right tabular-nums">{d.people}</td>
                <td className="py-1.5 text-right tabular-nums text-muted">{d.with_code || '–'}</td>
              </tr>))}
            </tbody>
          </table>
        )}
      </div>

      <h2 className="mt-6 mb-2 font-semibold">ล่าสุด</h2>
      <div className="space-y-2">
        {list.slice(0, 60).map((a) => (
          <div key={a.id} className={card + ' flex items-start justify-between gap-3 text-sm ' + (a.counted ? '' : 'opacity-50')}>
            <div className="min-w-0">
              <div className="font-medium">{a.display_name ?? 'ไม่ทราบชื่อ'}
                {a.booking_code && <span className="ml-2 rounded-lg bg-accent/15 px-2 py-0.5 text-xs">{a.booking_code}</span>}
              </div>
              <div className="text-xs text-muted">{time(a.arrived_at)} · &ldquo;{a.message}&rdquo;</div>
            </div>
            <form action={setCounted} className="shrink-0">
              <input type="hidden" name="id" value={a.id} />
              <input type="hidden" name="counted" value={a.counted ? 'false' : 'true'} />
              <button className="rounded-xl border border-border px-3 py-1.5 text-xs">
                {a.counted ? 'ไม่นับ' : 'นับกลับ'}
              </button>
            </form>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted">
        พนักงานลองสแกนเอง หรือส่งผิด → กด &ldquo;ไม่นับ&rdquo; · ลบไม่ได้ (เก็บประวัติไว้ตามกฎ A7)
      </p>
    </>
  );
}
