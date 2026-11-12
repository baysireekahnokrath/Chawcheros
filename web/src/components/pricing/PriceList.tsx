'use client';

import { useMemo, useState } from 'react';
import type { PriceRow } from '@/modules/pricing/queries';

/** ลำดับเกรดตามที่ใบราคากระดาษเรียงมาตลอด · เกรดที่ไม่รู้จักไปต่อท้าย */
const GRADE_ORDER = ['ผ้า A', 'ผ้า B', 'ผ้า C', 'หนังแท้', 'หนังแท้ (ออย)'];
const gradeRank = (g: string) => {
  const i = GRADE_ORDER.indexOf(g);
  return i === -1 ? GRADE_ORDER.length : i;
};

const baht = (n: number | null) =>
  n == null ? '—' : n.toLocaleString('th-TH', { maximumFractionDigits: 0 });

function sizeText(r: PriceRow) {
  const p = [r.กว้าง && `W${r.กว้าง}`, r.ลึก && `D${r.ลึก}`, r.สูง && `H${r.สูง}`].filter(Boolean);
  if (!p.length) return '';
  const seat = r.สูงที่นั่ง ? ` (นั่งสูง ${r.สูงที่นั่ง})` : '';
  return p.join(' × ') + ' cm' + seat;
}

type Group = {
  product_id: string;
  รุ่น: string;
  หมวด: string;
  ชื่ออังกฤษ: string | null;
  รูป: string | null;
  หมายเหตุรุ่น: string | null;
  rows: PriceRow[];
};

function groupByProduct(rows: PriceRow[]): Group[] {
  const m = new Map<string, Group>();
  for (const r of rows) {
    let g = m.get(r.product_id);
    if (!g) {
      g = { product_id: r.product_id, รุ่น: r.รุ่น, หมวด: r.หมวด, ชื่ออังกฤษ: r.ชื่ออังกฤษ,
            รูป: r.รูป, หมายเหตุรุ่น: r.หมายเหตุรุ่น, rows: [] };
      m.set(r.product_id, g);
    }
    g.rows.push(r);
  }
  return [...m.values()];
}

function Price({ full, sale, pct }: { full: number | null; sale: number | null; pct: number | null }) {
  if (sale == null) return <span className="text-muted">—</span>;
  const off = (pct ?? 0) > 0 && full != null && full !== sale;
  return (
    <span className="whitespace-nowrap">
      {off && <span className="mr-1.5 text-xs text-muted line-through">{baht(full)}</span>}
      <b className={off ? 'font-semibold text-ok' : 'font-semibold'}>{baht(sale)}</b>
    </span>
  );
}

/** ตารางเกรด — แถวคือขนาด/รูปทรง คอลัมน์คือเกรดวัสดุ เหมือนหน้า 3-6 ของใบราคาเดิม */
function GradeMatrix({ rows }: { rows: PriceRow[] }) {
  const grades = [...new Set(rows.map((r) => r.เกรดวัสดุ).filter(Boolean) as string[])]
    .sort((a, b) => gradeRank(a) - gradeRank(b) || a.localeCompare(b, 'th'));
  const shapes = [...new Set(rows.map((r) => r.รูปทรง ?? ''))];
  const cell = (shape: string, grade: string) =>
    rows.find((r) => (r.รูปทรง ?? '') === shape && r.เกรดวัสดุ === grade);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[32rem] border-collapse text-sm tabular-nums">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted">
            <th className="py-1.5 pr-3 font-medium whitespace-nowrap">ขนาด</th>
            {grades.map((g) => (
              <th key={g} className="py-1.5 pr-3 text-right font-medium whitespace-nowrap">{g}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shapes.map((s) => {
            const any = rows.find((r) => (r.รูปทรง ?? '') === s);
            return (
              <tr key={s || '-'} className="border-b border-border/60 last:border-0">
                {/* ไม่ให้ขนาดตัดบรรทัดทีละตัวอักษร · ตารางกว้างขึ้นแล้วเลื่อนในกล่องตัวเองแทน */}
                <td className="py-1.5 pr-3 align-top whitespace-nowrap">
                  <div>{s || '—'}</div>
                  {any && <div className="text-xs text-muted">{sizeText(any)}</div>}
                </td>
                {grades.map((g) => {
                  const c = cell(s, g);
                  return (
                    <td key={g} className="py-1.5 pr-3 text-right align-top">
                      {c ? <Price full={c.ราคาเต็มรวม_vat} sale={c.ราคาขายรวม_vat} pct={c.ส่วนลดปกติ_pct} />
                         : <span className="text-muted">·</span>}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** รุ่นที่มีเกรดเดียว — ไม่ต้องทำเป็นตาราง อ่านเป็นรายการง่ายกว่า */
function SimpleRows({ rows }: { rows: PriceRow[] }) {
  return (
    <ul className="divide-y divide-border/60 text-sm">
      {rows.map((r) => (
        <li key={r.variant_id} className="flex items-start justify-between gap-4 py-1.5">
          <div className="min-w-0">
            <div>{[r.รูปทรง, r.เกรดวัสดุ, r.ไม้ && `${r.ไม้}${r.สีไม้ ? ` ${r.สีไม้}` : ''}`]
              .filter(Boolean).join(' · ') || r.sku_display}</div>
            <div className="text-xs text-muted">{sizeText(r)}</div>
          </div>
          <div className="tabular-nums">
            <Price full={r.ราคาเต็มรวม_vat} sale={r.ราคาขายรวม_vat} pct={r.ส่วนลดปกติ_pct} />
          </div>
        </li>
      ))}
    </ul>
  );
}

const ALL = 'ทั้งหมด';

/** รายการตัวเลือก พร้อมจำนวนรุ่น · นับรุ่นไม่ใช่นับแถว เลขจะได้ตรงกับที่เห็นบนจอ */
function options(rows: PriceRow[], pick: (r: PriceRow) => string) {
  const m = new Map<string, Set<string>>();
  for (const r of rows) {
    const k = pick(r);
    if (!m.has(k)) m.set(k, new Set());
    m.get(k)!.add(r.product_id);
  }
  return [...m.entries()]
    .map(([name, ids]) => ({ name, n: ids.size }))
    .sort((a, b) => a.name.localeCompare(b.name, 'th'));
}

export default function PriceList({ rows }: { rows: PriceRow[] }) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState(ALL);
  const [coll, setColl] = useState(ALL);

  // รุ่นโชว์ครบทุกตัวเสมอ · ประเภทแคบลงตามรุ่นที่เลือก
  // เคยให้แคบลงทั้งสองทาง แล้วเจอทางตัน: พอเลือก ทากะ + สตูล
  // ช่องรุ่นเหลือแค่ ทากะ ตัวเดียว สลับไปรุ่นอื่นไม่ได้จนกว่าจะล้างประเภทก่อน
  const collOpts = useMemo(() => options(rows, (r) => r.รุ่น), [rows]);
  const catOpts = useMemo(
    () => options(rows.filter((r) => coll === ALL || r.รุ่น === coll), (r) => r.หมวด),
    [rows, coll],
  );

  // เปลี่ยนช่องหนึ่งแล้วอีกช่องอาจค้างค่าที่ไม่มีอยู่จริง ต้องรีเซ็ตให้
  function pickColl(v: string) {
    setColl(v);
    if (v !== ALL && cat !== ALL && !rows.some((r) => r.รุ่น === v && r.หมวด === cat)) setCat(ALL);
  }
  function pickCat(v: string) {
    setCat(v);
  }

  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const hit = (r: PriceRow) =>
      !needle ||
      r.รุ่น.toLowerCase().includes(needle) ||
      (r.ชื่ออังกฤษ ?? '').toLowerCase().includes(needle) ||
      r.หมวด.toLowerCase().includes(needle) ||
      r.sku_display.includes(needle);
    return groupByProduct(
      rows.filter(
        (r) => (cat === ALL || r.หมวด === cat) && (coll === ALL || r.รุ่น === coll) && hit(r),
      ),
    );
  }, [rows, q, cat, coll]);

  const variantCount = groups.reduce((n, g) => n + g.rows.length, 0);
  const filtered = q.trim() !== '' || cat !== ALL || coll !== ALL;
  const selectClass =
    'rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-text outline-none focus:border-accent';

  return (
    <>
      <div className="grid gap-2 print:hidden">
        <input
          id="price-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ค้นหารุ่น หมวด หรือ SKU"
          className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 outline-none focus:border-accent"
        />

        <div className="grid gap-2 sm:grid-cols-2">
          <label className="grid gap-1 text-xs text-muted" htmlFor="price-coll">
            รุ่น
            <select
              id="price-coll"
              value={coll}
              onChange={(e) => pickColl(e.target.value)}
              className={selectClass}
            >
              <option value={ALL}>ทุกรุ่น ({collOpts.length})</option>
              {collOpts.map((o) => (
                <option key={o.name} value={o.name}>
                  {o.name} ({o.n})
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 text-xs text-muted" htmlFor="price-cat">
            ประเภท
            <select
              id="price-cat"
              value={cat}
              onChange={(e) => pickCat(e.target.value)}
              className={selectClass}
            >
              <option value={ALL}>ทุกประเภท ({catOpts.length})</option>
              {catOpts.map((o) => (
                <option key={o.name} value={o.name}>
                  {o.name} ({o.n})
                </option>
              ))}
            </select>
          </label>
        </div>

        <p className="text-sm text-muted">
          {groups.length} รุ่น · {variantCount} ตัวสินค้า · ราคารวม VAT แล้ว
          {' · '}ตัวเลขขีดฆ่าคือราคาเต็ม ตัวเลขเขียวคือราคาขาย
          {filtered && (
            <>
              {' · '}
              <button
                type="button"
                onClick={() => {
                  setQ('');
                  setCat(ALL);
                  setColl(ALL);
                }}
                className="underline underline-offset-2"
              >
                ล้างตัวกรอง
              </button>
            </>
          )}
        </p>
      </div>

      <div className="mt-4 grid gap-4">
        {groups.map((g) => {
          const grades = new Set(g.rows.map((r) => r.เกรดวัสดุ).filter(Boolean));
          return (
            <section
              key={g.product_id}
              // min-w-0 สำคัญ · ไม่มีอันนี้ ตารางเกรดจะดันการ์ดให้กว้างกว่าจอบนมือถือ
              className="min-w-0 break-inside-avoid rounded-2xl border border-border bg-surface p-4"
            >
              <div className="flex gap-4">
                {g.รูป ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={g.รูป}
                    alt={g.รุ่น}
                    loading="lazy"
                    className="h-24 w-32 flex-none rounded-xl border border-border object-contain"
                  />
                ) : (
                  <div className="flex h-24 w-32 flex-none items-center justify-center rounded-xl border border-dashed border-border text-xs text-muted">
                    ยังไม่มีรูป
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold">
                    {g.รุ่น} <span className="font-normal text-muted">· {g.หมวด}</span>
                  </h2>
                  {g.ชื่ออังกฤษ && <p className="text-xs text-muted">{g.ชื่ออังกฤษ}</p>}
                  {g.หมายเหตุรุ่น && (
                    <p className="mt-1 text-xs text-warn">{g.หมายเหตุรุ่น}</p>
                  )}
                </div>
              </div>

              <div className="mt-3 min-w-0">
                {grades.size >= 2 ? <GradeMatrix rows={g.rows} /> : <SimpleRows rows={g.rows} />}
              </div>
            </section>
          );
        })}

        {groups.length === 0 && (
          <p className="py-10 text-center text-sm text-muted">ไม่พบรุ่นที่ตรงกับที่ค้นหา</p>
        )}
      </div>
    </>
  );
}
