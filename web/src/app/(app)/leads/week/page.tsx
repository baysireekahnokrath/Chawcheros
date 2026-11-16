import Link from 'next/link';
import LeadsNav, { LoadError } from '@/components/leads/LeadsNav';
import { thaiDate } from '@/modules/leads/drafts';
import { addDays, bangkokToday, getWeek, weekStart } from '@/modules/leads/queries';

export const dynamic = 'force-dynamic';

const box = 'mt-3 rounded-2xl border border-border bg-surface p-4';
const h3 = 'mb-2 text-sm font-semibold';
const cell = 'border-t border-border px-1 py-1.5 text-right tabular-nums first:text-left';

/** สรุปสัปดาห์ (เสาร์ถึงศุกร์) · ตัวเลขทุกตัวนับสดจากรายการ ไม่มีช่องให้พิมพ์ตัวเลข */
export default async function LeadsWeekPage({ searchParams }: PageProps<'/leads/week'>) {
  const { w } = await searchParams;
  const today = bangkokToday();
  const from = weekStart(typeof w === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(w) && !Number.isNaN(Date.parse(w)) ? w : today);
  const { data: s, error } = await getWeek(from);
  const thisWeek = from === weekStart(today);

  const f = s?.funnel;
  const rows: [string, number, boolean][] = f
    ? [['ทักมา', f.new, false], ['ตอบแล้ว', f.replied, false], ['เสนอราคาแล้ว', f.quoted, false],
       ['นัดแล้ว', f.appointed, false], ['มาโชว์รูม', f.visited, true], ['ซื้อ', f.bought, true]]
    : [];
  const max = Math.max(1, ...rows.map((r) => r[1]));
  const channels = (s?.channels ?? []).filter((c) => c.new + c.appointed + c.visited + c.bought > 0);
  const sum = (k: 'new' | 'appointed' | 'visited' | 'bought') => channels.reduce((n, c) => n + c[k], 0);

  return (
    <>
      <LeadsNav current="week" />
      {error && <LoadError message={error} />}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">
          สรุปสัปดาห์ <span className="text-sm font-normal text-muted">{thaiDate(from)} ถึง {thaiDate(addDays(from, 6))}</span>
        </h2>
        <span className="flex gap-2 text-sm">
          <Link href={`/leads/week?w=${addDays(from, -7)}`} className="rounded-xl border border-border bg-surface px-3 py-2">← ก่อนหน้า</Link>
          {!thisWeek && <Link href={`/leads/week?w=${addDays(from, 7)}`} className="rounded-xl border border-border bg-surface px-3 py-2">ถัดไป →</Link>}
        </span>
      </div>
      <p className="mt-1 text-xs text-muted">
        ระบบนับจากรายการให้เอง ไม่มีช่องให้พิมพ์ตัวเลข · นับสิ่งที่เกิดขึ้นในสัปดาห์นี้ (คนที่ทักมาสัปดาห์ก่อนแล้วมานัดสัปดาห์นี้ นับที่ “นัดแล้ว” ของสัปดาห์นี้) · ไม่นับรายการที่ติ๊ก “ไม่นับ”
      </p>

      {f && (
        <>
          <div className={box}>
            <h3 className={h3}>จากทักมา ถึงซื้อ</h3>
            <div className="grid gap-2">
              {rows.map(([label, n, goal]) => (
                <div key={label} className="grid grid-cols-[92px_1fr] items-center gap-2 text-sm">
                  <span>{label}</span>
                  <span className="flex min-w-0 items-center gap-2">
                    <span className={'h-6 min-w-1.5 rounded-md ' + (goal ? 'bg-ok' : 'bg-accent')} style={{ width: `${Math.round((n / max) * 78)}%` }} />
                    <span className="font-semibold tabular-nums">{n}</span>
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-3 border-l-[3px] border-ok pl-2.5 text-sm">
              {f.new === 0 && f.appointed === 0 && f.visited === 0
                ? 'สัปดาห์นี้ยังไม่มีรายการ'
                : `ทักมา ${f.new} คน นัดได้ ${f.appointed} คน มาโชว์รูม ${f.visited} คน ซื้อ ${f.bought} คน · จุดที่ต้องดันคือ “ชวนมาโชว์รูม”`}
            </p>
          </div>

          <div className={box}>
            <h3 className={h3}>แยกตามช่องทาง</h3>
            {channels.length === 0 ? (
              <p className="text-sm text-muted">ยังไม่มีข้อมูลในสัปดาห์นี้</p>
            ) : (
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="text-xs">
                    {['ช่องทาง', 'ทักมา', 'นัดแล้ว', 'มาโชว์รูม', 'ซื้อ'].map((h) => (
                      <th key={h} className="px-1 py-1.5 text-right font-medium first:text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {channels.map((c) => (
                    <tr key={c.channel}>
                      <td className={cell}>{c.channel}</td>
                      <td className={cell}>{c.new}</td>
                      <td className={cell}>{c.appointed}</td>
                      <td className={cell}>{c.visited}</td>
                      <td className={cell}>{c.bought}</td>
                    </tr>
                  ))}
                  <tr className="font-medium">
                    <td className={cell}>รวม</td>
                    <td className={cell}>{sum('new')}</td>
                    <td className={cell}>{sum('appointed')}</td>
                    <td className={cell}>{sum('visited')}</td>
                    <td className={cell}>{sum('bought')}</td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2.5">
            <div className="rounded-2xl border border-border bg-surface p-4">
              <div className="text-2xl font-semibold tabular-nums">
                {s.first_reply.avg_minutes === null ? 'ยังไม่มี' : `${s.first_reply.avg_minutes} นาที`}
              </div>
              <div className="text-xs text-muted">เวลาตอบครั้งแรก เฉลี่ย ({s.first_reply.n} คน)</div>
            </div>
            <div className="rounded-2xl border border-border bg-surface p-4">
              <div className="text-2xl font-semibold tabular-nums">{s.first_reply.slow} คน</div>
              <div className="text-xs text-muted">ตอบช้ากว่า 1 ชั่วโมง</div>
            </div>
          </div>
          <p className="mt-1.5 text-xs text-muted">
            เวลาตอบนับเฉพาะคนที่ LINE เข้าระบบเอง จากเวลาที่ทักถึงเวลาที่พนักงานกด “ตอบแล้ว” · คนที่พนักงานกดบันทึกเอง ระบบไม่รู้เวลาที่ลูกค้าทักจริง จึงไม่นับ
          </p>

          <div className={box}>
            <h3 className={h3}>เหตุผลที่หาย ({f.lost} คน)</h3>
            {s.lost_reasons.length === 0 ? (
              <p className="text-sm text-muted">สัปดาห์นี้ไม่มีรายการที่ปิดเป็นหาย</p>
            ) : (
              <table className="w-full border-collapse text-sm">
                <tbody>
                  {s.lost_reasons.map((r) => (
                    <tr key={r.reason}>
                      <td className={cell}>{r.reason}</td>
                      <td className={cell}>{r.n}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      <p className="mt-8 text-xs text-muted">หน้านี้มีแต่ตัวเลข ไม่มีชื่อลูกค้า ไม่มีข้อมูลต้นทุนหรือกำไร</p>
    </>
  );
}
