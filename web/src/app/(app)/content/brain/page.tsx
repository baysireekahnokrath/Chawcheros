import Link from 'next/link';
import {
  getBrands, getBrandSections, getNotebook, getPlaybooks, getInterviewTurns, getAiBudget, getAiRequests,
  getTeam, isAdmin,
} from '@/modules/content/queries';
import Brain from '@/components/content/Brain';

export const metadata = { title: 'สมอง agent · Chaw Cher OS' };

// สัมภาษณ์ brand model เรียก AI ทีละจังหวะ
export const maxDuration = 300;

const TABS = [
  { id: 'model', name: 'Brand model' },
  { id: 'book', name: 'Brand book' },
  { id: 'notebook', name: 'สมุดความคิด' },
  { id: 'playbook', name: 'คู่มือแพลตฟอร์ม' },
  { id: 'ai', name: 'งบ AI' },
] as const;

export default async function BrainPage({ searchParams }: PageProps<'/content/brain'>) {
  const sp = await searchParams;
  const brands = await getBrands();
  const brandId = typeof sp.brand === 'string' && brands.some((b) => b.id === sp.brand) ? sp.brand : brands[0]?.id ?? '';
  const tab = TABS.find((t) => t.id === sp.tab)?.id ?? 'model';

  const [sections, notebook, playbooks, budget, requests, team, admin] = await Promise.all([
    getBrandSections(brandId), getNotebook(), getPlaybooks(brandId), getAiBudget(), getAiRequests(40), getTeam(), isAdmin(),
  ]);
  const turns = await getInterviewTurns(sections.map((s) => s.id));
  const pending = notebook.filter((n) => n.status === 'รอยืนยัน').length;
  const q = (patch: Record<string, string>) => `/content/brain?${new URLSearchParams({ brand: brandId, tab, ...patch })}`;

  return (
    <>
      <Link href="/content" className="text-sm text-muted">← คอนเทนต์</Link>
      <h1 className="mt-3 text-xl font-semibold tracking-tight">สมอง agent</h1>
      <p className="mt-1 text-sm text-muted">
        agent อ่านทุกอย่างในหน้านี้ทุกครั้งที่เขียน · ใช้เฉพาะข้อที่ Bay ยืนยันแล้ว{admin ? '' : ' · แก้ได้เฉพาะ Bay'}
      </p>

      {tab !== 'notebook' && tab !== 'ai' && brands.length > 1 && (
        <nav className="mt-4 flex flex-wrap gap-2" aria-label="แบรนด์">
          {brands.map((b) => (
            <Link key={b.id} href={q({ brand: b.id })}
              className={'rounded-full border px-3 py-1.5 text-sm ' + (b.id === brandId ? 'border-accent bg-accent text-accent-fg' : 'border-border')}>
              {b.name}
            </Link>
          ))}
        </nav>
      )}

      <nav className="mt-4 flex gap-1 overflow-x-auto border-b border-border" aria-label="หมวด">
        {TABS.map((t) => (
          <Link key={t.id} href={q({ tab: t.id })}
            className={'whitespace-nowrap border-b-2 px-3 py-2 text-sm ' + (t.id === tab ? 'border-accent font-semibold' : 'border-transparent text-muted')}>
            {t.name}{t.id === 'notebook' && pending ? ` · รอยืนยัน ${pending}` : ''}
          </Link>
        ))}
      </nav>

      <div className="mt-4">
        <Brain tab={tab} brandId={brandId} brands={brands} sections={sections} turns={turns} notebook={notebook}
          playbooks={playbooks} budget={budget} requests={requests} team={team} admin={admin} />
      </div>
    </>
  );
}
