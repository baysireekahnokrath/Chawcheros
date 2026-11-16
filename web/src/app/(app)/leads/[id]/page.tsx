import Link from 'next/link';
import { notFound } from 'next/navigation';
import LeadDetail from '@/components/leads/LeadDetail';
import { FOOT_NOTE } from '@/components/leads/LeadsNav';
import { ChannelTag, StagePill } from '@/components/leads/Pills';
import { isOpen } from '@/modules/leads/constants';
import { daysSince, getLead } from '@/modules/leads/queries';

export const dynamic = 'force-dynamic';

const when = (iso: string) =>
  new Intl.DateTimeFormat('th-TH', {
    timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(iso));

/** หน้ารายละเอียดของ 1 คน */
export default async function LeadPage({ params, searchParams }: PageProps<'/leads/[id]'>) {
  const { id } = await params;
  const { out } = await searchParams;
  const found = await getLead(id);
  if (!found) notFound();
  const { lead, events } = found;
  const days = daysSince(lead.last_contact_at);
  // ข้อมูลจากเซิร์ฟเวอร์เปลี่ยน = วาดฟอร์มใหม่ ช่องวันที่จะได้ไม่ค้างค่าเก่า
  const sig = [lead.stage, lead.next_action_on, lead.next_action_note, lead.appointment_on, lead.appointment_time, lead.need_by].join('|');

  return (
    <>
      <Link href="/leads/list" className="text-sm text-muted">← คนสนใจทั้งหมด</Link>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-semibold tracking-tight">{lead.display_name}</h1>
        <ChannelTag channel={lead.channel} />
        <StagePill stage={lead.stage} />
        {!lead.counted && <span className="text-xs text-muted">ไม่นับ</span>}
      </div>
      <p className="mt-1 text-xs text-muted">
        ติดต่อล่าสุด {days === 0 ? 'วันนี้' : `${days} วันก่อน`} · ข้อความล่าสุดที่จดไว้
        {isOpen(lead.stage) && lead.next_action_on && ` · ทำต่อ ${lead.next_action_on}${lead.next_action_note ? ' ' + lead.next_action_note : ''}`}
      </p>
      <p className="mt-1 break-words text-sm">{lead.last_message ? `“${lead.last_message}”` : 'ยังไม่ได้จด'}</p>

      <LeadDetail key={sig} lead={lead} initialOut={out === 'lost' ? 'lost' : out === 'buy' ? 'buy' : null} />

      <div className="mt-3 rounded-2xl border border-border bg-surface p-4">
        <h3 className="mb-2 text-sm font-semibold">ประวัติ</h3>
        <ul className="text-xs">
          {events.map((e) => (
            <li key={e.id} className="flex gap-3 border-t border-border py-1.5 first:border-t-0">
              <span className="w-28 shrink-0 tabular-nums text-muted">{when(e.created_at)}</span>
              <span>{e.note}</span>
            </li>
          ))}
          {events.length === 0 && <li className="text-muted">ยังไม่มีประวัติ</li>}
        </ul>
      </div>

      <p className="mt-8 text-xs text-muted">{FOOT_NOTE}</p>
    </>
  );
}
