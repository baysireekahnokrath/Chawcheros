import LeadsNav, { FOOT_NOTE, LoadError } from '@/components/leads/LeadsNav';
import TodayCard from '@/components/leads/TodayCard';
import { daysSince, getToday } from '@/modules/leads/queries';

export const dynamic = 'force-dynamic';

const sec = 'mt-6 mb-2 flex flex-wrap items-baseline gap-2 font-semibold';
const empty = 'rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted';

/** หน้า "วันนี้" · ค้างตอบเกิน 1 ชั่วโมง · ถึงวันทักตาม · นัดพรุ่งนี้ที่ยังไม่ยืนยัน */
export default async function LeadsTodayPage() {
  const { data, error } = await getToday();
  const a = data.filter((l) => l.bucket === 'unanswered').sort((x, y) => (y.waiting_minutes ?? 0) - (x.waiting_minutes ?? 0));
  const b = data.filter((l) => l.bucket === 'followup');
  const c = data.filter((l) => l.bucket === 'appointment');

  return (
    <>
      <LeadsNav current="today" todayCount={error ? undefined : data.length} />
      {error && <LoadError message={error} />}

      <h2 className={sec}>วันนี้ต้องทำอะไร</h2>
      <div className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-4">
        <span className="text-4xl font-semibold leading-none tabular-nums">{data.length}</span>
        <p className="text-sm">
          {data.length
            ? 'เรื่องที่รออยู่ ทำจากบนลงล่าง เสร็จแล้วกดปุ่มในการ์ด รายการจะหายไปเอง'
            : 'ไม่มีงานค้างแล้ววันนี้'}
        </p>
      </div>

      <h2 className={sec}>
        ยังไม่ได้ตอบ เกิน 1 ชั่วโมง <span className="text-sm font-normal tabular-nums">{a.length} คน</span>
      </h2>
      {a.length === 0 && <div className={empty}>ตอบครบทุกคนแล้ว</div>}
      <div className="space-y-2.5">{a.map((l) => <TodayCard key={l.id} lead={l} quietDays={daysSince(l.last_contact_at)} />)}</div>

      <h2 className={sec}>
        ถึงวันทักตาม วันนี้ <span className="text-sm font-normal tabular-nums">{b.length} คน</span>
      </h2>
      {b.length === 0 && <div className={empty}>ไม่มีคนที่ต้องทักตามวันนี้</div>}
      <div className="space-y-2.5">{b.map((l) => <TodayCard key={l.id} lead={l} quietDays={daysSince(l.last_contact_at)} />)}</div>

      <h2 className={sec}>
        นัดมาโชว์รูม พรุ่งนี้ <span className="text-sm font-normal tabular-nums">{c.length} คน</span>
      </h2>
      {c.length === 0 && <div className={empty}>ไม่มีนัดพรุ่งนี้ที่ยังไม่ได้ยืนยัน</div>}
      <div className="space-y-2.5">{c.map((l) => <TodayCard key={l.id} lead={l} quietDays={daysSince(l.last_contact_at)} />)}</div>

      <p className="mt-8 text-xs text-muted">
        “เกิน 1 ชั่วโมง” นับจากเวลาที่ลูกค้าทักจนถึงตอนนี้ ยังไม่แยกเวลาทำการ · {FOOT_NOTE}
      </p>
    </>
  );
}
