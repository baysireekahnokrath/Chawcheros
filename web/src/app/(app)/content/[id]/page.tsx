import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import {
  getItem, getPlacements, getChannels, canApprove, getImages, getItemModels,
  getBrands, getPillars, getThemes, getCampaigns, getModels, getTeam, isPhase1,
  getReviewNotes, getMessages, getVersions, markRead, getAgentQuestions,
} from '@/modules/content/queries';
import ItemDetail from '@/components/content/ItemDetail';
import LegacyItemDetail from '@/components/content/LegacyItemDetail';

export const metadata = { title: 'งานคอนเทนต์ · Chaw Cher OS' };

// agent เขียนทุกช่องทางใช้เวลา 30-90 วินาที (R3)
export const maxDuration = 300;

export default async function ContentItemPage({ params }: PageProps<'/content/[id]'>) {
  const { id } = await params;
  const item = await getItem(id);
  if (!item) notFound();

  const back = <Link href="/content" className="text-sm text-muted">← คอนเทนต์</Link>;

  // งานคลิปเดิม · ยังเปิดดูได้ แต่ไม่มีหน้าตั้งงานแบบนี้แล้ว (Q-04)
  if (!isPhase1(item.format)) {
    const [placements, channels, approver] = await Promise.all([getPlacements(id), getChannels(), canApprove()]);
    return (
      <>
        {back}
        <div className="mt-3">
          <LegacyItemDetail item={item} placements={placements} channels={channels} canApprove={approver} />
        </div>
      </>
    );
  }

  const supabase = await createClient();
  const [placements, images, models, brands, pillars, themes, campaigns, allModels, team, approver, notes, messages, versions, questions, { data: { user } }] = await Promise.all([
    getPlacements(id), getImages(id), getItemModels(id), getBrands(), getPillars(), getThemes(),
    getCampaigns(), getModels(), getTeam(), canApprove(), getReviewNotes(id), getMessages(id), getVersions(id), getAgentQuestions(id),
    supabase.auth.getUser(),
  ]);
  await markRead(id);
  const order = ['facebook', 'instagram', 'website'];
  placements.sort((a, b) => order.indexOf(a.channel_id) - order.indexOf(b.channel_id));

  return (
    <>
      {back}
      <div className="mt-3">
        <ItemDetail
          item={item}
          brandName={brands.find((b) => b.id === item.brand_id)?.name ?? ''}
          placements={placements}
          images={images}
          models={models}
          pillars={pillars}
          themes={themes}
          campaigns={campaigns}
          allModels={allModels}
          team={team}
          canApprove={approver}
          notes={notes}
          messages={messages}
          versions={versions}
          questions={questions}
          me={user?.id ?? null}
        />
      </div>
    </>
  );
}
