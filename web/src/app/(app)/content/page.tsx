import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import {
  getItems, getContentToday, getGaps, getBrands, getPillars, getKeyVisuals,
} from '@/modules/content/queries';
import { STAGES, TONE, channelShort } from '@/modules/content/types';

export const metadata = { title: 'คอนเทนต์ · Chaw Cher OS' };

const isDirectImage = (u: string) => /\.(jpe?g|png|webp|gif|avif)(\?|$)/i.test(u);

export default async function ContentPage({ searchParams }: PageProps<'/content'>) {
  const { brand } = await searchParams;
  const supabase = await createClient();
  const [all, today, gaps, brands, pillars, { data: plRows }] = await Promise.all([
    getItems(), getContentToday(), getGaps(), getBrands(), getPillars(),
    supabase.schema('content').from('placements').select('item_id,channel_id,skipped_reason'),
  ]);

  const items = typeof brand === 'string' && brand ? all.filter((i) => i.brand_id === brand) : all;
  const visuals = await getKeyVisuals(items.map((i) => i.id));
  const chans: Record<string, string[]> = {};
  for (const r of (plRows ?? []) as { item_id: string; channel_id: string; skipped_reason: string | null }[]) {
    if (!r.skipped_reason) (chans[r.item_id] ??= []).push(r.channel_id);
  }
  const brandName = (id: string | null) => brands.find((b) => b.id === id)?.name;
  const pillarOf = (id: string | null) => pillars.find((p) => p.id === id);

  const active = items.filter((i) => i.stage !== 'โพสต์แล้ว' && i.stage !== 'พับไว้');
  const byStage = STAGES.map((s) => ({ stage: s, items: items.filter((i) => i.stage === s) }))
    .filter((g) => g.items.length > 0);

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">คอนเทนต์</h1>
          <p className="mt-1 text-sm text-muted">ข้อความ · ภาพ · อัลบั้ม — ชิ้นเดียวลง Facebook, Instagram และบล็อก</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Link href="/content/settings" className="rounded-xl border border-border px-3 py-2.5 text-sm">ตั้งค่า</Link>
          <Link href="/content/new" role="button"
            className="rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-accent-fg">+ ตั้งงาน</Link>
        </div>
      </div>

      {brands.length > 1 && (
        <nav className="mt-4 flex flex-wrap gap-2" aria-label="แบรนด์">
          <Link href="/content"
            className={'rounded-full border px-3 py-1.5 text-sm ' + (!brand ? 'border-accent bg-accent text-accent-fg' : 'border-border')}>
            ทุกแบรนด์
          </Link>
          {brands.map((b) => (
            <Link key={b.id} href={`/content?brand=${b.id}`}
              className={'rounded-full border px-3 py-1.5 text-sm ' + (brand === b.id ? 'border-accent bg-accent text-accent-fg' : 'border-border')}>
              {b.name}
            </Link>
          ))}
        </nav>
      )}

      {today.length > 0 && (
        <section className="mt-5">
          <h2 className="mb-2 text-sm font-medium">งานวันนี้</h2>
          <ul className="space-y-2">
            {today.map((t) => (
              <li key={`${t.หมวด}-${t.ref_id}`}>
                <Link href={`/content/${t.ref_id}`}
                  className={'block rounded-xl border px-4 py-3 text-sm ' +
                    (t.หมวด === 'รอคุณอนุมัติ' ? 'border-locked/40 bg-locked/5'
                      : t.หมวด === 'ถูกตีกลับ ต้องแก้' ? 'border-danger/40 bg-danger/5' : 'border-border bg-surface')}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-medium">{t.เรื่อง}</span>
                    <span className="shrink-0 text-xs text-muted">{t.รูปแบบ}</span>
                  </div>
                  <div className="mt-0.5 text-xs text-muted">{t.หมวด}</div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {gaps.length > 0 && (
        <section className="mt-5">
          <h2 className="mb-2 text-sm font-medium text-warn">อนุมัติแล้วแต่ยังลงไม่ครบ</h2>
          <ul className="space-y-2">
            {gaps.map((g) => (
              <li key={g.item_id}>
                <Link href={`/content/${g.item_id}`} className="block rounded-xl border border-warn/40 bg-warn/5 px-4 py-3 text-sm">
                  <div className="font-medium">{g.เรื่อง}</div>
                  <div className="mt-0.5 text-xs text-muted">
                    ลงแล้ว {g.ลงแล้ว} จาก {g.ตั้งใจลงกี่ที่} · ยังขาด <span className="text-warn">{g.ที่ยังขาด}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-6">
        <h2 className="mb-2 flex items-baseline justify-between text-sm font-medium">
          <span>งานทั้งหมด</span>
          <span className="text-xs text-muted">กำลังทำอยู่ {active.length} ชิ้น</span>
        </h2>

        {items.length === 0 ? (
          <p className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted">
            ยังไม่มีงานคอนเทนต์ — กด &ldquo;+ ตั้งงาน&rdquo; เพื่อเริ่ม
          </p>
        ) : (
          <div className="space-y-5">
            {byStage.map((g) => (
              <div key={g.stage}>
                <div className="mb-2 flex items-baseline gap-2">
                  <span className={`rounded-lg px-2 py-0.5 text-xs ${TONE[g.stage] ?? ''}`}>{g.stage}</span>
                  <span className="text-xs text-muted">{g.items.length}</span>
                </div>
                <ul className="space-y-2">
                  {g.items.map((i) => {
                    const kv = visuals[i.id];
                    const pl = pillarOf(i.pillar_id);
                    return (
                      <li key={i.id}>
                        <Link href={`/content/${i.id}`}
                          className="flex gap-3 rounded-xl border border-border border-l-4 bg-surface p-2.5"
                          style={{ borderLeftColor: pl?.color ?? 'var(--border)' }}>
                          {kv && isDirectImage(kv) && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={kv} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium">{i.hook || i.title}</div>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                              {(chans[i.id] ?? []).map((c) => (
                                <span key={c} className="rounded-md border border-border px-1 text-[10.5px] font-bold">{channelShort(c)}</span>
                              ))}
                              <span>{brandName(i.brand_id) ?? i.format}</span>
                              {pl && <span>· {pl.name}</span>}
                              {i.off_plan && brandName(i.brand_id) && (
                                <span className="rounded-md bg-warn/10 px-1 font-medium text-warn">นอกแผน</span>
                              )}
                            </div>
                            {i.review_note && <div className="mt-1 text-xs text-danger">{i.review_note}</div>}
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
