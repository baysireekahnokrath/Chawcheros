import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getItem, getPlacements, getChannels, canApprove } from '@/modules/content/queries';
import ItemDetail from '@/components/content/ItemDetail';

export const metadata = { title: 'งานคอนเทนต์ · Chaw Cher OS' };

export default async function ContentItemPage({ params }: PageProps<'/content/[id]'>) {
  const { id } = await params;
  const item = await getItem(id);
  if (!item) notFound();

  const [placements, channels, approver] = await Promise.all([
    getPlacements(id),
    getChannels(),
    canApprove(),
  ]);

  return (
    <>
      <Link href="/content" className="text-sm text-muted">← คอนเทนต์</Link>
      <div className="mt-3">
        <ItemDetail item={item} placements={placements} channels={channels} canApprove={approver} />
      </div>
    </>
  );
}
