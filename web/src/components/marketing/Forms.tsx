'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createCampaign, createPromotion, createPromoExtra, endPromotion, type ActionResult } from '@/modules/marketing/actions';
import type { PromoRow } from '@/modules/marketing/queries';

const input =
  'mt-1.5 w-full rounded-xl border border-border bg-bg px-3 py-2.5 outline-none focus:border-accent';
const label = 'block text-sm font-medium';

function useSubmit(action: (fd: FormData) => Promise<ActionResult>, onDone: () => void) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  return {
    error,
    pending,
    onSubmit(e: React.FormEvent<HTMLFormElement>) {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      setError(null);
      start(async () => {
        const res = await action(fd);
        if (!res.ok) {
          setError(res.error);
          return;
        }
        onDone();
        router.refresh();
      });
    },
  };
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-border bg-surface">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3.5 text-left font-medium"
        aria-expanded={open}
      >
        {title}
        <span className="text-muted">{open ? '−' : '+'}</span>
      </button>
      {open && <div className="border-t border-border p-4">{children}</div>}
    </div>
  );
}

const today = () => new Date().toISOString().slice(0, 10);

export function CampaignForm({ channels }: { channels: { id: string; name_th: string }[] }) {
  const [key, setKey] = useState(0);
  const { error, pending, onSubmit } = useSubmit(createCampaign, () => setKey((k) => k + 1));

  return (
    <Panel title="+ สร้างแคมเปญใหม่">
      <form key={key} onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className={label} htmlFor="c-name">ชื่อแคมเปญ</label>
          <input id="c-name" name="name" required className={input} placeholder="เช่น โปรเตียงรับปีใหม่" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label} htmlFor="c-ch">ช่องทาง</label>
            <select id="c-ch" name="channel_id" className={input} defaultValue="">
              <option value="">— ไม่ระบุ —</option>
              {channels.map((c) => (
                <option key={c.id} value={c.id}>{c.name_th}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={label} htmlFor="c-budget">งบ (บาท)</label>
            <input id="c-budget" name="budget" type="number" min="0" step="100" className={input} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label} htmlFor="c-from">เริ่ม</label>
            <input id="c-from" name="starts_on" type="date" required defaultValue={today()} className={input} />
          </div>
          <div>
            <label className={label} htmlFor="c-to">จบ</label>
            <input id="c-to" name="ends_on" type="date" className={input} />
          </div>
        </div>
        <div>
          <label className={label} htmlFor="c-obj">เป้าหมาย</label>
          <input id="c-obj" name="objective" className={input} placeholder="เช่น ดันยอดเตียงทั้งหมด" />
        </div>
        {error && <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
        <button disabled={pending} className="w-full rounded-xl bg-accent px-4 py-3 font-medium text-accent-fg disabled:opacity-60">
          {pending ? 'กำลังสร้าง…' : 'สร้างแคมเปญ'}
        </button>
      </form>
    </Panel>
  );
}

export function PromotionForm({
  campaigns,
  categories,
  products,
}: {
  campaigns: { id: string; name: string }[];
  categories: { id: string; name: string }[];
  products: { id: string; collection: string }[];
}) {
  const [key, setKey] = useState(0);
  const [scope, setScope] = useState('หมวด');
  const { error, pending, onSubmit } = useSubmit(createPromotion, () => setKey((k) => k + 1));

  const noTargets = categories.length === 0 && products.length === 0;

  return (
    <Panel title="+ ตั้งโปรโมชัน (ราคาเปลี่ยนทันที)">
      {noTargets ? (
        <p className="text-sm text-muted">
          ยังไม่มีสินค้าที่อนุมัติแล้วในระบบ — ต้องนำเข้าและอนุมัติสินค้าก่อนจึงจะตั้งโปรได้
        </p>
      ) : (
        <form key={key} onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className={label} htmlFor="p-name">ชื่อโปร</label>
            <input id="p-name" name="name" required className={input} placeholder="เช่น ลดเตียงทั้งหมด 30%" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label} htmlFor="p-scope">ลดอะไร</label>
              <select
                id="p-scope"
                name="scope"
                className={input}
                value={scope}
                onChange={(e) => setScope(e.target.value)}
              >
                <option value="ทั้งหมด">ทุกสินค้า</option>
                <option value="หมวด">ทั้งหมวด</option>
                <option value="รุ่น">เฉพาะรุ่น</option>
              </select>
            </div>
            <div>
              <label className={label} htmlFor="p-pct">ลดกี่ %</label>
              <input id="p-pct" name="percent" type="number" min="0" max="100" step="1" required className={input} />
            </div>
          </div>

          {scope !== 'ทั้งหมด' && (
            <div>
              <label className={label} htmlFor="p-target">
                {scope === 'หมวด' ? 'เลือกหมวด' : 'เลือกรุ่น'}
              </label>
              <select id="p-target" name="target_id" required className={input} defaultValue="">
                <option value="" disabled>— เลือก —</option>
                {(scope === 'หมวด' ? categories : products).map((t) => (
                  <option key={t.id} value={t.id}>
                    {'name' in t ? t.name : t.collection}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label} htmlFor="p-from">เริ่ม</label>
              <input id="p-from" name="starts_on" type="date" required defaultValue={today()} className={input} />
            </div>
            <div>
              <label className={label} htmlFor="p-to">จบ</label>
              <input id="p-to" name="ends_on" type="date" className={input} />
            </div>
          </div>

          <div>
            <label className={label} htmlFor="p-camp">อยู่ในแคมเปญ</label>
            <select id="p-camp" name="campaign_id" className={input} defaultValue="">
              <option value="">— ไม่ผูกแคมเปญ —</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {error && <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

          <p className="rounded-lg bg-warn/10 px-3 py-2 text-xs text-warn">
            กดแล้วราคาขายจะเปลี่ยนทันที และเซลส์จะเห็นราคาใหม่ทันที
          </p>

          <button disabled={pending} className="w-full rounded-xl bg-accent px-4 py-3 font-medium text-accent-fg disabled:opacity-60">
            {pending ? 'กำลังตั้งโปร…' : 'ตั้งโปรโมชัน'}
          </button>
        </form>
      )}
    </Panel>
  );
}

const TH_MONTH = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
/** ต้องตรงกับ until() ใน line-agent/render.ts */
function untilText(d: string | null) {
  if (!d) return '';
  const [y, m, dd] = d.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return dd === last ? ` ภายใน เดือน${TH_MONTH[m - 1]} ${y + 543}` : ` ภายใน ${dd} ${TH_MONTH[m - 1]} ${y + 543}`;
}
/** ข้อความที่บอทจะต่อท้าย · ต้องตรงกับ priceSentence() ใน line-agent/render.ts */
function promoText(p: { kind: string; percent: number | null; min_total: number | null; detail: string | null; ends_on: string | null }, after: string) {
  const n = (v: number | null) => (v == null ? '…' : String(v));
  const body =
    p.kind === 'ชำระเงินสด' ? `ชำระเป็นเงินสด ลด on top เพิ่ม ${n(p.percent)}% เหลือ ${after}`
    : p.kind === 'ขั้นบันได' ? `ซื้อครบ ${n(p.min_total)} ลดเพิ่ม ${n(p.percent)}%`
    : p.kind === 'ส่งฟรี' ? `ส่งฟรี${p.min_total ? ` เมื่อซื้อครบ ${p.min_total}` : ''}${p.detail ? ` (${p.detail})` : ''}`
    : p.kind === 'ของแถม' ? `แถม ${p.detail || '…'}${p.min_total ? ` เมื่อซื้อครบ ${p.min_total}` : ''}`
    : '';
  return body + untilText(p.ends_on);
}

export function PromoExtraForm({
  categories,
  products,
}: {
  categories: { id: string; name: string }[];
  products: { id: string; collection: string }[];
}) {
  const [key, setKey] = useState(0);
  const [kind, setKind] = useState('ชำระเงินสด');
  const [scope, setScope] = useState('ทั้งหมด');
  const [f, setF] = useState({ percent: '', min_total: '', detail: '', ends_on: '' });
  const { error, pending, onSubmit } = useSubmit(createPromoExtra, () => {
    setKey((k) => k + 1);
    setF({ percent: '', min_total: '', detail: '', ends_on: '' });
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const num = (v: string) => (v ? Number(v) : null);
  const showPct = kind === 'ชำระเงินสด' || kind === 'ขั้นบันได';
  const showMin = kind !== 'ชำระเงินสด';
  const showDetail = kind === 'ส่งฟรี' || kind === 'ของแถม';
  const after = f.percent && kind === 'ชำระเงินสด' ? String(Math.round(26880 * (1 - Number(f.percent) / 100) * 100) / 100) : '…';

  return (
    <Panel title="+ ตั้งโปรฯ ต่อท้ายคำตอบราคา (เงินสด · ขั้นบันได · ส่งฟรี · ของแถม)">
      <form key={key} onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label} htmlFor="x-kind">ประเภท</label>
            <select id="x-kind" name="kind" className={input} value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="ชำระเงินสด">ชำระเงินสด ลด on top</option>
              <option value="ขั้นบันได">ขั้นบันได (ซื้อครบ…ลดเพิ่ม)</option>
              <option value="ส่งฟรี">ส่งฟรี</option>
              <option value="ของแถม">ของแถม</option>
            </select>
          </div>
          <div>
            <label className={label} htmlFor="x-scope">ใช้กับ</label>
            <select id="x-scope" name="scope" className={input} value={scope} onChange={(e) => setScope(e.target.value)}>
              <option value="ทั้งหมด">ทุกสินค้า</option>
              {categories.length > 0 && <option value="หมวด">ทั้งหมวด</option>}
              {products.length > 0 && <option value="รุ่น">เฉพาะรุ่น</option>}
            </select>
          </div>
        </div>

        {scope !== 'ทั้งหมด' && (
          <div>
            <label className={label} htmlFor="x-target">{scope === 'หมวด' ? 'เลือกหมวด' : 'เลือกรุ่น'}</label>
            <select id="x-target" name="target_id" required className={input} defaultValue="">
              <option value="" disabled>— เลือก —</option>
              {(scope === 'หมวด' ? categories : products).map((t) => (
                <option key={t.id} value={t.id}>{'name' in t ? t.name : t.collection}</option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          {showPct && (
            <div>
              <label className={label} htmlFor="x-pct">ลดเพิ่มกี่ %</label>
              <input id="x-pct" name="percent" type="number" min="0.01" max="100" step="0.01" required className={input} value={f.percent} onChange={set('percent')} />
            </div>
          )}
          {showMin && (
            <div>
              <label className={label} htmlFor="x-min">ซื้อครบ (บาท){kind === 'ขั้นบันได' ? '' : ' · ไม่ใส่ก็ได้'}</label>
              <input id="x-min" name="min_total" type="number" min="1" step="1" required={kind === 'ขั้นบันได'} className={input} value={f.min_total} onChange={set('min_total')} />
            </div>
          )}
        </div>

        {showDetail && (
          <div>
            <label className={label} htmlFor="x-detail">{kind === 'ของแถม' ? 'แถมอะไร' : 'เงื่อนไข · ไม่ใส่ก็ได้'}</label>
            <input id="x-detail" name="detail" required={kind === 'ของแถม'} className={input} value={f.detail} onChange={set('detail')}
              placeholder={kind === 'ของแถม' ? 'เช่น หมอนอิง 2 ใบ' : 'เช่น กรุงเทพฯ และปริมณฑล'} />
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label} htmlFor="x-from">เริ่ม</label>
            <input id="x-from" name="starts_on" type="date" required defaultValue={today()} className={input} />
          </div>
          <div>
            <label className={label} htmlFor="x-to">หมดเขต</label>
            <input id="x-to" name="ends_on" type="date" className={input} value={f.ends_on} onChange={set('ends_on')} />
          </div>
        </div>

        <div>
          <label className={label} htmlFor="x-link">ลิงก์หน้าโปรฯ · ไม่ใส่ = หน้าโปรฯ รวม</label>
          <input id="x-link" name="link_url" type="url" className={input} placeholder="https://chawcher.com/category/promotion/" />
        </div>
        <div>
          <label className={label} htmlFor="x-name">ชื่อโปร · ไม่ใส่ก็ได้</label>
          <input id="x-name" name="name" className={input} />
        </div>

        <div className="rounded-lg bg-bg px-3 py-2 text-xs">
          <div className="text-muted">บอทจะต่อท้ายแบบนี้ (ตัวอย่าง Kiwi Armchair):</div>
          <div className="mt-1">… ลด 20% เหลือ 26880 <b>{promoText({ kind, percent: num(f.percent), min_total: num(f.min_total), detail: f.detail || null, ends_on: f.ends_on || null }, after)}</b> และส่วนลดเพิ่มเติมตามโปรฯ ได้ที่ …</div>
          {kind === 'ชำระเงินสด' && <div className="mt-1 text-muted">ตัวที่ไฟล์ราคาให้ on top 0% (16 ตัว) ไม่ร่วมโปรเงินสด</div>}
        </div>

        {error && <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
        <button disabled={pending} className="w-full rounded-xl bg-accent px-4 py-3 font-medium text-accent-fg disabled:opacity-60">
          {pending ? 'กำลังบันทึก…' : 'บันทึกโปรฯ'}
        </button>
      </form>
    </Panel>
  );
}

export function LivePromos({ rows }: { rows: PromoRow[] }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  if (rows.length === 0) return null;
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <h2 className="text-sm font-medium text-muted">โปรฯ ที่ใช้อยู่ / กำลังจะเริ่ม</h2>
      <ul className="mt-2 divide-y divide-border">
        {rows.map((p) => (
          <li key={p.id} className="flex items-start justify-between gap-3 py-2 text-sm">
            <div className="min-w-0">
              <div className="font-medium">{p.name}</div>
              <div className="text-xs text-muted">
                {p.kind} · {p.scope === 'ทั้งหมด' ? 'ทุกสินค้า' : p.scope} · เริ่ม {p.starts_on}{p.ends_on ? ` ถึง ${p.ends_on}` : ' · ไม่มีวันหมด'}
              </div>
              {p.kind !== 'ลดราคา' && <div className="mt-0.5 text-xs">บอทต่อท้าย: {promoText(p, '…')}</div>}
            </div>
            <button
              disabled={pending}
              onClick={() => {
                if (!confirm(`จบโปร "${p.name}" ตอนนี้เลย?`)) return;
                setError(null);
                start(async () => {
                  const r = await endPromotion(p.id);
                  if (!r.ok) setError(r.error); else router.refresh();
                });
              }}
              className="shrink-0 rounded-lg border border-border px-2 py-1 text-xs hover:bg-bg disabled:opacity-60"
            >
              จบโปร
            </button>
          </li>
        ))}
      </ul>
      {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}
