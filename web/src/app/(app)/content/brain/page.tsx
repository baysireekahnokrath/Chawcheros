import Link from 'next/link';
import {
  getBrands, getBrandSections, getNotebook, getPlaybooks, getInterviewTurns, getAiBudget, getAiRequests,
  getTeam, isAdmin, getBrandKit, getBrandExamples, getAgentRoutes, getArchive, getCampaigns, getPillars, getThemes, getModels,
} from '@/modules/content/queries';
import Brain from '@/components/content/Brain';
import { KitTab, RoutesTab, ArchiveTab } from '@/components/content/BrandKit';

export const metadata = { title: 'แบรนด์ · Chaw Cher OS' };

// สัมภาษณ์ brand model เรียก AI ทีละจังหวะ
export const maxDuration = 300;

const TABS = [
  { id: 'kit', name: 'Brand Kit' },
  { id: 'model', name: 'Brand model' },
  { id: 'book', name: 'Brand book' },
  { id: 'notebook', name: 'สมุดความคิด' },
  { id: 'playbook', name: 'คู่มือแพลตฟอร์ม' },
  { id: 'archive', name: 'คลังงาน' },
  { id: 'routes', name: 'เส้นทาง agent' },
  { id: 'ai', name: 'งบ AI' },
] as const;
const PER_BRAND = ['kit', 'model', 'book', 'playbook', 'archive'];

export default async function BrainPage({ searchParams }: PageProps<'/content/brain'>) {
  const sp = await searchParams;
  const brands = await getBrands();
  const brandId = typeof sp.brand === 'string' && brands.some((b) => b.id === sp.brand) ? sp.brand : brands[0]?.id ?? '';
  const tab = TABS.find((t) => t.id === sp.tab)?.id ?? 'model';

  const [sections, notebook, playbooks, budget, requests, team, admin] = await Promise.all([
    getBrandSections(brandId), getNotebook(), getPlaybooks(brandId), getAiBudget(), getAiRequests(40), getTeam(), isAdmin(),
  ]);
  const turns = await getInterviewTurns(sections.map((s) => s.id));
  const [kit, examples, routes, archive, campaigns, pillars, themes, models] = await Promise.all([
    tab === 'kit' ? getBrandKit(brandId) : null,
    tab === 'kit' ? getBrandExamples(brandId) : [],
    tab === 'routes' ? getAgentRoutes() : [],
    tab === 'kit' || tab === 'archive' ? getArchive(brandId) : [],
    tab === 'kit' || tab === 'archive' ? getCampaigns() : [],
    tab === 'archive' ? getPillars() : [],
    tab === 'archive' ? getThemes() : [],
    tab === 'archive' ? getModels() : [],
  ]);
  const voice = sections.find((x) => x.kind === 'model' && x.topic === 'น้ำเสียง' && x.confirmed_at)?.body ?? null;
  const pending = notebook.filter((n) => n.status === 'รอยืนยัน').length;
  const q = (patch: Record<string, string>) => `/content/brain?${new URLSearchParams({ brand: brandId, tab, ...patch })}`;

  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight">แบรนด์</h1>
      <p className="mt-1 text-sm text-muted">
        agent อ่านทุกอย่างในหน้านี้ทุกครั้งที่เขียน · ใช้เฉพาะข้อที่ Bay ยืนยันแล้ว{admin ? '' : ' · แก้ได้เฉพาะ Bay'}
      </p>

      {PER_BRAND.includes(tab) && brands.length > 1 && (
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
        {tab === 'kit' ? (
          <KitTab brandId={brandId} kit={kit} voice={voice} examples={examples} picks={archive} campaigns={campaigns} admin={admin} />
        ) : tab === 'routes' ? (
          <RoutesTab routes={routes} admin={admin} />
        ) : tab === 'archive' ? (
          <ArchiveTab items={archive} pillars={pillars.filter((x) => x.brand_id === brandId)} themes={themes.filter((x) => x.brand_id === brandId)}
            campaigns={campaigns} models={models.filter((x) => x.brand_id === brandId)} />
        ) : (
          <Brain tab={tab} brandId={brandId} brands={brands} sections={sections} turns={turns} notebook={notebook}
            playbooks={playbooks} budget={budget} requests={requests} team={team} admin={admin} />
        )}
      </div>
    </>
  );
}
