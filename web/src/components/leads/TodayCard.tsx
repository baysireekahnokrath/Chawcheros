'use client';

import Link from 'next/link';
import { markFollowupSent, markReplied } from '@/modules/leads/actions';
import type { TodayLead } from '@/modules/leads/constants';
import { DRAFT_LABEL, draftKindFor, draftText, hhmm } from '@/modules/leads/drafts';
import DraftBox from './DraftBox';
import { ChannelTag, HeatPill } from './Pills';
import { btn, btnGhost, useRun } from './useRun';

function waitLabel(m: number) {
  const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), r = m % 60;
  return [d ? `${d} วัน` : '', h ? `${h} ชม.` : '', !d && r ? `${r} นาที` : ''].filter(Boolean).join(' ') || 'ไม่ถึง 1 นาที';
}

/** การ์ด 1 ใบในหน้า "วันนี้" · เสร็จแล้วกดปุ่ม รายการจะหายไปเอง */
export default function TodayCard({ lead, quietDays }: { lead: TodayLead; quietDays: number }) {
  const { pending, error, run } = useRun();
  const open = (
    <Link href={`/leads/${lead.id}`} className={btnGhost}>
      เปิดดู
    </Link>
  );
  const head = (
    <div className="flex flex-wrap items-center gap-2">
      <span className="font-medium">{lead.display_name}</span>
      <ChannelTag channel={lead.channel} />
      {lead.bucket !== 'unanswered' && <HeatPill heat={lead.readiness} />}
    </div>
  );
  const err = error && <p className="mt-2 text-sm text-danger" role="alert">{error}</p>;
  const card = 'rounded-2xl border border-border bg-surface p-4';

  if (lead.bucket === 'unanswered') {
    // ขั้น "ใหม่" = ยังไม่เคยตอบ ใช้ร่างคำตอบแรก · ขั้นอื่น = ลูกค้าทักเข้ามาอีก พนักงานตอบเองตามเรื่อง
    const first = lead.stage === 'ใหม่';
    return (
      <article className={card}>
        {head}
        {lead.last_message && <p className="mt-1 break-words text-sm">“{lead.last_message}”</p>}
        <p className="mt-1 text-xs text-muted">
          รอมาแล้ว <b className="tabular-nums">{waitLabel(lead.waiting_minutes ?? 0)}</b> · ไปตอบในแชท {lead.channel} แล้วกลับมากด “ตอบแล้ว”
          {!first && ` · ขั้นตอนนี้ ${lead.stage}`}
        </p>
        {first && <DraftBox label={DRAFT_LABEL.first} text={draftText(lead, 'first')} />}
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" disabled={pending} onClick={() => run(() => markReplied(lead.id))} className={btn + ' flex-1'}>
            {pending ? 'กำลังบันทึก…' : 'ตอบแล้ว'}
          </button>
          {open}
        </div>
        {err}
      </article>
    );
  }

  if (lead.bucket === 'appointment') {
    return (
      <article className={card}>
        {head}
        <p className="mt-1 text-xs text-muted">
          นัดพรุ่งนี้{lead.appointment_time && <b className="tabular-nums"> {hhmm(lead.appointment_time)} น.</b>} · ส่งข้อความยืนยันวันนี้ ลูกค้าจะไม่ลืมนัด
        </p>
        <DraftBox label={DRAFT_LABEL.confirm} text={draftText(lead, 'confirm')} primary />
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" disabled={pending} onClick={() => run(() => markFollowupSent(lead.id))} className={btnGhost + ' flex-1'}>
            {pending ? 'กำลังบันทึก…' : 'ส่งแล้ว'}
          </button>
          {open}
        </div>
        {err}
      </article>
    );
  }

  // ถึงวันทำต่อ
  const kind = draftKindFor(lead);
  const hasDraft = lead.stage === 'ตอบแล้ว' || lead.stage === 'เสนอราคาแล้ว' || lead.stage === 'นัดแล้ว';
  return (
    <article className={card}>
      {head}
      <p className="mt-1 text-xs text-muted">
        {lead.next_action_note || 'ถึงวันทำต่อ'} · ขั้น {lead.stage} · เงียบมา <span className="tabular-nums">{quietDays}</span> วัน
      </p>
      {lead.followup_count >= 2 && lead.stage !== 'นัดแล้ว' ? (
        <>
          <p className="mt-1 text-sm">
            ทักตามไปแล้ว <b className="tabular-nums">{lead.followup_count} ครั้ง</b> ยังไม่ตอบ · ระบบเสนอให้ปิดเป็น “หาย” (ต้องเลือกเหตุผล)
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href={`/leads/${lead.id}?out=lost#outcome`} className={btn + ' flex-1'}>
              ปิดเป็นหาย
            </Link>
            <Link href={`/leads/${lead.id}`} className={btnGhost + ' flex-1'}>
              เปิดดูก่อน
            </Link>
          </div>
        </>
      ) : hasDraft ? (
        <>
          <DraftBox label={DRAFT_LABEL[kind]} text={draftText(lead, kind)} primary />
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" disabled={pending} onClick={() => run(() => markFollowupSent(lead.id))} className={btnGhost + ' flex-1'}>
              {pending ? 'กำลังบันทึก…' : 'ส่งแล้ว'}
            </button>
            {open}
          </div>
        </>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href={`/leads/${lead.id}`} className={btn + ' flex-1'}>
            เปิดดู แล้วบันทึกผล
          </Link>
        </div>
      )}
      {err}
    </article>
  );
}
