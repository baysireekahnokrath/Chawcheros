import Link from 'next/link';
import { getToday, getCampaigns, getChannels, getDiscountTargets } from '@/modules/marketing/queries';
import { CampaignForm, PromotionForm } from '@/components/marketing/Forms';

const baht = (n: number | null | undefined) =>
  n == null ? '—' : n.toLocaleString('th-TH', { maximumFractionDigits: 0 }) + ' ฿';

export default async function MarketingPage() {
  const [today, campaigns, channels, targets] = await Promise.all([
    getToday(),
    getCampaigns(),
    getChannels(),
    getDiscountTargets(),
  ]);

  return (
    <>
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-semibold tracking-tight">การตลาด</h1>
        <Link href="/" className="text-sm text-muted hover:text-text">← ทุกโมดูล</Link>
      </div>

      {/* งานวันนี้ — หน้าจอต้องเปิดมาเจอ "สิ่งที่ต้องลงมือ" ไม่ใช่ตารางให้ค้นหา */}
      <section className="mt-5">
        <h2 className="text-sm font-medium text-muted">งานวันนี้</h2>
        {today.length === 0 ? (
          <p className="mt-2 rounded-xl border border-border bg-surface px-4 py-3 text-sm text-muted">
            ไม่มีอะไรค้าง 🎉
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {today.map((t) => (
              <li
                key={t.ref_id + t.หมวด}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="text-xs text-warn">{t.หมวด}</div>
                  <div className="truncate font-medium">{t.เรื่อง}</div>
                </div>
                {t.อีกกี่วัน != null && (
                  <span className="shrink-0 rounded-lg bg-warn/10 px-2 py-1 text-xs text-warn">
                    {t.อีกกี่วัน} วัน
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6 space-y-3">
        <PromotionForm
          campaigns={campaigns.map((c) => ({ id: c.id, name: c.name }))}
          categories={targets.categories}
          products={targets.products}
        />
        <CampaignForm channels={channels} />
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-medium text-muted">แคมเปญ ({campaigns.length})</h2>
        {campaigns.length === 0 ? (
          <p className="mt-2 rounded-xl border border-border bg-surface px-4 py-3 text-sm text-muted">
            ยังไม่มีแคมเปญ — กด &ldquo;สร้างแคมเปญใหม่&rdquo; ด้านบน
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {campaigns.map((c) => {
              const over = c.คงเหลือ != null && c.คงเหลือ < 0;
              return (
                <li key={c.id} className="rounded-xl border border-border bg-surface p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{c.name}</div>
                      <div className="mt-0.5 text-xs text-muted">
                        {c.ช่องทาง ?? 'ไม่ระบุช่องทาง'} · {c.starts_on}
                        {c.ends_on ? ` – ${c.ends_on}` : ''}
                      </div>
                    </div>
                    <span className="shrink-0 rounded-lg bg-accent/10 px-2 py-1 text-xs text-accent">
                      {c.status}
                    </span>
                  </div>

                  <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <dt className="text-xs text-muted">งบ</dt>
                      <dd>{baht(c.งบที่ตั้ง)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted">ใช้จริง</dt>
                      <dd>{baht(c.ใช้จริง)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted">คงเหลือ</dt>
                      <dd className={over ? 'text-danger' : undefined}>{baht(c.คงเหลือ)}</dd>
                    </div>
                  </dl>

                  <div className="mt-2 text-xs text-muted">
                    โปร {c.จำนวนโปร} · คอนเทนต์ {c.จำนวนคอนเทนต์}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
