import Link from 'next/link';
import {
  getBrands, getPillars, getThemes, getCampaigns, getModels, getTeam, canApprove, isAdmin, getPlan, getThemeWeeks,
} from '@/modules/content/queries';
import { todayBangkok } from '@/modules/content/dashboard';
import { createClient } from '@/lib/supabase/server';
import PlanEditor from '@/components/content/PlanEditor';

export const metadata = { title: 'แผนเดือน · Chaw Cher OS' };

// agent ร่างแผน / เขียนทีละชิ้น เรียก AI จากหน้านี้
export const maxDuration = 300;

const MON = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const shift = (month: string, n: number) => {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 10);
};

/** แผนเดือน (R6) · เปิดมาเป็นเดือนหน้า เพราะต้องส่งล่วงหน้า 20 วัน */
export default async function PlanPage({ searchParams }: PageProps<'/content/plan'>) {
  const sp = await searchParams;
  const today = todayBangkok();
  const month = typeof sp.month === 'string' && /^\d{4}-\d{2}-01$/.test(sp.month) ? sp.month : shift(today.slice(0, 8) + '01', 1);
  const brands = await getBrands();
  const brandId = typeof sp.brand === 'string' && brands.some((b) => b.id === sp.brand)
    ? sp.brand : brands[0]?.id ?? '';

  const supabase = await createClient();
  const [data, pillars, themes, campaigns, models, team, approver, admin, { data: caps }] = await Promise.all([
    getPlan(brandId, month), getPillars(), getThemes(), getCampaigns(), getModels(), getTeam(), canApprove(), isAdmin(),
    supabase.schema('core').from('user_capabilities').select('capability').eq('capability', 'marketing.write').is('revoked_at', null),
  ]);
  const myThemes = themes.filter((t) => t.brand_id === brandId && t.active);
  const weeks = await getThemeWeeks(myThemes.map((t) => t.id));
  const [y, m] = month.split('-').map(Number);
  const q = (patch: Record<string, string>) => `/content/plan?${new URLSearchParams({ brand: brandId, month, ...patch })}`;

  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight">แผนเดือน</h1>
      <p className="mt-1 text-sm text-muted">การตลาดร่าง → ส่งให้ Bay → อนุมัติทั้งแผน = การ์ดไอเดียในปฏิทิน</p>

      {brands.length > 1 && (
        <nav className="mt-3 flex flex-wrap gap-2" aria-label="แบรนด์">
          {brands.map((b) => (
            <Link key={b.id} href={q({ brand: b.id })}
              className={'rounded-full border px-3 py-1.5 text-sm ' + (b.id === brandId ? 'border-accent bg-accent text-accent-fg' : 'border-border')}>{b.name}</Link>
          ))}
        </nav>
      )}

      <div className="mt-3 flex items-center gap-2">
        <Link href={q({ month: shift(month, -1) })} aria-label="เดือนก่อน" className="grid h-9 w-9 place-items-center rounded-xl border border-border bg-surface">‹</Link>
        <Link href={q({ month: shift(month, 1) })} aria-label="เดือนถัดไป" className="grid h-9 w-9 place-items-center rounded-xl border border-border bg-surface">›</Link>
        <h2 className="text-lg font-semibold">{MON[m - 1]} {y + 543}</h2>
      </div>

      <div className="mt-4">
        <PlanEditor brandId={brandId} month={month} today={today} plan={data.plan} slots={data.slots} changes={data.changes}
          pillars={pillars.filter((x) => x.brand_id === brandId)} themes={myThemes} weeks={weeks} campaigns={campaigns}
          models={models.filter((x) => x.brand_id === brandId)} team={team}
          canApprove={approver || admin} canWrite={admin || (caps ?? []).length > 0} />
      </div>
    </>
  );
}
