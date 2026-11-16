'use client';

/**
 * เพิ่มสินค้าใหม่เข้าฐานข้อมูล · /catalog/new
 *
 * โจทย์จาก Bay (2026-11-16)
 *   "วางลงไปแค่ชื่อสินค้าพร้อมขนาด จากนั้นดึง database ขึ้นมาโชว์
 *    พร้อมบอกว่าใช่หรือไม่ แล้ว recommended price"
 *
 * ★ สามอย่างที่หน้านี้ไม่ทำ
 *   1 ไม่เดาว่าตรงกับตัวไหน — เสนอผู้เข้าชิงให้คนกดเลือก (ใช้ตัวจับคู่ตัวเดียวกับ /quotes)
 *   2 ไม่ตั้งราคาเอง — เสนอราคาแนะนำพร้อมบอกว่าคิดมายังไง แก้ได้ทุกตัว
 *   3 ไม่บันทึกจนกว่าจะกดยืนยัน — SKU ออกแล้วออกเลย ใช้ซ้ำไม่ได้ (กฎ A3)
 */

import { Fragment, useMemo, useState } from 'react';
import type { PriceRow } from '@/modules/pricing/queries';
import { buildProducts, matchLine, sizeText, type Product } from '@/modules/quote/match';
import {
  DEFAULT_FIXED, basisFor, dimText, parseSize, proportional, suggestPrice,
  type Dim, type Point,
} from '@/modules/catalog/suggest-price';
import { addVariantResize } from '@/modules/catalog/actions';

const baht = (n: number | null | undefined) =>
  n === null || n === undefined ? '—' : n.toLocaleString('th-TH', { maximumFractionDigits: 0 });

/**
 * ตัวที่มีอยู่แล้ว "ตัวเดียวกันทุกอย่าง ยกเว้นขนาด" · ใช้เป็นหลักฐานตั้งราคา
 *
 * ★ ต้องเทียบรูปทรงกับไม้ด้วย ไม่ใช่แค่รุ่น+หมวด+เกรด
 *   โต๊ะกลางฟีนิกซ์มีสองแบบที่ขนาดเท่ากันเป๊ะ — ท็อปไม้โอ๊ค 45,000 กับ
 *   ท็อปหินสังเคราะห์ 49,000 · ถ้ากรองหยาบไป สองตัวนี้จะถูกเฉลี่ยเป็น 47,000
 *   แล้วราคาแนะนำเพี้ยนทั้งคู่ (เจอตอนกดจริงในเบราว์เซอร์ 2026-11-16)
 *
 * key ของ Product คือ รุ่น|หมวด|รูปทรง|w|d|h|ไม้|สีไม้ (ดู buildProducts)
 * เอาช่องที่ไม่ใช่ขนาดมาเทียบ จึงได้ "ตัวเดียวกัน คนละขนาด" พอดี
 */
function pointsFor(rows: PriceRow[], p: Product, grade: string): Point[] {
  const k = p.key.split('|');
  const [col, cat, shape, , , , wood, woodCol] = k;
  const same = (r: PriceRow) =>
    (r.รุ่น ?? '').trim() === col && (r.หมวด ?? '').trim() === cat &&
    (r.รูปทรง ?? '').trim() === shape &&
    (r.ไม้ ?? '').trim() === wood && (r.สีไม้ ?? '').trim() === woodCol;

  return rows
    .filter((r) => same(r) && (r.เกรดวัสดุ ?? '') === grade && (r.ราคาเต็มรวม_vat ?? 0) > 0)
    .map((r) => ({
      w: r.กว้าง, d: r.ลึก, h: r.สูง,
      retail: r.ราคาเต็มรวม_vat as number,
      label: [r.รูปทรง, sizeText(r.กว้าง, r.ลึก, r.สูง)].filter(Boolean).join(' · '),
    }));
}

function Field({ label, value, onChange, suffix = '', wide = false }: {
  label: string; value: string; onChange: (v: string) => void; suffix?: string; wide?: boolean;
}) {
  return (
    <label className={`block ${wide ? 'col-span-2' : ''}`}>
      <span className="text-xs text-muted">{label}</span>
      <span className="mt-0.5 flex items-center gap-1">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          inputMode="decimal"
          className="w-full rounded-lg border border-border bg-bg px-2 py-1.5 text-sm tabular-nums outline-none focus:border-accent"
        />
        {suffix && <span className="shrink-0 text-xs text-muted">{suffix}</span>}
      </span>
    </label>
  );
}

/** หนึ่งบรรทัดที่คนวางมา · มีสถานะของตัวเอง ไม่ยุ่งกับบรรทัดอื่น */
function LineCard({ raw, rows, products }: { raw: string; rows: PriceRow[]; products: Product[] }) {
  const hits = useMemo(() => matchLine(raw, products, 6), [raw, products]);
  const guess = useMemo(() => parseSize(raw), [raw]);

  const [pickKey, setPickKey] = useState<string>('');
  const [grade, setGrade] = useState<string>('');
  const [w, setW] = useState(guess.w ? String(guess.w) : '');
  const [d, setD] = useState(guess.d ? String(guess.d) : '');
  const [h, setH] = useState(guess.h ? String(guess.h) : '');
  const [fixed, setFixed] = useState(String(Math.round(DEFAULT_FIXED * 100)));
  const [price, setPrice] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ sku: string } | null>(null);
  const [err, setErr] = useState('');

  const picked = products.find((p) => p.key === pickKey) ?? null;
  const grades = picked ? picked.variants.map((v) => v.grade) : [];
  const useGrade = grade || grades[0] || '';
  const baseVariant = picked?.variants.find((v) => v.grade === useGrade) ?? null;

  const target: Dim = {
    w: w.trim() ? Number(w) : null,
    d: d.trim() ? Number(d) : null,
    h: h.trim() ? Number(h) : null,
  };
  const basis = picked ? basisFor(picked.category) : 'พื้นที่';
  const points = picked ? pointsFor(rows, picked, useGrade) : [];
  const fixedNum = Math.min(Math.max(Number(fixed) || 0, 0), 100) / 100;
  const sug = picked ? suggestPrice(points, target, basis, fixedNum) : null;
  const prop = picked ? proportional(points, target, basis) : null;

  const shownPrice = price.trim() ? Number(price) : (sug?.price ?? 0);

  function choose(key: string) {
    setPickKey(key);
    setGrade('');
    setPrice('');
    setErr('');
    const p = products.find((x) => x.key === key);
    // ขนาดไหนที่คนไม่ได้เขียนมา ให้ยืมของตัวที่เลือกไว้ก่อน แก้ได้
    if (p) {
      if (!w.trim() && p.w) setW(String(p.w));
      if (!d.trim() && p.d) setD(String(p.d));
      if (!h.trim() && p.h) setH(String(p.h));
    }
  }

  async function save() {
    if (!baseVariant) return;
    setBusy(true); setErr('');
    const r = await addVariantResize({
      baseVariantId: baseVariant.variant_id,
      width: Number(w),
      depth: d.trim() ? Number(d) : null,
      height: h.trim() ? Number(h) : null,
      price: shownPrice,
      note,
    });
    setBusy(false);
    if (r.ok) setDone({ sku: r.skuDisplay || r.sku });
    else setErr(r.error);
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-ok/40 bg-ok/5 p-4">
        <p className="text-sm font-medium">เพิ่มเข้าฐานข้อมูลแล้ว</p>
        <p className="mt-1 text-xs text-muted">{raw}</p>
        <p className="mt-2 text-sm">
          SKU <span className="font-semibold tabular-nums">{done.sku}</span> ·{' '}
          {dimText(target)} cm · ราคาเต็ม {baht(shownPrice)} บาท
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <p className="text-sm font-medium">{raw}</p>
      <p className="mt-0.5 text-xs text-muted">
        ขนาดที่แกะได้ {dimText(guess) || '— ไม่เจอตัวเลขขนาด'}
      </p>

      {/* ── ผู้เข้าชิงจากฐานข้อมูล ── */}
      {hits.length === 0 && (
        <p className="mt-3 rounded-lg bg-warn/10 px-3 py-2 text-sm text-warn">
          ไม่เจอรุ่นที่ใกล้เคียงในฐานข้อมูล — ถ้าเป็นรุ่นใหม่ทั้งรุ่น ต้องนำเข้าจากไฟล์ราคาแทน
        </p>
      )}

      {hits.length > 0 && (
        <div className="mt-3">
          <p className="text-xs text-muted">ใช่ตัวนี้ไหม</p>
          <div className="mt-1.5 space-y-1.5">
            {hits.map((hit) => (
              <button
                key={hit.p.key}
                type="button"
                onClick={() => choose(hit.p.key)}
                className={`block w-full rounded-xl border px-3 py-2 text-left text-sm ${
                  pickKey === hit.p.key
                    ? 'border-accent bg-accent/10'
                    : 'border-border bg-bg hover:border-accent/50'
                }`}
              >
                <span className="font-medium">{hit.p.head}</span>
                <span className="mt-0.5 block text-xs text-muted">
                  {hit.p.sub || 'ไม่ระบุขนาด'} · {hit.p.variants.length} เกรด ·{' '}
                  เต็ม {baht(hit.p.variants[0]?.retail)} บาท
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── เลือกแล้ว · ขนาดใหม่ + ราคาแนะนำ ── */}
      {picked && (
        <div className="mt-4 border-t border-border pt-4">
          {grades.length > 1 && (
            <div className="mb-3">
              <p className="text-xs text-muted">เกรดวัสดุของตัวใหม่</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {grades.map((g) => (
                  <button
                    key={g || 'ไม่ระบุ'}
                    type="button"
                    onClick={() => { setGrade(g); setPrice(''); }}
                    className={`rounded-full border px-3 py-1 text-xs ${
                      useGrade === g ? 'border-accent bg-accent/10' : 'border-border bg-bg'
                    }`}
                  >
                    {g || 'ไม่ระบุเกรด'}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            <Field label="กว้าง" value={w} onChange={(v) => { setW(v); setPrice(''); }} suffix="cm" />
            <Field label="ลึก" value={d} onChange={(v) => { setD(v); setPrice(''); }} suffix="cm" />
            <Field label="สูง" value={h} onChange={(v) => { setH(v); setPrice(''); }} suffix="cm" />
          </div>

          {!sug && (
            <p className="mt-3 rounded-lg bg-warn/10 px-3 py-2 text-sm text-warn">
              {basis === 'พื้นที่'
                ? 'หมวดนี้คิดราคาจากพื้นที่ ต้องใส่ทั้งกว้างและลึก'
                : 'ต้องใส่ความกว้าง'}
            </p>
          )}

          {sug && (
            <div className="mt-3 rounded-xl border border-border bg-bg p-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs text-muted">ราคาเต็มที่แนะนำ</span>
                <span className="text-xl font-semibold tabular-nums">{baht(sug.price)}</span>
              </div>
              <p className="mt-1 text-xs text-muted">{sug.how}</p>

              {sug.warn && (
                <p className="mt-2 rounded-lg bg-warn/10 px-2 py-1 text-xs text-warn">{sug.warn}</p>
              )}

              {sug.method === 'สมมติส่วนคงที่' && (
                <label className="mt-2 flex items-center gap-2 text-xs text-muted">
                  ส่วนคงที่
                  <input
                    value={fixed}
                    onChange={(e) => { setFixed(e.target.value); setPrice(''); }}
                    inputMode="numeric"
                    className="w-14 rounded-lg border border-border bg-surface px-2 py-1 text-right tabular-nums outline-none focus:border-accent"
                  />
                  %
                  <span className="text-[11px]">ของราคาที่ไม่เปลี่ยนตามขนาด</span>
                </label>
              )}

              <details className="mt-2">
                <summary className="cursor-pointer text-xs text-muted">
                  คิดมาจากอะไร · เทียบบัญญัติไตรยางศ์
                </summary>
                <table className="mt-2 w-full text-xs">
                  <tbody>
                    {sug.used.map((pt, i) => (
                      <Fragment key={i}>
                        <tr className="border-t border-border">
                          <td className="py-1 text-muted">{pt.label || dimText(pt)}</td>
                          <td className="py-1 text-right tabular-nums">{baht(pt.retail)}</td>
                        </tr>
                      </Fragment>
                    ))}
                    <tr className="border-t border-border">
                      <td className="py-1 text-muted">ไตรยางศ์ตาม{basis}ล้วน ๆ</td>
                      <td className="py-1 text-right tabular-nums text-muted">
                        {prop ? baht(Math.round(prop)) : '—'}
                      </td>
                    </tr>
                    <tr className="border-t border-border">
                      <td className="py-1 font-medium">แนะนำ ({sug.method})</td>
                      <td className="py-1 text-right font-semibold tabular-nums">{baht(sug.price)}</td>
                    </tr>
                  </tbody>
                </table>
                <p className="mt-2 text-[11px] leading-relaxed text-muted">
                  ไตรยางศ์ล้วนต่ำเกินจริง เพราะย่อขนาดแล้วของที่หายไปมีแค่ท็อปหรือที่นั่ง ·
                  เฟรม ขา พ่นสี ประกอบ แพ็ก ส่ง เท่าเดิม และงานสั่งทำยังเพิ่มงานวางแบบด้วย
                </p>
              </details>
            </div>
          )}

          <div className="mt-3 grid grid-cols-2 gap-2">
            <Field
              label="ราคาเต็มที่จะบันทึก"
              value={price || (sug ? String(sug.price) : '')}
              onChange={setPrice}
              suffix="บาท"
            />
            <label className="block">
              <span className="text-xs text-muted">หมายเหตุ</span>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="เช่น ลูกค้าคุณ Prite สั่งพิเศษ"
                className="mt-0.5 w-full rounded-lg border border-border bg-bg px-2 py-1.5 text-sm outline-none focus:border-accent"
              />
            </label>
          </div>

          {err && (
            <p role="alert" className="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
              {err}
            </p>
          )}

          <button
            type="button"
            disabled={busy || !sug || !baseVariant || !(shownPrice > 0)}
            onClick={save}
            className="mt-3 w-full rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-accent-fg disabled:opacity-50"
          >
            {busy ? 'กำลังบันทึก…' : `เพิ่ม ${dimText(target)} เข้าฐานข้อมูล · SKU ออกตอนนี้`}
          </button>
          <p className="mt-1.5 text-[11px] text-muted">
            SKU ออกแล้วออกเลย ใช้ซ้ำไม่ได้ · ตรวจชื่อรุ่น เกรด และขนาดให้ชัวร์ก่อนกด
          </p>
        </div>
      )}
    </div>
  );
}

export default function NewProduct({ rows }: { rows: PriceRow[] }) {
  const products = useMemo(() => buildProducts(rows), [rows]);
  const [text, setText] = useState('');
  const [lines, setLines] = useState<string[]>([]);

  function run() {
    setLines(
      text.split(/\r?\n/).map((s) => s.replace(/\s+/g, ' ').trim())
        .filter((s) => s.length > 1),
    );
  }

  return (
    <>
      <div className="rounded-2xl border border-border bg-surface p-4">
        <label className="block text-sm font-medium" htmlFor="paste">
          วางชื่อสินค้าพร้อมขนาด · บรรทัดละ 1 รายการ
        </label>
        <textarea
          id="paste"
          rows={5}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'Phoenix Coffee table 60*120 cm\nKrasa Tv Cabinet 200 cm walnut\nโซฟาทากะ กว้าง 234'}
          className="mt-2 w-full rounded-xl border border-border bg-bg p-3 font-mono text-sm outline-none focus:border-accent"
        />
        <div className="mt-2 flex items-center gap-3">
          <button
            type="button"
            onClick={run}
            disabled={!text.trim()}
            className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-accent-fg disabled:opacity-50"
          >
            ค้นในฐานข้อมูล
          </button>
          <span className="text-xs text-muted">{products.length} รุ่น-ขนาด ในระบบ</span>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {lines.map((l, i) => (
          <LineCard key={`${i}-${l}`} raw={l} rows={rows} products={products} />
        ))}
      </div>
    </>
  );
}
