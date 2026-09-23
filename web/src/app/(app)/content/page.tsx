import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getBrands, getGaps, canApprove, isAdmin, getModels, getOpenPlans, getPlan } from '@/modules/content/queries';
import { getDashboard } from '@/modules/content/dashboard';
import { channelShort, TONE, planDeadline } from '@/modules/content/types';
import NewMenu from '@/components/content/NewMenu';
import { AsksBox, NotebookBox, SwipeBox, IdeasBox } from '@/components/content/HomeBoxes';

export const metadata = { title: 'คอนเทนต์ · Chaw Cher OS' };

// กล่องตอบคำถาม agent / สรุปคู่แข่ง / คิดไอเดีย เรียก AI จากหน้านี้
export const maxDuration = 300;

const WD = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
const MON_S = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const dayLabel = (s: string) => { const [y, m, d] = s.split('-').map(Number); const t = new Date(y, m - 1, d); return `${WD[t.getDay()]} ${d} ${MON_S[m - 1]}`; };
const ago = (iso: string | null) => {
  if (!iso) return '';
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 36e5);
  return h < 1 ? 'เพิ่งส่ง' : h < 24 ? `รอ ${h} ชม.` : `รอ ${Math.floor(h / 24)} วัน`;
};
const panel = 'rounded-2xl border border-border bg-surface p-4';

/**
 * หน้าแรกคอนเทนต์ (R5 · Q-123–125)
 * Bay / คนอนุมัติ: รอตรวจ · agent ถาม · @ถึงฉัน · สมุด · แผนเดือน → 7 วัน · ลงไม่ครบ → pillar · สินค้า → คู่แข่ง · ไอเดีย
 * การตลาด: ตีกลับ · @ถึงฉัน · งานที่ทำอยู่ แทนกล่องของ Bay (Q-125)
 */
export default async function ContentHome({ searchParams }: PageProps<'/content'>) {
  const { brand } = await searchParams;
  const b = typeof brand === 'string' ? brand : '';
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [d, brands, gaps, approver, admin, models] = await Promise.all([
    getDashboard(user?.id ?? '', b || null), getBrands(), getGaps(), canApprove(), isAdmin(), getModels(),
  ]);
  const boss = approver || admin;
  // แผนเดือน (H4 · Q-125) · Bay เห็นแผนที่รออนุมัติ · การตลาดเห็นแผนเดือนหน้าที่ต้องส่ง
  const nextMonth = (() => { const [y, m] = d.today.split('-').map(Number); return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`; })();
  const openPlans = await getOpenPlans();
  const brandName = (id: string) => brands.find((x) => x.id === id)?.name ?? '';
  const planBrands = b ? brands.filter((x) => x.id === b) : brands;
  const nextPlans = await Promise.all(planBrands.map(async (x) => ({ brand: x, ...(await getPlan(x.id, nextMonth)) })));
  const productName = Object.fromEntries(models.map((m) => [m.id, `${m.collection}${m.name_th ? ` ${m.name_th}` : ''}`]));
  const maxShare = Math.max(1, ...d.share.flatMap((s) => [s.now, s.prev]));
  const unreadMentions = d.mentions.filter((m) => m.unread);

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">หน้าแรก</h1>
          <p className="mt-1 text-sm text-muted">{boss ? 'เรื่องที่ต้องทำ · งานเดินไหม · สมดุลคอนเทนต์' : 'งานของฉัน'}</p>
        </div>
        <Link href="/content/settings" className="shrink-0 rounded-xl border border-border px-3 py-2.5 text-sm">ตั้งค่า</Link>
      </div>

      {brands.length > 1 && (
        <nav className="mt-3 flex flex-wrap gap-2" aria-label="แบรนด์">
          <Link href="/content" className={'rounded-full border px-3 py-1.5 text-sm ' + (!b ? 'border-accent bg-accent text-accent-fg' : 'border-border')}>ทุกแบรนด์</Link>
          {brands.map((x) => (
            <Link key={x.id} href={`/content?brand=${x.id}`}
              className={'rounded-full border px-3 py-1.5 text-sm ' + (b === x.id ? 'border-accent bg-accent text-accent-fg' : 'border-border')}>{x.name}</Link>
          ))}
        </nav>
      )}

      {/* ── แถวบน: สิ่งที่ต้องทำ (Q-124) ── */}
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {boss && (
          <section className={panel + (d.waiting.length ? ' border-locked/40' : '')}>
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-sm font-medium">รอพี่ตรวจ · {d.waiting.length}</h2>
              {d.waiting.length > 0 && <Link href="/content/review" className="text-xs text-muted underline">ดูทั้งหมด</Link>}
            </div>
            {d.waiting.length === 0 ? <p className="mt-2 text-sm text-muted">ไม่มีงานรอตรวจ</p> : (
              <ul className="mt-2 divide-y divide-border">
                {d.waiting.slice(0, 4).map((w) => (
                  <li key={w.id} className="flex items-center justify-between gap-2 py-2">
                    <div className="min-w-0 text-sm">
                      <p className="truncate font-medium">{w.hook || w.title}</p>
                      <p className="text-xs text-muted">{ago(w.submitted_at)}{w.next_on ? ` · ลง ${dayLabel(w.next_on)}` : ''}</p>
                    </div>
                    <Link href={`/content/${w.id}/review`} className="shrink-0 rounded-xl bg-accent px-3 py-1.5 text-sm font-medium text-accent-fg">ตรวจ</Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {!boss && (
          <section className={panel + (d.bounced.length ? ' border-danger/40' : '')}>
            <h2 className="text-sm font-medium">ถูกตีกลับ ต้องแก้ · {d.bounced.length}</h2>
            {d.bounced.length === 0 ? <p className="mt-2 text-sm text-muted">ไม่มีงานตีกลับ</p> : (
              <ul className="mt-2 space-y-1.5">
                {d.bounced.map((i) => <li key={i.id}><Link href={`/content/${i.id}`} className="text-sm underline">{i.hook || i.title}</Link></li>)}
              </ul>
            )}
          </section>
        )}

        <AsksBox asks={d.asks} canAnswer={boss} />

        <section className={panel + (unreadMentions.length ? ' border-danger/40' : '')}>
          <h2 className="text-sm font-medium">ข้อความ @ถึงฉัน{unreadMentions.length ? ` · ใหม่ ${unreadMentions.length}` : ''}</h2>
          {d.mentions.length === 0 ? <p className="mt-2 text-sm text-muted">ยังไม่มีใคร @ ถึงคุณ</p> : (
            <ul className="mt-2 divide-y divide-border">
              {d.mentions.slice(0, 5).map((m) => (
                <li key={m.id} className="py-2">
                  <Link href={`/content/${m.item_id}`} className="block text-sm">
                    <span className="text-xs text-muted">{m.unread && <b className="mr-1 text-danger">●</b>}{m.item}</span>
                    <span className="line-clamp-2">{m.body}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {boss && <NotebookBox notes={d.notebook} isAdmin={admin} />}

        <section className={panel + (boss && openPlans.some((x) => x.status === 'รออนุมัติ') ? ' border-locked/40' : '')}>
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-sm font-medium">{boss ? 'แผนเดือน' : 'แผนเดือนที่ต้องส่ง'}</h2>
            <Link href="/content/plan" className="text-xs text-muted underline">หน้าแผน</Link>
          </div>
          {boss && openPlans.filter((x) => x.status === 'รออนุมัติ').map((x) => (
            <Link key={x.id} href={`/content/plan?brand=${x.brand_id}&month=${x.month}`}
              className="mt-2 flex items-center justify-between gap-2 rounded-xl border border-locked/40 bg-locked/5 px-3 py-2 text-sm">
              <span>รออนุมัติ · {brandName(x.brand_id)} · {x.month.slice(0, 7)}</span>
              <span className="shrink-0 rounded-lg bg-accent px-2.5 py-1 text-xs font-medium text-accent-fg">ดูแผน</span>
            </Link>
          ))}
          <ul className="mt-2 space-y-1 text-sm">
            {nextPlans.map((x) => (
              <li key={x.brand.id} className="flex items-baseline justify-between gap-2">
                <Link href={`/content/plan?brand=${x.brand.id}&month=${nextMonth}`} className="underline">{x.brand.name} · เดือนหน้า</Link>
                <span className="text-xs text-muted">
                  {x.plan ? `${x.plan.status} · ${x.slots.length} ชิ้น` : 'ยังไม่เริ่ม'}
                  {(!x.plan || ['ร่าง', 'ตีกลับ'].includes(x.plan.status)) && ` · ส่งภายใน ${planDeadline(nextMonth).slice(5).split('-').reverse().join('/')}`}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {!boss && (
          <section className={panel}>
            <h2 className="text-sm font-medium">งานที่ทำอยู่ · {d.doing.length}</h2>
            {d.doing.length === 0 ? <p className="mt-2 text-sm text-muted">ไม่มี</p> : (
              <ul className="mt-2 space-y-1.5">
                {d.doing.map((i) => (
                  <li key={i.id} className="flex items-center gap-2 text-sm">
                    <span className={`rounded-md px-1.5 text-xs ${TONE[i.stage] ?? ''}`}>{i.stage}</span>
                    <Link href={`/content/${i.id}`} className="truncate underline">{i.hook || i.title}</Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>

      {/* ── งานเดินอยู่ไหม ── */}
      <h2 className="mb-2 mt-6 text-xs font-medium uppercase tracking-wide text-muted">งานเดินอยู่ไหม</h2>
      <div className="grid gap-3 lg:grid-cols-2">
        <section className={panel}>
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-sm font-medium">7 วันข้างหน้า</h2>
            <Link href="/content/calendar" className="text-xs text-muted underline">ปฏิทิน</Link>
          </div>
          <ul className="mt-2 space-y-2">
            {d.week.map((day) => (
              <li key={day.date} className="grid grid-cols-[72px_1fr] gap-2 text-sm">
                <span className={'text-xs ' + (day.date === d.today ? 'font-semibold text-accent' : 'text-muted')}>{dayLabel(day.date)}</span>
                <div className="min-w-0 space-y-1">
                  {day.items.length === 0 && <span className="text-xs text-muted">—</span>}
                  {day.items.map((i) => (
                    <Link key={i.id} href={`/content/${i.id}`}
                      className={'flex items-center gap-1.5 rounded-lg px-1.5 py-0.5 ' + (i.risk ? 'bg-danger/10 text-danger' : '')}>
                      <span className="truncate">{i.hook || i.title}</span>
                      <span className="shrink-0 text-[10.5px] font-bold">{i.channels.map(channelShort).join(' ')}</span>
                      {i.risk && <span className="shrink-0 text-[11px]">· ยังไม่ผ่าน</span>}
                    </Link>
                  ))}
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">สีแดง = อีก ≤ 2 วันจะลงแต่ยังไม่ผ่านตรวจ</p>
        </section>

        <section className={panel + (gaps.length ? ' border-warn/40' : '')}>
          <h2 className="text-sm font-medium">อนุมัติแล้วแต่ลงไม่ครบ · {gaps.length}</h2>
          {gaps.length === 0 ? <p className="mt-2 text-sm text-muted">ลงครบทุกชิ้น</p> : (
            <ul className="mt-2 space-y-2">
              {gaps.map((g) => (
                <li key={g.item_id}>
                  <Link href={`/content/${g.item_id}`} className="block text-sm">
                    <span className="font-medium">{g.เรื่อง}</span>
                    <span className="block text-xs text-muted">ลงแล้ว {g.ลงแล้ว} จาก {g.ตั้งใจลงกี่ที่} · ยังขาด <span className="text-warn">{g.ที่ยังขาด}</span></span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* ── สมดุลคอนเทนต์ ── */}
      <h2 className="mb-2 mt-6 text-xs font-medium uppercase tracking-wide text-muted">สมดุลคอนเทนต์</h2>
      <div className="grid gap-3 lg:grid-cols-2">
        <section className={panel}>
          <h2 className="text-sm font-medium">สัดส่วน pillar เดือนนี้</h2>
          <p className="text-xs text-muted">นับชิ้นงานตามวันลง · แท่งจาง = เดือนก่อน</p>
          {d.share.every((s) => !s.now && !s.prev) ? <p className="mt-2 text-sm text-muted">ยังไม่มีชิ้นงานที่มีวันลงในสองเดือนนี้</p> : (
            <ul className="mt-3 space-y-2.5">
              {d.share.map((s) => (
                <li key={s.id || 'none'} className="text-sm">
                  <div className="flex items-baseline justify-between gap-2">
                    <span>{s.name}</span>
                    <span className="tabular-nums text-muted">{s.now} <span className="text-xs">(เดือนก่อน {s.prev})</span></span>
                  </div>
                  <div className="mt-1 space-y-0.5">
                    <div className="h-2 rounded-full" style={{ width: `${(s.now / maxShare) * 100}%`, minWidth: s.now ? 4 : 0, background: s.color }} />
                    <div className="h-1 rounded-full opacity-40" style={{ width: `${(s.prev / maxShare) * 100}%`, minWidth: s.prev ? 4 : 0, background: s.color }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={panel}>
          <h2 className="text-sm font-medium">สินค้าที่ไม่ได้พูดถึงนาน · {d.staleTotal} รุ่น</h2>
          <p className="text-xs text-muted">ไม่มีคอนเทนต์เกิน 60 วัน · แตะเพื่อให้ agent เริ่มไอเดีย</p>
          <ul className="mt-2 divide-y divide-border">
            {d.stale.slice(0, 6).map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate">{p.name}</p>
                  <p className="text-xs text-muted">{p.last ? `ลงล่าสุด ${dayLabel(p.last)}` : 'ยังไม่เคยมีคอนเทนต์'}</p>
                </div>
                <Link href={`/content/idea?text=${encodeURIComponent(`อยากเล่าเรื่องรุ่น ${p.name}`)}`}
                  className="shrink-0 rounded-xl border border-border px-3 py-1.5 text-sm">ไอเดีย</Link>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* ── ตลาดและ agent ช่วยคิด ── */}
      <h2 className="mb-2 mt-6 text-xs font-medium uppercase tracking-wide text-muted">คู่แข่งและไอเดีย</h2>
      <div className="grid gap-3 lg:grid-cols-2">
        <IdeasBox ideas={d.ideas} brands={brands} brandId={b} productName={productName} />
        <SwipeBox swipes={d.swipes} brands={brands} brandId={b} />
      </div>

      <NewMenu />
    </>
  );
}
