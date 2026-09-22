'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { receiveUnits } from '@/modules/stock/actions';
import { buildStickers, type Sticker } from '@/modules/stock/stickers';
import type { Location } from '@/modules/stock/queries';

type Variant = {
  id: string;
  sku: string;
  material_grade: string | null;
  wood_type: string | null;
  configuration: string | null;
  products: { collection: string; categories: { name: string } | null } | null;
};

const input =
  'mt-1.5 w-full rounded-xl border border-border bg-bg px-3 py-3 text-base outline-none focus:border-accent';
const label = 'block text-sm font-medium';

const describe = (v: Variant) =>
  [
    v.products?.collection,
    v.products?.categories?.name,
    v.material_grade,
    v.wood_type,
    v.configuration,
  ]
    .filter(Boolean)
    .join(' · ');

export default function ReceiveForm({
  variants,
  locations,
}: {
  variants: Variant[];
  locations: Location[];
}) {
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<Variant | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stickers, setStickers] = useState<Sticker[] | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const matches = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    return variants
      .filter((v) => describe(v).toLowerCase().includes(needle) || v.sku.includes(needle))
      .slice(0, 12);
  }, [q, variants]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!picked) { setError('ยังไม่ได้เลือกว่าเป็นสินค้าตัวไหน'); return; }
    const fd = new FormData(e.currentTarget);
    fd.set('variant_id', picked.id);
    setError(null);
    start(async () => {
      const res = await receiveUnits(fd);
      if (!res.ok) { setError(res.error); return; }
      const codes = res.data?.codes ?? [];
      setStickers(await buildStickers(codes));
      router.refresh();
    });
  }

  if (stickers) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-ok/40 bg-ok/5 p-4 text-sm print:hidden">
          <div className="font-medium text-ok">
            รับเข้าแล้ว {stickers.length} ตัว — ออกรหัสให้ครบทุกตัว
          </div>
          <p className="mt-1 text-muted">
            พิมพ์สติกเกอร์แล้วไปติดที่ของจริงเลย ติดแล้วส่องกล้องมือถือได้ทันที
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => window.print()}
              className="flex-1 rounded-xl bg-accent px-4 py-3 font-medium text-accent-fg"
            >
              พิมพ์สติกเกอร์
            </button>
            <button
              onClick={() => { setStickers(null); setPicked(null); setQ(''); }}
              className="rounded-xl border border-border px-4 py-3"
            >
              รับของเข้าอีก
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 print:grid-cols-3 print:gap-2">
          {stickers.map((s) => (
            <div
              key={s.unit_code}
              className="rounded-xl border border-border bg-surface p-3 text-center print:break-inside-avoid print:border-black"
            >
              <div
                className="mx-auto aspect-square w-full max-w-[120px] [&>svg]:h-full [&>svg]:w-full"
                dangerouslySetInnerHTML={{ __html: s.qr_svg }}
              />
              <div className="mt-2 font-mono text-sm font-semibold tracking-wide">
                {s.unit_code}
              </div>
              <div className="mt-0.5 truncate text-[11px] text-muted">{s.collection}</div>
              <div className="truncate text-[10px] text-muted">{s.spec}</div>
              <div className="mt-0.5 font-mono text-[10px] text-muted">{s.sku_display}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error && (
        <div className="rounded-2xl border border-danger/40 bg-danger/5 p-4 text-sm">
          <div className="font-medium text-danger">รับเข้าไม่สำเร็จ</div>
          <p className="mt-1">{error}</p>
        </div>
      )}

      <div className="rounded-2xl border border-border bg-surface p-4">
        <label className={label} htmlFor="find">สินค้าตัวไหน</label>
        {picked ? (
          <div className="mt-1.5 flex items-start justify-between gap-3 rounded-xl border border-accent bg-accent/5 px-3 py-3">
            <div className="min-w-0 text-sm">
              <div className="font-medium">{describe(picked)}</div>
              <div className="font-mono text-xs text-muted">{picked.sku}</div>
            </div>
            <button
              type="button"
              onClick={() => { setPicked(null); setQ(''); }}
              className="shrink-0 text-xs text-accent"
            >
              เปลี่ยน
            </button>
          </div>
        ) : (
          <>
            <input
              id="find"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="พิมพ์ชื่อรุ่น หมวด หรือ SKU"
              className={input}
              autoComplete="off"
            />
            {matches.length > 0 && (
              <ul className="mt-2 max-h-64 divide-y divide-border overflow-y-auto rounded-xl border border-border">
                {matches.map((v) => (
                  <li key={v.id}>
                    <button
                      type="button"
                      onClick={() => setPicked(v)}
                      className="w-full px-3 py-3 text-left text-sm hover:bg-bg"
                    >
                      <div>{describe(v)}</div>
                      <div className="font-mono text-xs text-muted">{v.sku}</div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {q.trim() && matches.length === 0 && (
              <p className="mt-2 text-xs text-muted">
                ไม่เจอ — สินค้าต้องอนุมัติในหน้าตรวจก่อนถึงจะรับเข้าคลังได้
              </p>
            )}
          </>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-surface p-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label} htmlFor="qty">กี่ตัว</label>
            <input
              id="qty" name="qty" type="number" min="1" max="500" required defaultValue="1"
              inputMode="numeric" className={input}
            />
          </div>
          <div>
            <label className={label} htmlFor="st">สภาพ</label>
            <select id="st" name="status" defaultValue="พร้อมขาย" className={input}>
              <option value="พร้อมขาย">พร้อมขาย</option>
              <option value="ตำหนิ">ตำหนิ</option>
            </select>
          </div>
        </div>

        <div className="mt-3">
          <label className={label} htmlFor="loc">เก็บไว้ที่ไหน</label>
          <select id="loc" name="location_id" required defaultValue="" className={input}>
            <option value="" disabled>— เลือกที่เก็บ —</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </div>

        <div className="mt-3">
          <label className={label} htmlFor="note">หมายเหตุ</label>
          <input
            id="note" name="note" className={input}
            placeholder="เช่น ยอดยกมาจากไฟล์เดิม"
          />
        </div>

        <p className="mt-3 text-xs text-muted">
          ใส่ 4 = ระบบออกรหัสให้ 4 รหัส เพราะแต่ละตัวมีชะตาของตัวเอง
          ตัวหนึ่งอาจถูกจอง อีกตัวอาจมีตำหนิ
        </p>
      </div>

      <button
        type="submit"
        disabled={pending || !picked}
        className="w-full rounded-xl bg-accent px-4 py-3.5 font-medium text-accent-fg disabled:opacity-50"
      >
        {pending ? 'กำลังออกรหัส…' : 'รับเข้า แล้วพิมพ์สติกเกอร์'}
      </button>
    </form>
  );
}
