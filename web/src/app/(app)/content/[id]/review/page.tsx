import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import {
  getItem, getPlacements, getImages, getOpenParts, getMessages, getTeam, getBrands, canApprove, markRead,
  channelName, isPhase1,
} from '@/modules/content/queries';
import ReviewForm from '@/components/content/ReviewForm';
import ChatPanel from '@/components/content/ChatPanel';

export const metadata = { title: 'ตรวจคอนเทนต์ · Chaw Cher OS' };

// @AI ในแชทหน้านี้ให้ agent เขียน ใช้เวลาได้ถึง 90 วินาที
export const maxDuration = 300;

export default async function ReviewPage({ params }: PageProps<'/content/[id]/review'>) {
  const { id } = await params;
  const item = await getItem(id);
  if (!item || !isPhase1(item.format)) notFound();

  const supabase = await createClient();
  const [{ data: { user } }, placements, images, open, messages, team, brands, approver, { data: admin }] = await Promise.all([
    supabase.auth.getUser(), getPlacements(id), getImages(id), getOpenParts(id), getMessages(id), getTeam(), getBrands(), canApprove(),
    supabase.schema('core').from('user_capabilities').select('capability').eq('capability', 'admin').is('revoked_at', null).maybeSingle(),
  ]);
  await markRead(id);

  const me = user?.id ?? null;
  const own = !!me && (item.created_by === me || item.owner_id === me);
  let block: string | null = null;
  if (!approver) block = 'ตรวจได้เฉพาะคนที่มีสิทธิ์อนุมัติ';
  else if (item.stage !== 'รอตรวจ') block = `ตอนนี้อยู่ขั้น “${item.stage}” ยังไม่ได้ส่งตรวจ`;
  else if (own && !admin) block = 'ตรวจงานที่ตัวเองตั้งหรือเป็นคนทำไม่ได้';

  const order = ['facebook', 'instagram', 'website'];
  placements.sort((a, b) => order.indexOf(a.channel_id) - order.indexOf(b.channel_id));
  const parts = [
    ...images.map((_, i) => `ภาพ ${i + 1}`),
    ...placements.filter((p) => !p.skipped_reason).map((p) => channelName(p.channel_id)),
  ];

  return (
    <>
      <Link href={`/content/${id}`} className="text-sm text-muted">← ชิ้นงาน</Link>
      <div className="mt-2 mb-4">
        <p className="text-xs text-muted">
          ตรวจทีละส่วน · {brands.find((b) => b.id === item.brand_id)?.name} · {item.format} · v{item.version}
        </p>
        <h1 className="mt-0.5 text-xl font-semibold tracking-tight">{item.hook || item.title}</h1>
        {(item.key_message || item.visual) && (
          <p className="mt-1 text-sm text-muted">
            {item.key_message}{item.key_message && item.visual ? ' · ' : ''}{item.visual && `ภาพ: ${item.visual}`}
          </p>
        )}
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-start">
        <ReviewForm itemId={id} placements={placements} images={images} open={open}
          canReview={!block} blockReason={block} />
        <ChatPanel itemId={id} messages={messages} parts={parts} team={team} me={me} />
      </div>
    </>
  );
}
