import { createClient } from '@/lib/supabase/server';
import ContentNav from '@/components/content/ContentNav';

export default async function ContentLayout({ children }: LayoutProps<'/content'>) {
  const supabase = await createClient();
  const { count } = await supabase.schema('content').from('items')
    .select('id', { count: 'exact', head: true }).eq('stage', 'รอตรวจ');
  return (
    <div className="pb-20 lg:pb-0">
      <ContentNav reviewCount={count ?? 0} />
      {children}
    </div>
  );
}
