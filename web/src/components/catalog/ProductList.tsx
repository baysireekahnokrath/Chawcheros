'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { addVariantFromBase } from '@/modules/catalog/actions';
import type { ProductRow, VariantWithPrice } from '@/modules/catalog/queries';

const baht = (n: number | null | undefined) =>
  n === null || n === undefined ? '—' : n.toLocaleString('th-TH', { maximumFractionDigits: 0 });

type Props = {
  products: ProductRow[];
  grades: string[];
  loadVariants: (productId: string) => Promise<VariantWithPrice[]>;
};

export default function ProductList({ products, grades, loadVariants }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [variants, setVariants] = useState<Record<string, VariantWithPrice[]>>({});
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [pending, start] = useTransition();
  const router = useRouter();

  function toggle(p: ProductRow) {
    if (openId === p.id) { setOpenId(null); return; }
    setOpenId(p.id);
    setAddingTo(null);
    if (variants[p.id]) return;
    start(async () => {
      const rows = await loadVariants(p.id);
      setVariants((prev) => ({ ...prev, [p.id]: rows }));
    });
  }

  function onAdd(e: React.FormEvent<HTMLFormElement>, productId: string) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    start(async () => {
      const res = await addVariantFromBase(fd);
      if (!res.ok) { setError(res.error); return; }
      setAddingTo(null);
      const rows = await loadVariants(productId);
      setVariants((prev) => ({ ...prev, [productId]: rows }));
      router.refresh();
    });
  }

  const needle = q.trim().toLowerCase();
  const shown = needle
    ? products.filter(
        (p) =>
          p.collection.toLowerCase().includes(needle) ||
          (p.categories?.name ?? '').toLowerCase().includes(needle),
      )
    : products;

  const input =
    'w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-sm outline-none focus:border-accent';

  return (
    <div className="space-y-4">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="ค้นหารุ่น หรือหมวด…"
        className={input}
        aria-label="ค้นหารุ่น"
      />

      {error && (
        <div className="rounded-2xl border border-danger/40 bg-danger/5 p-4 text-sm">
          <div className="font-medium text-danger">เพิ่มไม่สำเร็จ</div>
          <p className="mt-1">{error}</p>
        </div>
      )}

      {shown.length === 0 && (
        <p className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted">
          {products.length === 0
            ? 'ยังไม่มีสินค้าที่อนุมัติแล้ว — ไปที่หน้าตรวจก่อน'
            : 'ไม่เจอรุ่นที่ค้นหา'}
        </p>
      )}

      <ul className="space-y-3">
        {shown.map((p) => {
          const open = openId === p.id;
          const rows = variants[p.id];
          const bases = (rows ?? []).filter((v) => v.price?.ที่มาของราคา === 'ราคาของตัวเอง');

          return (
            <li key={p.id} className="overflow-hidden rounded-2xl border border-border bg-surface">
              <button
                onClick={() => toggle(p)}
                aria-expanded={open}
                className="flex w-full items-center justify-between gap-3 p-4 text-left"
              >
                <div className="min-w-0">
                  <div className="font-medium">{p.collection}</div>
                  <div className="text-sm text-muted">
                    {p.categories?.name ?? '—'}
                    {p.brands?.name ? ` · ${p.brands.name}` : ''}
                  </div>
                </div>
                <span className="shrink-0 text-xs text-muted">{open ? '▲' : '▼'}</span>
              </button>

              {open && (
                <div className="border-t border-border">
                  {!rows ? (
                    <p className="p-4 text-sm text-muted">กำลังโหลด…</p>
                  ) : (
                    <>
                      <ul>
                        {rows.map((v) => (
                          <li key={v.id} className="flex items-start gap-3 border-b border-border px-4 py-3">
                            <div className="min-w-0 flex-1">
                              <div className="font-mono text-xs text-accent">
                                {v.price?.sku_display ?? v.sku}
                              </div>
                              <div className="mt-0.5 text-sm">
                                {[v.material_grade, v.wood_type, v.wood_colour, v.configuration]
                                  .filter(Boolean)
                                  .join(' · ') || '—'}
                              </div>
                              <div className="mt-0.5 text-[11px] text-muted">
                                {[v.width_cm, v.depth_cm, v.height_cm].map((x) => x ?? '—').join('×')}
                                {' cm · '}
                                {v.price?.ที่มาของราคา ?? 'ยังไม่มีราคา'}
                              </div>
                            </div>
                            <div className="shrink-0 text-right">
                              <div className="text-sm font-medium whitespace-nowrap">
                                {baht(v.price?.ราคาเต็มรวม_vat)}
                              </div>
                              {!!v.price?.ส่วนลดปกติ_pct && (
                                <div className="text-[11px] text-ok">
                                  ลด {v.price.ส่วนลดปกติ_pct}% → {baht(v.price.ราคาขายรวม_vat)}
                                </div>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>

                      {addingTo === p.id ? (
                        <form onSubmit={(e) => onAdd(e, p.id)} className="space-y-3 p-4">
                          <div>
                            <label className="block text-sm font-medium" htmlFor={`base-${p.id}`}>
                              บวกจากตัวไหน
                            </label>
                            <select id={`base-${p.id}`} name="base_variant_id" required className={input + ' mt-1.5'}>
                              {bases.map((v) => (
                                <option key={v.id} value={v.id}>
                                  {[v.material_grade, v.wood_type, v.configuration].filter(Boolean).join(' · ')}
                                  {' — '}
                                  {baht(v.price?.ราคาเต็มรวม_vat)} บาท
                                </option>
                              ))}
                            </select>
                            <p className="mt-1 text-[11px] text-muted">
                              เลือกได้เฉพาะตัวที่มีราคาของตัวเอง (ปกติคือผ้า A)
                            </p>
                          </div>

                          <div>
                            <label className="block text-sm font-medium" htmlFor={`grade-${p.id}`}>
                              เปลี่ยนวัสดุหุ้มเป็น
                            </label>
                            <input
                              id={`grade-${p.id}`}
                              name="material_grade"
                              list="grade-options"
                              required
                              placeholder="เช่น หนังแท้"
                              className={input + ' mt-1.5'}
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium" htmlFor={`up-${p.id}`}>
                              บวกเพิ่มกี่บาท (รวม VAT)
                            </label>
                            <input
                              id={`up-${p.id}`}
                              name="uplift"
                              type="number"
                              min="0"
                              step="1"
                              required
                              placeholder="เช่น 12000"
                              className={input + ' mt-1.5'}
                            />
                            <p className="mt-1 text-[11px] text-muted">
                              ระบบเก็บแค่ตัวเลขนี้ ราคาจริงคำนวณสดจากตัวฐานเสมอ
                              — ขึ้นราคาตัวฐานเมื่อไหร่ ตัวนี้ขยับตามเอง
                            </p>
                          </div>

                          <div className="flex gap-2 pt-1">
                            <button
                              type="submit"
                              disabled={pending}
                              className="flex-1 rounded-xl bg-accent px-4 py-3 text-sm font-medium text-accent-fg disabled:opacity-50"
                            >
                              {pending ? 'กำลังออก SKU…' : 'เพิ่มตัวสินค้า'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setAddingTo(null)}
                              className="rounded-xl border border-border px-4 py-3 text-sm"
                            >
                              ยกเลิก
                            </button>
                          </div>
                        </form>
                      ) : (
                        bases.length > 0 && (
                          <button
                            onClick={() => { setAddingTo(p.id); setError(null); }}
                            className="w-full px-4 py-3 text-left text-sm text-accent"
                          >
                            + เพิ่มเกรดวัสดุอื่นเข้ารุ่นนี้
                          </button>
                        )
                      )}
                    </>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <datalist id="grade-options">
        {grades.map((g) => (
          <option key={g} value={g} />
        ))}
      </datalist>
    </div>
  );
}
