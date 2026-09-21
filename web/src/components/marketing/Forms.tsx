'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createCampaign, createPromotion, type ActionResult } from '@/modules/marketing/actions';

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
