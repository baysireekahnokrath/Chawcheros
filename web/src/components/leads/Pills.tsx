import type { Lead } from '@/modules/leads/constants';

const pill = 'inline-flex items-center whitespace-nowrap rounded-full border px-2.5 text-xs leading-[22px]';

export function ChannelTag({ channel }: { channel: string }) {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-border px-1.5 text-xs">
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" className="h-3 w-3" aria-hidden="true">
        <path d="M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2z" strokeLinejoin="round" />
      </svg>
      {channel}
    </span>
  );
}

export function HeatPill({ heat }: { heat: string }) {
  const tone =
    heat === 'ร้อน'
      ? 'border-accent bg-accent font-medium text-accent-fg'
      : heat === 'อุ่น'
        ? 'border-warn/50 bg-warn/15 font-medium text-warn'
        : 'border-border';
  return <span className={`${pill} ${tone}`}>{heat}</span>;
}

export function StagePill({ stage }: { stage: string }) {
  return <span className={`${pill} border-text font-medium`}>{stage}</span>;
}

/** ป้าย 4 ชุดของ 1 คน · เส้นประ = ระบบเสนอ รอคนยืนยัน หรือยังไม่ใส่ */
export function TagPills({ lead }: { lead: Lead }) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {lead.topic ? (
        <span className={`${pill} border-border ${lead.topic_suggested ? 'border-dashed' : ''}`}>{lead.topic}</span>
      ) : (
        <span className={`${pill} border-dashed border-border text-muted`}>เรื่อง ยังไม่ใส่</span>
      )}
      {lead.product ? (
        <span className={`${pill} border-border ${lead.product_suggested ? 'border-dashed' : ''}`}>{lead.product}</span>
      ) : (
        <span className={`${pill} border-dashed border-border text-muted`}>สินค้า ยังไม่ใส่</span>
      )}
      <HeatPill heat={lead.readiness} />
      <StagePill stage={lead.stage} />
    </span>
  );
}
