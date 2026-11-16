import Link from 'next/link';
import LeadForm from '@/components/leads/LeadForm';
import LeadsNav, { FOOT_NOTE, LoadError } from '@/components/leads/LeadsNav';
import { ChannelTag, TagPills } from '@/components/leads/Pills';
import { CHANNELS, HEATS, STAGES, isOneOf } from '@/modules/leads/constants';
import { daysSince, getLeads } from '@/modules/leads/queries';

export const dynamic = 'force-dynamic';

const chip = (on: boolean) =>
  'inline-flex min-h-9 shrink-0 items-center whitespace-nowrap rounded-full border px-3 py-1 text-sm ' +
  (on ? 'border-accent bg-accent font-medium text-accent-fg' : 'border-border bg-surface');

/** หน้ารายการทั้งหมด · กรองตามขั้น ความพร้อม ช่องทาง · คนที่เงียบนานสุดอยู่บน */
export default async function LeadsListPage({ searchParams }: PageProps<'/leads/list'>) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (typeof v === 'string' ? v : undefined);
  const f = {
    stage: isOneOf(STAGES, one(sp.stage)) ? one(sp.stage) : undefined,
    heat: isOneOf(HEATS, one(sp.heat)) ? one(sp.heat) : undefined,
    channel: isOneOf(CHANNELS, one(sp.channel)) ? one(sp.channel) : undefined,
  };
  const { data, error } = await getLeads(f);
  const { rows, all } = data;
  const filtered = Boolean(f.stage || f.heat || f.channel);

  const href = (patch: Partial<typeof f>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...f, ...patch })) if (v) q.set(k, v);
    const s = q.toString();
    return s ? `/leads/list?${s}` : '/leads/list';
  };
  const days = (iso: string) => {
    const n = daysSince(iso);
    return n === 0 ? 'วันนี้' : `${n} วันก่อน`;
  };

  return (
    <>
      <LeadsNav current="list" />
      {error && <LoadError message={error} />}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">คนสนใจทั้งหมด</h2>
        <LeadForm />
      </div>
      <p className="mt-2 text-xs text-muted">
        LINE เข้ามาเองอัตโนมัติเมื่อต่อระบบรับแล้ว · Messenger และ Instagram พนักงานกด “บันทึกคนสนใจ” ครั้งเดียว
      </p>

      <div className="mt-3 text-xs text-muted">ขั้น</div>
      <div className="-mx-1 mt-1 flex gap-1.5 overflow-x-auto p-1">
        <Link href={href({ stage: undefined })} className={chip(!f.stage)}>
          ทั้งหมด <span className="ml-1 tabular-nums">{all.length}</span>
        </Link>
        {STAGES.map((s) => (
          <Link key={s} href={href({ stage: s })} className={chip(f.stage === s)}>
            {s} <span className="ml-1 tabular-nums">{all.filter((l) => l.stage === s).length}</span>
          </Link>
        ))}
      </div>
      <div className="mt-2 text-xs text-muted">ความพร้อม</div>
      <div className="-mx-1 mt-1 flex gap-1.5 overflow-x-auto p-1">
        <Link href={href({ heat: undefined })} className={chip(!f.heat)}>ทั้งหมด</Link>
        {HEATS.map((s) => (
          <Link key={s} href={href({ heat: s })} className={chip(f.heat === s)}>{s}</Link>
        ))}
      </div>
      <div className="mt-2 text-xs text-muted">ช่องทาง</div>
      <div className="-mx-1 mt-1 flex gap-1.5 overflow-x-auto p-1">
        <Link href={href({ channel: undefined })} className={chip(!f.channel)}>ทั้งหมด</Link>
        {CHANNELS.map((s) => (
          <Link key={s} href={href({ channel: s })} className={chip(f.channel === s)}>{s}</Link>
        ))}
      </div>

      <p className="mt-3 mb-2 text-xs text-muted">
        แสดง <b className="tabular-nums">{rows.length}</b> จาก <span className="tabular-nums">{all.length}</span> คน · คนที่เงียบนานสุดอยู่บน
        {filtered && (
          <>
            {' · '}
            <Link href="/leads/list" className="underline underline-offset-2">ล้างตัวกรอง</Link>
          </>
        )}
      </p>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted">
          {all.length === 0 ? 'ยังไม่มีคนสนใจในระบบ กด “+ บันทึกคนสนใจ” เพื่อเพิ่มคนแรก' : 'ไม่มีคนที่ตรงกับตัวกรองนี้'}
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((l) => (
            <li key={l.id}>
              <Link href={`/leads/${l.id}`} className={'block rounded-2xl border bg-surface px-4 py-3 hover:border-accent ' + (l.counted ? 'border-border' : 'border-dashed border-border opacity-60')}>
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{l.display_name}</span>
                  <ChannelTag channel={l.channel} />
                  {!l.counted && <span className="text-xs text-muted">ไม่นับ</span>}
                  <span className="ml-auto whitespace-nowrap text-xs text-muted">ติดต่อล่าสุด {days(l.last_contact_at)}</span>
                </span>
                <span className="my-1 block truncate text-sm">
                  {l.last_message ? `“${l.last_message}”` : <span className="text-muted">ยังไม่ได้จดว่าถามอะไร</span>}
                </span>
                <TagPills lead={l} />
              </Link>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-8 text-xs text-muted">{FOOT_NOTE}</p>
    </>
  );
}
