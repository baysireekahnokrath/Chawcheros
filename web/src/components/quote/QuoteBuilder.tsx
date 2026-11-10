'use client';

/**
 * ออกใบเสนอราคาจากข้อความที่ลูกค้าส่งมา
 *
 * โจทย์จาก Bay (2026-11-10)
 *   "ได้รับ message แบบนี้จากลูกค้าปุ๊บ ออก Quotation ได้ภายใน 10 นาทีเลย"
 *
 * สามขั้น · วางข้อความ → ตรวจที่ระบบจับคู่มาให้ → พิมพ์
 *
 * ★ ระบบไม่เลือกสินค้าแทนคน
 *   จับคู่ให้ล่วงหน้าเฉพาะตอนที่ชัดจริง ๆ (ชื่ออังกฤษตรงและไม่มีตัวอื่นใกล้เคียง)
 *   ที่เหลือขึ้นเป็นรายชื่อให้กด · ไม่เจอก็บอกว่าไม่เจอ ไม่เดาให้
 *   เพราะเดาผิดหนึ่งบรรทัด = ใบเสนอราคาผิดที่ส่งออกไปแล้ว
 *
 * ★ เกรดวัสดุต้องเลือกเอง
 *   ลูกค้าเขียนชื่อผ้าจริง ("PVC SM Wheat") ใบราคาเก็บเป็นเกรด (ผ้า A/B/C)
 *   ระบบเทียบให้ไม่ได้ · ข้อความที่ลูกค้าเขียนถูกยกไปใส่บรรทัดวัสดุให้แล้ว
 */

import { useMemo, useState } from 'react';
import type { PriceRow } from '@/modules/pricing/queries';
import { parseRequest } from '@/modules/quote/parse';
import { buildProducts, confident, matchLine, type Hit } from '@/modules/quote/match';
import { BAHT, quoteNo, thaiDate, totalsOf, type Quote, type QuoteLine } from '@/modules/quote/doc';

type Row = {
  id: string;
  raw: string;
  spec: string;
  qty: number;
  pkey: string;
  gi: number;
  unit: number | null;
  free: string;
};

type Doc = {
  id: string;
  title: string;
  option: string;
  no: string;
  date: string;
  customer: string;
  address: string;
  tel: string;
  contact: string;
  deliverTo: string;
  deliverDate: string;
  note: string;
  salesperson: string;
  addVat: boolean;
  rows: Row[];
};

const uid = () => Math.random().toString(36).slice(2, 9);

const SAMPLE = `CLP
Option1
- Krata Lounge Chair PVC SM Wheat 3 ตัว
Option2
- Krata Lounge Chair PVC SM Wheat 2 ตัว
- Khonmai Stool PVC SM Wheat 1 ตัว
บริษัท ... จำกัด (สาขา 00016) เลขที่ 1693 ถนนพหลโยธิน แขวงจตุจักร เขตจตุจักร กรุงเทพมหานคร 10900`;

export default function QuoteBuilder({ rows }: { rows: PriceRow[] }) {
  const products = useMemo(() => buildProducts(rows), [rows]);
  const byKey = useMemo(() => new Map(products.map((p) => [p.key, p])), [products]);

  const [text, setText] = useState('');
  const [docs, setDocs] = useState<Doc[]>([]);
  const [seq, setSeq] = useState(1);
  const [showImg, setShowImg] = useState(true);
  const [toast, setToast] = useState('');

  /** ผู้เข้าชิงของทุกบรรทัดที่เปิดอยู่ · คิดครั้งเดียวต่อข้อความหนึ่งอัน */
  const cands = useMemo(() => {
    const m = new Map<string, Hit[]>();
    for (const d of docs)
      for (const r of d.rows)
        if (!r.free && r.raw && !m.has(r.raw)) m.set(r.raw, matchLine(r.raw, products));
    return m;
  }, [docs, products]);
  const hitsFor = (raw: string) => cands.get(raw) ?? [];

  function run() {
    const drafts = parseRequest(text);
    if (!drafts.length) { setToast('แกะไม่ออก · ลองใส่ขีดหน้าแต่ละรายการ เช่น "- Krata Lounge Chair 3 ตัว"'); return; }
    const out: Doc[] = drafts.map((d, i) => ({
      id: uid(),
      title: d.title, option: d.option,
      no: quoteNo(seq + i), date: thaiDate(),
      customer: d.customer, address: d.address, tel: d.tel, contact: '',
      deliverTo: '', deliverDate: '', note: '', salesperson: '',
      addVat: false,
      rows: d.lines.map((l) => {
        const h = matchLine(l.name || l.raw, products);
        const pick = confident(h) ? h[0].p : null;
        return {
          id: uid(), raw: l.name || l.raw, spec: l.spec, qty: l.qty,
          pkey: pick?.key ?? '', gi: 0,
          unit: pick ? (pick.variants[0].sale ?? pick.variants[0].retail) : null,
          free: '',
        };
      }),
    }));
    setDocs(out);
    setSeq(seq + out.length);
    setToast(`แกะได้ ${out.length} ใบ · ตรวจรายการที่ยังไม่ได้เลือกก่อนพิมพ์`);
  }

  const setDoc = (id: string, fn: (d: Doc) => Doc) =>
    setDocs((ds) => ds.map((d) => (d.id === id ? fn(d) : d)));
  const setRow = (did: string, rid: string, fn: (r: Row) => Row) =>
    setDoc(did, (d) => ({ ...d, rows: d.rows.map((r) => (r.id === rid ? fn(r) : r)) }));

  /** เลือกสินค้าให้บรรทัดนี้ · ราคาตั้งต้นคือเกรดแรกของสินค้านั้น */
  const choose = (did: string, rid: string, pkey: string) =>
    setRow(did, rid, (r) => {
      const p = byKey.get(pkey);
      const v = p?.variants[0];
      return { ...r, pkey, gi: 0, unit: v ? (v.sale ?? v.retail) : null };
    });

  const setGrade = (did: string, rid: string, gi: number) =>
    setRow(did, rid, (r) => {
      const v = byKey.get(r.pkey)?.variants[gi];
      return { ...r, gi, unit: v ? (v.sale ?? v.retail) : r.unit };
    });

  /** แปลงร่างเป็นใบจริงสำหรับพิมพ์ */
  const quoteOf = (d: Doc): Quote & { imgs: (string | null)[] } => {
    const lines: QuoteLine[] = [];
    const imgs: (string | null)[] = [];
    let n = 0;
    for (const r of d.rows) {
      const p = r.pkey ? byKey.get(r.pkey) : undefined;
      const v = p?.variants[r.gi];
      const isFree = !!r.free;
      lines.push({
        id: r.id,
        no: isFree ? '' : String(++n),
        head: isFree ? r.free : (p?.head ?? r.raw),
        // ลำดับตามใบจริง · วัสดุ แล้วค่อยขนาด · "ไม้โอ๊ค สีวอลนัท | ขนาด W120 D43.5 H79 cm"
        sub: isFree ? '' : [r.spec || v?.grade, p?.wood, p?.size && `ขนาด ${p.size} cm`]
          .filter(Boolean).join(' | '),
        colour: '',
        qty: r.qty,
        retail: isFree ? null : (v?.retail ?? null),
        unit: r.unit,
        image: p?.image ?? null,
      });
      imgs.push(p?.image ?? null);
    }
    return {
      no: d.no, date: d.date, customer: d.customer, address: d.address,
      tel: d.tel, line: d.contact, project: [d.title, d.option].filter(Boolean).join(' · '),
      deliverTo: d.deliverTo, deliverDate: d.deliverDate, note: d.note,
      salesperson: d.salesperson, lines, addVat: d.addVat, imgs,
    };
  };

  const unresolved = docs.reduce(
    (s, d) => s + d.rows.filter((r) => !r.pkey && !r.free).length, 0);

  /* ---------------- หน้าจอ ---------------- */
  return (
    <>
      {/* ---- ขั้นที่ 1 ---- */}
      <section className="no-print rounded-2xl border border-border bg-surface p-4">
        <h2 className="text-[0.7rem] font-semibold tracking-[0.12em] text-muted uppercase">
          1 · วางข้อความที่ลูกค้าส่งมา
        </h2>
        <p className="mt-0.5 mb-2 text-xs text-muted">
          วางทั้งก้อนได้เลย · หลายสาขา หลาย Option ระบบแยกเป็นคนละใบให้
        </p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          placeholder={SAMPLE}
          className="w-full rounded-xl border border-border bg-bg p-3 font-mono text-[0.8rem] outline-none focus:border-accent"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button" onClick={run} disabled={!text.trim()}
            className="rounded-xl bg-accent px-4 py-2.5 font-medium text-accent-fg disabled:opacity-50"
          >แกะข้อความ</button>
          {docs.length > 0 && (
            <>
              <button type="button" onClick={() => window.print()}
                className="rounded-xl border border-border px-4 py-2.5 font-medium">
                พิมพ์ / บันทึก PDF
              </button>
              <label className="flex items-center gap-2 rounded-xl border border-border px-3 py-2.5 text-sm">
                <input type="checkbox" checked={showImg} onChange={(e) => setShowImg(e.target.checked)} />
                แนบรูปสินค้า
              </label>
              <button type="button"
                onClick={() => { setDocs([]); setText(''); setToast('ล้างแล้ว'); }}
                className="rounded-xl border border-border px-4 py-2.5 text-sm">
                เริ่มใหม่
              </button>
            </>
          )}
        </div>
        {unresolved > 0 && (
          <p role="alert" className="mt-3 rounded-lg bg-warn/10 px-3 py-2 text-sm text-warn">
            ยังมี {unresolved} รายการที่ยังไม่ได้เลือกสินค้า · ใบจะพิมพ์ออกมาโดยไม่มีราคา
          </p>
        )}
      </section>

      {/* ---- ขั้นที่ 2 · ตรวจรายการ ---- */}
      {docs.map((d) => (
        <section key={d.id} className="no-print mt-4 rounded-2xl border border-border bg-surface p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h2 className="text-[0.7rem] font-semibold tracking-[0.12em] text-muted uppercase">
              2 · ตรวจรายการ
            </h2>
            <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
              {[d.title, d.option].filter(Boolean).join(' · ') || 'ใบที่ 1'}
            </span>
            <span className="font-mono text-xs text-muted">{d.no}</span>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="ชื่อลูกค้า" value={d.customer}
              onChange={(v) => setDoc(d.id, (x) => ({ ...x, customer: v }))} />
            <Field label="โทร" value={d.tel}
              onChange={(v) => setDoc(d.id, (x) => ({ ...x, tel: v }))} />
            <Field label="ที่อยู่" value={d.address} wide
              onChange={(v) => setDoc(d.id, (x) => ({ ...x, address: v }))} />
            <Field label="Line / Facebook" value={d.contact}
              onChange={(v) => setDoc(d.id, (x) => ({ ...x, contact: v }))} />
            <Field label="กำหนดส่ง" value={d.deliverDate}
              onChange={(v) => setDoc(d.id, (x) => ({ ...x, deliverDate: v }))} />
            <Field label="หมายเหตุ" value={d.note} wide
              onChange={(v) => setDoc(d.id, (x) => ({ ...x, note: v }))} />
            <Field label="พนักงานขาย" value={d.salesperson}
              onChange={(v) => setDoc(d.id, (x) => ({ ...x, salesperson: v }))} />
            <label className="flex items-center gap-2 self-end text-sm">
              <input type="checkbox" checked={d.addVat}
                onChange={(e) => setDoc(d.id, (x) => ({ ...x, addVat: e.target.checked }))} />
              แยก VAT 7% ท้ายใบ (ราคาในใบราคารวม VAT อยู่แล้ว)
            </label>
          </div>

          <div className="mt-4 space-y-3">
            {d.rows.map((r) => {
              const p = r.pkey ? byKey.get(r.pkey) : undefined;
              const cands = r.free ? [] : hitsFor(r.raw);
              return (
                <div key={r.id}
                  className={`rounded-xl border p-3 ${p || r.free ? 'border-border' : 'border-warn/50 bg-warn/5'}`}>
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="font-mono text-xs text-muted">ลูกค้าเขียน</span>
                    <b className="text-sm">{r.raw}</b>
                    {r.spec && <span className="text-xs text-muted">· {r.spec}</span>}
                  </div>

                  {!r.free && (
                    <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
                      <select
                        value={r.pkey} aria-label={`เลือกสินค้าให้ ${r.raw}`}
                        onChange={(e) => choose(d.id, r.id, e.target.value)}
                        className="w-full rounded-lg border border-border bg-bg px-2 py-2 text-sm"
                      >
                        <option value="">— ยังไม่ได้เลือก —</option>
                        {cands.map((h) => (
                          <option key={h.p.key} value={h.p.key}>
                            {h.p.head.replace('ฌ เฌอ | ', '')} · {h.p.size}
                          </option>
                        ))}
                        {p && !cands.some((h) => h.p.key === p.key) && (
                          <option value={p.key}>{p.head.replace('ฌ เฌอ | ', '')} · {p.size}</option>
                        )}
                      </select>

                      <select
                        value={r.gi} disabled={!p} aria-label="เกรดวัสดุ"
                        onChange={(e) => setGrade(d.id, r.id, +e.target.value)}
                        className="rounded-lg border border-border bg-bg px-2 py-2 text-sm disabled:opacity-40"
                      >
                        {(p?.variants ?? []).map((v, i) => (
                          <option key={i} value={i}>
                            {v.grade || 'แบบเดียว'} · {BAHT(v.sale ?? v.retail)}
                          </option>
                        ))}
                      </select>

                      <input
                        type="number" min={1} value={r.qty} aria-label="จำนวน"
                        onChange={(e) => setRow(d.id, r.id, (x) => ({ ...x, qty: Math.max(1, +e.target.value || 1) }))}
                        className="w-20 rounded-lg border border-border bg-bg px-2 py-2 text-right text-sm"
                      />
                      <input
                        type="number" value={r.unit ?? ''} aria-label="ราคาต่อหน่วย"
                        onChange={(e) => setRow(d.id, r.id, (x) => ({ ...x, unit: e.target.value === '' ? null : +e.target.value }))}
                        className="w-28 rounded-lg border border-border bg-bg px-2 py-2 text-right text-sm"
                      />
                    </div>
                  )}

                  {r.free && (
                    <input
                      value={r.free} aria-label="รายการอิสระ"
                      onChange={(e) => setRow(d.id, r.id, (x) => ({ ...x, free: e.target.value }))}
                      className="mt-2 w-full rounded-lg border border-border bg-bg px-2 py-2 text-sm"
                    />
                  )}

                  {!p && !r.free && (
                    <p className="mt-2 text-xs text-warn">
                      ยังไม่เจอตัวที่ตรง · เลือกจากรายชื่อ หรือถ้าไม่มีในใบราคาให้ลบบรรทัดนี้แล้วใส่เป็นรายการอิสระ
                    </p>
                  )}

                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <button type="button"
                      onClick={() => setDoc(d.id, (x) => ({ ...x, rows: x.rows.filter((y) => y.id !== r.id) }))}
                      className="rounded-md border border-border px-2 py-1">ลบบรรทัด</button>
                    {p && <span className="self-center text-muted">{p.sub}</span>}
                  </div>
                </div>
              );
            })}

            <div className="flex flex-wrap gap-2">
              <button type="button"
                onClick={() => setDoc(d.id, (x) => ({ ...x, rows: [...x.rows,
                  { id: uid(), raw: '', spec: '', qty: 1, pkey: '', gi: 0, unit: null, free: '' }] }))}
                className="rounded-lg border border-border px-3 py-2 text-sm">+ เพิ่มสินค้า</button>
              <button type="button"
                onClick={() => setDoc(d.id, (x) => ({ ...x, rows: [...x.rows,
                  { id: uid(), raw: 'ค่าขนส่ง', spec: '', qty: 1, pkey: '', gi: 0, unit: null, free: 'ค่าขนส่ง' }] }))}
                className="rounded-lg border border-border px-3 py-2 text-sm">+ ค่าขนส่ง / รายการอิสระ</button>
            </div>
          </div>
        </section>
      ))}

      {/* ---- ขั้นที่ 3 · ใบจริง ---- */}
      {docs.map((d, i) => (
        <Sheet key={`s-${d.id}`} q={quoteOf(d)} showImg={showImg} first={i === 0} />
      ))}

      {toast && (
        <div role="status" className="no-print fixed bottom-5 left-1/2 z-30 -translate-x-1/2 rounded-full bg-accent px-4 py-2 text-sm text-accent-fg">
          {toast}
          <button type="button" onClick={() => setToast('')} className="ml-3 opacity-70">✕</button>
        </div>
      )}
    </>
  );
}

function Field({ label, value, onChange, wide }: {
  label: string; value: string; onChange: (v: string) => void; wide?: boolean;
}) {
  return (
    <label className={`block text-xs ${wide ? 'sm:col-span-2' : ''}`}>
      <span className="text-muted">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-border bg-bg px-2 py-2 text-sm" />
    </label>
  );
}

/* ---------------------------------------------------------------------------
   ใบจริง · วางตามไฟล์ Quotation template 2026 ที่ Bay ใช้อยู่
   --------------------------------------------------------------------------- */
function Sheet({ q, showImg, first }: {
  q: Quote & { imgs: (string | null)[] }; showImg: boolean; first: boolean;
}) {
  const t = totalsOf(q);
  return (
    <section
      className={`quote-sheet mt-6 rounded-2xl border border-border bg-white p-6 text-black ${first ? '' : 'page-break'}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-wide">QUOTATION</h2>
          <p className="text-sm">ใบเสนอราคา</p>
        </div>
        <table className="text-xs">
          <tbody>
            <tr><td className="pr-3 text-right">วันที่ Date:</td><td className="font-medium">{q.date}</td></tr>
            <tr><td className="pr-3 text-right">เลขที่ No:</td><td className="font-mono font-medium">{q.no}</td></tr>
          </tbody>
        </table>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-6 text-[0.72rem] leading-snug">
        <div>
          <p>856 M.4 Bangpoo Industrial Estate</p>
          <p>Soi 11B T. Praeksa A. Muang</p>
          <p>Samutprakarn 10280</p>
          <p>T: 063-829-9536&nbsp;&nbsp;&nbsp;&nbsp;F: 02-709-4522</p>
          <p>E: info@chawcher.com</p>
          <p>Official Line ID: @Chawcher</p>
        </div>
        <div>
          <p className="text-muted-foreground">ชื่อ และที่อยู่ลูกค้า</p>
          <p className="font-medium">{q.customer || '—'}</p>
          <p>{q.address}</p>
          {q.project && <p>โครงการ {q.project}</p>}
          <p className="mt-1">โทร (Tel) {q.tel}</p>
          {q.line && <p>Line / Facebook {q.line}</p>}
        </div>
      </div>

      <p className="mt-3 border-y border-black/30 py-1 text-[0.7rem]">
        สถานที่จัดส่ง Place of delivery {q.deliverTo}
        <span className="float-right">กำหนดส่ง Delivery date {q.deliverDate}</span>
      </p>

      <table className="mt-3 w-full border-collapse text-[0.72rem]">
        <thead>
          <tr className="border-b border-black/40 text-left">
            <th className="w-8 py-1">No.</th>
            {showImg && <th className="w-14 py-1">รูป</th>}
            <th className="py-1">รายการสินค้า Descriptions</th>
            <th className="w-16 py-1 text-right">จำนวน<br />QTY</th>
            <th className="w-24 py-1 text-right">ราคา / หน่วย<br />Unit Price</th>
            <th className="w-24 py-1 text-right">จำนวนเงิน<br />Amount</th>
          </tr>
        </thead>
        <tbody>
          {q.lines.map((l, i) => (
            <tr key={l.id} className="border-b border-black/10 align-top">
              <td className="py-1.5">{l.no}</td>
              {showImg && (
                <td className="py-1.5">
                  {q.imgs[i] && (
                    // ใช้ <img> ตรง ๆ · รูปมาจาก chawcher.com ซึ่งเป็นโดเมนนอก
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={q.imgs[i]!} alt="" className="h-12 w-12 rounded object-cover" />
                  )}
                </td>
              )}
              <td className="py-1.5">
                <div>{l.head}</div>
                {l.sub && <div className="text-black/60">{l.sub}</div>}
              </td>
              <td className="py-1.5 text-right">{l.qty}</td>
              <td className="py-1.5 text-right">
                {l.retail != null && l.retail !== l.unit && (
                  <div className="text-black/50 line-through">{BAHT(l.retail)}</div>
                )}
                <div>{BAHT(l.unit)}</div>
              </td>
              <td className="py-1.5 text-right">{l.unit == null ? '' : BAHT(l.unit * l.qty)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="text-[0.76rem]">
          <tr><td colSpan={showImg ? 4 : 3} /><td className="pt-2 text-right">รวม Total</td>
            <td className="pt-2 text-right font-medium">{BAHT(t.sub)}</td></tr>
          <tr><td colSpan={showImg ? 4 : 3} /><td className="text-right">ภาษีมูลค่าเพิ่ม VAT 7%</td>
            <td className="text-right">{t.vat == null ? '' : BAHT(t.vat)}</td></tr>
          <tr className="font-semibold"><td colSpan={showImg ? 4 : 3} />
            <td className="text-right">จำนวนเงินรวมทั้งสิ้น Grand Total</td>
            <td className="text-right">{BAHT(t.grand)}</td></tr>
        </tfoot>
      </table>

      {q.note && <p className="mt-2 text-[0.7rem]">หมายเหตุ: {q.note}</p>}
      {t.saved > 0 && (
        <p className="mt-1 text-[0.7rem] text-black/60">ส่วนลดรวม {BAHT(t.saved)} บาท</p>
      )}

      <div className="mt-8 text-[0.68rem] leading-relaxed">
        <p className="mb-6">{q.salesperson}</p>
        <p>พนักงานขาย Salesperson</p>
        <p className="mt-4">
          ข้าพเจ้ายินยอมและตกลงสั่งซื้อสินค้าตามรายการข้างต้นโดยตกลงว่า
          ข้าพเจ้าจะไม่มีกรรมสิทธิ์ในสินค้าจนกว่าข้าพเจ้าจะชำระค่าสินค้าครบถ้วน
        </p>
        <p className="mt-6">ลายเซ็นผู้สั่งซื้อ Customer&apos;s Signature ______________________ วันที่ Date __________</p>
        <p className="mt-2">บริษัทฯ ขอสงวนลิขสิทธิ์ในการพิจารณาไม่คืนเงินมัดจำ เนื่องจากการยกเลิกการสั่งซื้อ</p>
      </div>
    </section>
  );
}
