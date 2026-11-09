'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  GRADES, canPick, cellOf, isSofa, planSrc, variantName, variantOf,
  type Item, type Pick,
} from '@/modules/phoenix/build';

const BAHT = (n: number | null | undefined) =>
  n == null ? '—' : n.toLocaleString('th-TH', { maximumFractionDigits: 0 });

type Sel = Pick & { key: string; ii: number; kind: 'g' | 'e'; ci: number; qty: number;
                    mir: boolean; rot: boolean };

const keyOf = (ii: number, kind: string, ci: number) => `${ii}|${kind}|${ci}`;

/* ของที่ต่อกับตัวโซฟาได้ · สตูล หมอน ที่พักหัว โต๊ะ ตู้ วางลอย ไม่นับความกว้าง */
const attached = (it: Item) => it.cat === 'โซฟา';

type Block = {
  key: string; label: string; code: string;
  ow: number; od: number; w: number; d: number;
  img: string | null; mir: boolean; rot: boolean;
};

export default function Configurator({ items }: { items: Item[] }) {
  const [picked, setPicked] = useState<Sel[]>([]);
  const [fallback, setFallback] = useState('');
  const [png, setPng] = useState('');
  const [toast, setToast] = useState('');
  const planBox = useRef<HTMLDivElement>(null);
  const [boxW, setBoxW] = useState(640);

  useEffect(() => {
    const read = () => setBoxW(Math.max(240, (planBox.current?.clientWidth ?? 640) - 22));
    read();
    window.addEventListener('resize', read);
    return () => window.removeEventListener('resize', read);
  }, [picked.length]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 2300);
    return () => clearTimeout(t);
  }, [toast]);

  const find = (k: string) => picked.find((p) => p.key === k);
  const mutate = (k: string, fn: (p: Sel) => Sel) =>
    setPicked((ps) => ps.map((p) => (p.key === k ? fn(p) : p)));

  const add = (ii: number, kind: 'g' | 'e', ci: number) => {
    const k = keyOf(ii, kind, ci);
    setPicked((ps) => {
      const hit = ps.find((p) => p.key === k);
      if (hit) return ps.map((p) => (p.key === k ? { ...p, qty: p.qty + 1 } : p));
      const it = items[ii];
      let arm: Pick['arm'] = 'both';
      if (isSofa(it) && !canPick(it, 'both', false, 'R'))
        arm = canPick(it, 'one', false, 'R') ? 'one' : 'none';
      return [...ps, { key: k, ii, kind, ci, qty: 1, v: 0, mir: false, rot: false,
                       arm, side: 'R', tbl: false }];
    });
    setPng('');
  };
  const bump = (k: string, d: number) => {
    setPicked((ps) => ps.flatMap((p) =>
      p.key !== k ? [p] : p.qty + d <= 0 ? [] : [{ ...p, qty: p.qty + d }]));
    setPng('');
  };
  const movePick = (k: string, d: number) => {
    setPicked((ps) => {
      const i = ps.findIndex((p) => p.key === k), j = i + d;
      if (i < 0 || j < 0 || j >= ps.length) return ps;
      const out = [...ps];
      [out[i], out[j]] = [out[j], out[i]];
      return out;
    });
    setPng('');
  };
  /* เปลี่ยนแกนใดแกนหนึ่ง แล้วถ้าผลลัพธ์เป็นแบบที่ไม่มีจริง ให้ถอยไปแบบที่มี */
  const setVar = (k: string, field: 'arm' | 'side' | 'tbl' | 'v', val: unknown) => {
    const p = find(k); if (!p) return;
    const it = items[p.ii];
    const next: Sel = { ...p, [field]: val } as Sel;
    if (isSofa(it) && !canPick(it, next.arm, next.tbl, next.side)) {
      if (field === 'tbl' && val === true && next.arm === 'both') next.arm = 'one';
      if (!canPick(it, next.arm, next.tbl, next.side)) {
        next.side = next.side === 'R' ? 'L' : 'R';
        if (!canPick(it, next.arm, next.tbl, next.side)) return;
      }
    }
    mutate(k, () => next);
    setPng('');
  };
  const toggle = (k: string, f: 'mir' | 'rot') => {
    mutate(k, (p) => ({ ...p, [f]: !p[f] }));
    setPng('');
  };

  /* ---------------- ตัวเลข ---------------- */
  const lineOf = useCallback((p: Sel) => {
    const it = items[p.ii];
    const c = cellOf(it, p, p.kind, p.ci);
    return {
      it,
      name: p.kind === 'e' ? it.extra[p.ci]?.label ?? '' : GRADES[p.ci],
      full: (c?.full ?? 0) * p.qty,
      sale: (c?.sale ?? c?.full ?? 0) * p.qty,
      disc: c?.disc ?? 0,
      ask: !c || c.full == null,
    };
  }, [items]);

  const totals = useMemo(() => {
    let full = 0, sale = 0, ask = 0;
    picked.forEach((p) => {
      const l = lineOf(p);
      if (l.ask) { ask++; return; }
      full += l.full; sale += l.sale;
    });
    return { full, sale, save: full - sale, ask };
  }, [picked, lineOf]);

  const blocks = useMemo<Block[]>(() => {
    const out: Block[] = [];
    picked.forEach((p) => {
      const it = items[p.ii];
      if (!attached(it) || !it.w) return;
      const dr = variantOf(it, p);
      const ow = dr ? dr.w / 10 : it.w;
      const od = dr ? dr.d / 10 : (it.d ?? 90);
      for (let i = 0; i < p.qty; i++)
        out.push({ key: p.key, label: it.label, code: dr ? dr.code : it.code,
                   ow, od, w: p.rot ? od : ow, d: p.rot ? ow : od,
                   img: dr ? planSrc(dr.code) : null, mir: p.mir, rot: p.rot });
    });
    return out;
  }, [picked, items]);

  const span = useMemo(() => ({
    w: blocks.reduce((s, x) => s + x.w, 0),
    d: Math.max(0, ...blocks.map((x) => x.d)),
  }), [blocks]);

  /* ---------------- ลากสลับตำแหน่ง ---------------- */
  const dragFrom = useRef(-1);
  const swapBlocks = (a: number, b: number) => {
    const ka = blocks[a]?.key, kb = blocks[b]?.key;
    if (!ka || !kb || ka === kb) return;
    setPicked((ps) => {
      const ia = ps.findIndex((p) => p.key === ka), ib = ps.findIndex((p) => p.key === kb);
      if (ia < 0 || ib < 0) return ps;
      const out = [...ps];
      [out[ia], out[ib]] = [out[ib], out[ia]];
      return out;
    });
    setPng('');
  };

  /* ---------------- รูปไว้บันทึก ---------------- */
  const makePng = async () => {
    if (!blocks.length) { setToast('ยังไม่มีอะไรในแบบแปลน'); return; }
    const totW = span.w, maxD = span.d;
    const SC = Math.min(5, 1500 / totW);
    const PAD = 40, HEAD = 54, DIM = 104, RIGHT = 62;
    const cv = document.createElement('canvas');
    cv.width = Math.round(totW * SC + PAD + RIGHT);
    cv.height = Math.round(maxD * SC + HEAD + DIM);
    const g = cv.getContext('2d');
    if (!g) return;
    const F = '"Noto Sans Thai",sans-serif';
    const INK = '#2B4368', GREY = '#8a9aa8', TXT = '#38424d';

    g.fillStyle = '#ffffff'; g.fillRect(0, 0, cv.width, cv.height);
    g.fillStyle = INK; g.font = `600 20px ${F}`;
    g.fillText('ฌ เฌอ · ฟีนิกซ์ (Phoenix Sofa)', PAD, 30);

    const load = (src: string) => new Promise<HTMLImageElement>((ok, no) => {
      const im = new Image();
      im.onload = () => ok(im);
      im.onerror = () => no(new Error('img'));
      im.src = src;
    });

    let x = PAD;
    for (const k of blocks) {
      const w = k.w * SC, h = k.d * SC;
      let drawn = false;
      if (k.img) {
        try {
          const im = await load(k.img);
          g.save();
          g.translate(x + w / 2, HEAD + h / 2);
          if (k.rot) g.rotate(Math.PI / 2);
          if (k.mir) g.scale(-1, 1);
          g.drawImage(im, -k.ow * SC / 2, -k.od * SC / 2, k.ow * SC, k.od * SC);
          g.restore();
          drawn = true;
        } catch { /* โหลดรูปไม่ได้ ตกไปวาดกรอบแทน */ }
      }
      if (!drawn) {
        g.strokeStyle = GREY; g.lineWidth = 1.5;
        g.strokeRect(x + .5, HEAD + .5, w - 1, h - 1);
        g.fillStyle = TXT; g.font = `13px ${F}`; g.textAlign = 'center';
        g.fillText(k.label, x + w / 2, HEAD + h / 2);
        g.textAlign = 'left';
      }
      x += w;
    }

    const tick = (px: number, y: number, hh: number) => {
      g.beginPath(); g.moveTo(px, y - hh); g.lineTo(px, y + hh); g.stroke();
    };
    const chain = (y: number, segs: number[], col: string, font: string) => {
      g.strokeStyle = col; g.lineWidth = 1.1; g.fillStyle = TXT; g.font = font; g.textAlign = 'center';
      let cx = PAD;
      tick(cx, y, 5);
      for (const cm of segs) {
        const w = cm * SC;
        g.beginPath(); g.moveTo(cx, y); g.lineTo(cx + w, y); g.stroke();
        tick(cx + w, y, 5);
        if (w > 34) {
          const t = String(cm), m = g.measureText(t).width + 8;
          g.save(); g.fillStyle = '#fff'; g.fillRect(cx + w / 2 - m / 2, y - 8, m, 16); g.restore();
          g.fillStyle = TXT; g.fillText(t, cx + w / 2, y + 5);
        }
        cx += w;
      }
      g.textAlign = 'left';
    };

    const yBase = HEAD + maxD * SC;
    chain(yBase + 26, blocks.map((k) => k.w), GREY, `12px ${F}`);
    chain(yBase + 60, [totW], INK, `600 14px ${F}`);

    const rx = PAD + totW * SC + 26;
    g.strokeStyle = GREY; g.lineWidth = 1.1;
    g.beginPath(); g.moveTo(rx, HEAD); g.lineTo(rx, yBase); g.stroke();
    g.beginPath(); g.moveTo(rx - 5, HEAD); g.lineTo(rx + 5, HEAD); g.stroke();
    g.beginPath(); g.moveTo(rx - 5, yBase); g.lineTo(rx + 5, yBase); g.stroke();
    g.save();
    g.translate(rx + 16, (HEAD + yBase) / 2); g.rotate(Math.PI / 2);
    g.fillStyle = TXT; g.font = `12px ${F}`; g.textAlign = 'center';
    g.fillText(`ลึก ${maxD}`, 0, 0);
    g.restore();

    g.fillStyle = '#6a7682'; g.font = `11px ${F}`;
    g.fillText('หน่วยเป็นเซนติเมตร · แบบจาก Phoenix data sheet', PAD, cv.height - 8);
    setPng(cv.toDataURL('image/png'));
    setToast('กดค้างที่รูป (มือถือ) หรือคลิกขวา (คอม) แล้วบันทึกรูปภาพ');
  };

  /* ---------------- ข้อความส่งลูกค้า ---------------- */
  const copyText = () => {
    const L: string[] = ['ฌ เฌอ · ฟีนิกซ์ (Phoenix Sofa)'];
    if (span.w) L.push(`ขนาดรวม กว้าง ${span.w} × ลึก ${span.d} ซม.`);
    L.push('');
    picked.forEach((p) => {
      const l = lineOf(p);
      const dr = variantOf(l.it, p);
      const vn = variantName(l.it, p);
      L.push(`• ${l.it.label} [${dr ? dr.code : l.it.code}] ${l.name}` +
             `${p.qty > 1 ? ` ×${p.qty}` : ''}${vn ? ` · ${vn}` : ''}${p.rot ? ' · หมุน 90°' : ''}`);
      L.push(l.ask ? '  สอบถามราคา'
        : `  ${BAHT(l.full)} บาท` +
          (l.sale < l.full ? `  ลด ${l.disc}% เหลือ ${BAHT(l.sale)} บาท` : ''));
    });
    L.push('', `ราคาเต็ม ${BAHT(totals.full)} บาท`,
           `ราคาสุทธิ ${BAHT(totals.sale)} บาท (รวม VAT แล้ว)`,
           '', 'ยังไม่รวมค่าขนส่งและติดตั้ง');
    return L.join('\n');
  };

  /* ---------------- ส่วนประกอบย่อย ---------------- */
  const Seg = ({ k, field, opts, cur }: {
    k: string; field: 'arm' | 'side' | 'tbl' | 'v';
    opts: { val: unknown; label: string; off?: boolean; title?: string }[]; cur: unknown;
  }) => (
    <div className="mt-1 flex max-w-[16rem] flex-wrap gap-1">
      {opts.map((o) => (
        <button
          key={String(o.val)} type="button" disabled={o.off} title={o.title}
          aria-pressed={String(o.val) === String(cur)}
          onClick={() => setVar(k, field, o.val)}
          className={`rounded-md border px-1.5 py-1 text-[0.68rem] font-medium leading-tight
            ${String(o.val) === String(cur)
              ? 'border-accent bg-accent text-white'
              : 'border-border bg-bg text-muted'}
            ${o.off ? 'cursor-not-allowed opacity-40' : ''}`}
        >{o.label}</button>
      ))}
    </div>
  );

  const Controls = ({ p }: { p: Sel }) => {
    const it = items[p.ii];
    if (!isSofa(it)) {
      if (it.draw.length < 2) return null;
      return <Seg k={p.key} field="v" cur={p.v}
        opts={it.draw.map((d, i) => ({ val: i, label: d.name, title: d.code }))} />;
    }
    const tc = p.kind === 'g' ? it.cellsT?.[p.ci] : null;
    const bc = p.kind === 'g' ? it.cells?.[p.ci] : null;
    const diff = tc?.sale != null && bc?.sale != null ? tc.sale - bc.sale : null;
    const needSide = p.arm !== 'both' || p.tbl;
    return (
      <>
        <Seg k={p.key} field="arm" cur={p.arm} opts={[
          { val: 'both', label: 'แขนสองข้าง', off: !canPick(it, 'both', p.tbl, p.side) },
          { val: 'one', label: 'แขนข้างเดียว', off: !canPick(it, 'one', p.tbl, p.side) },
          { val: 'none', label: 'ไม่มีแขน', off: !canPick(it, 'none', p.tbl, p.side) },
        ]} />
        <Seg k={p.key} field="tbl" cur={p.tbl} opts={[
          { val: false, label: 'ไม่มีโต๊ะ' },
          { val: true, label: diff != null ? `มีโต๊ะข้าง +${BAHT(diff)}` : 'มีโต๊ะข้าง',
            off: !tc, title: !tc ? 'เกรดนี้ไม่มีราคาแบบมีโต๊ะ' : undefined },
        ]} />
        {needSide && (
          <Seg k={p.key} field="side" cur={p.side} opts={[
            { val: 'R', label: 'ขวา', off: !canPick(it, p.arm, p.tbl, 'R') },
            { val: 'L', label: 'ซ้าย', off: !canPick(it, p.arm, p.tbl, 'L') },
          ]} />
        )}
      </>
    );
  };

  /* ---------------- แบบแปลน ---------------- */
  const SC = blocks.length
    ? Math.min(boxW / Math.max(span.w, 1), 320 / Math.max(span.d, 1))
    : 1;

  return (
    <>
      {/* ตารางราคา */}
      <section id="phx-grid" className="min-w-0 rounded-2xl border border-border bg-surface p-3">
        <h2 className="mb-2 text-[0.7rem] font-semibold tracking-[0.12em] text-muted uppercase">
          ใบราคา ฟีนิกซ์
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-0 text-[0.8rem]">
            <thead>
              <tr>
                <th className="sticky left-0 z-20 w-[9.5rem] min-w-[9.5rem] border-b border-border bg-surface px-1 py-1.5 text-left text-[0.72rem] font-normal text-muted sm:w-[13rem] sm:min-w-[13rem]">
                  รายการ
                </th>
                {GRADES.map((g) => (
                  <th key={g} className="border-b border-border bg-surface px-1 py-1.5 text-center text-[0.72rem] font-normal whitespace-nowrap text-muted">{g}</th>
                ))}
                <th className="border-b border-border bg-surface px-1 py-1.5 text-center text-[0.72rem] font-normal text-muted">แบบอื่น</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, ii) => {
                const size = [it.w && `W${it.w}`, it.d && `D${it.d}`, it.h && `H${it.h}`]
                  .filter(Boolean).join('×');
                return (
                  <tr key={it.label}>
                    <th className="sticky left-0 z-10 w-[9.5rem] min-w-[9.5rem] border-b border-border bg-surface px-1 py-1 text-left font-normal sm:w-[13rem] sm:min-w-[13rem]">
                      <span className="block leading-tight">{it.label}</span>
                      <small className="block font-mono text-[0.64rem] leading-tight text-muted">
                        {it.code}{size ? ` · ${size}` : ''}
                        {isSofa(it) && (
                          <span className="hidden sm:inline"> · เลือกแขน/โต๊ะได้หลังเลือกราคา</span>
                        )}
                      </small>
                    </th>
                    {it.cells.map((c, gi) => {
                      const p = find(keyOf(ii, 'g', gi));
                      const off = c && c.sale != null && c.full != null && c.sale < c.full;
                      return (
                        <td key={gi} className="border-b border-border">
                          <button
                            type="button" disabled={!c}
                            onClick={() => add(ii, 'g', gi)}
                            aria-label={`${it.label} ${GRADES[gi]}`}
                            className={`relative block w-full min-w-[5.4rem] border-l border-border px-1 py-1.5 text-center text-[0.78rem]
                              ${!c ? 'cursor-default text-muted opacity-40' : ''}
                              ${p ? 'rounded-lg bg-accent/10 ring-2 ring-accent ring-inset' : ''}`}
                          >
                            {!c ? '—' : (<>
                              {off && <s className="block text-[0.66rem] text-muted">{BAHT(c.full)}</s>}
                              <b className="block font-semibold">{BAHT(c.sale ?? c.full)}</b>
                              {p && <span className="absolute top-0.5 right-1 text-[0.62rem] font-semibold text-accent">×{p.qty}</span>}
                            </>)}
                          </button>
                        </td>
                      );
                    })}
                    <td className="border-b border-border">
                      {it.extra.length ? it.extra.map((e, ei) => {
                        const p = find(keyOf(ii, 'e', ei));
                        const off = e.sale != null && e.full != null && e.sale < e.full;
                        return (
                          <button
                            key={ei} type="button" onClick={() => add(ii, 'e', ei)}
                            className={`relative block w-full min-w-[5.4rem] border-l border-border px-1 py-1.5 text-center text-[0.78rem]
                              ${p ? 'rounded-lg bg-accent/10 ring-2 ring-accent ring-inset' : ''}`}
                          >
                            <i className="block text-[0.62rem] not-italic text-muted">{e.label}</i>
                            {off && <s className="block text-[0.66rem] text-muted">{BAHT(e.full)}</s>}
                            <b className="block font-semibold">{BAHT(e.sale ?? e.full)}</b>
                            {p && <span className="absolute top-0.5 right-1 text-[0.62rem] font-semibold text-accent">×{p.qty}</span>}
                          </button>
                        );
                      }) : <span className="block px-1 text-center text-muted opacity-40">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* ที่เลือกไว้ */}
      <section id="phx-sel" className="mt-4 min-w-0 rounded-2xl border border-border bg-surface p-3">
        <h2 className="mb-2 text-[0.7rem] font-semibold tracking-[0.12em] text-muted uppercase">
          ที่เลือกไว้
        </h2>
        {!picked.length ? (
          <p className="py-2 text-sm text-muted">ยังไม่ได้เลือก · กดราคาในตารางข้างบนได้เลย</p>
        ) : (
          <table className="w-full border-collapse text-[0.82rem]">
            <thead>
              <tr className="text-[0.7rem] text-muted">
                <th className="border-b border-border py-1 text-left font-normal">รายการ</th>
                <th className="border-b border-border py-1 text-left font-normal">วัสดุ</th>
                <th className="border-b border-border py-1 text-right font-normal">จำนวน</th>
                <th className="border-b border-border py-1 text-right font-normal">ราคา</th>
                <th className="border-b border-border py-1 text-right font-normal">ลำดับ</th>
              </tr>
            </thead>
            <tbody>
              {picked.map((p, i) => {
                const l = lineOf(p);
                const dr = variantOf(l.it, p);
                const off = !l.ask && l.sale < l.full;
                return (
                  <tr key={p.key}>
                    <td className="border-b border-border py-1.5 align-top">
                      {l.it.label}
                      <div className="font-mono text-[0.7rem] text-muted">{dr ? dr.code : l.it.code}</div>
                      <Controls p={p} />
                      {attached(l.it) && (
                        <div className="mt-1 flex gap-1">
                          <button type="button" aria-pressed={p.mir} onClick={() => toggle(p.key, 'mir')}
                            className={`rounded-md border px-1.5 py-1 text-[0.68rem] font-medium
                              ${p.mir ? 'border-accent bg-accent text-white' : 'border-border bg-bg text-muted'}`}
                          >⇄ พลิก</button>
                          <button type="button" aria-pressed={p.rot} onClick={() => toggle(p.key, 'rot')}
                            className={`rounded-md border px-1.5 py-1 text-[0.68rem] font-medium
                              ${p.rot ? 'border-accent bg-accent text-white' : 'border-border bg-bg text-muted'}`}
                          >⟲ หมุน 90°</button>
                        </div>
                      )}
                    </td>
                    <td className="border-b border-border py-1.5 align-top">{l.name}</td>
                    <td className="border-b border-border py-1.5 text-right align-top whitespace-nowrap">
                      <button onClick={() => bump(p.key, -1)} aria-label="ลด"
                        className="h-6 w-6 rounded-md border border-border bg-bg">−</button>
                      <span className="px-1.5">{p.qty}</span>
                      <button onClick={() => bump(p.key, 1)} aria-label="เพิ่ม"
                        className="h-6 w-6 rounded-md border border-border bg-bg">+</button>
                    </td>
                    <td className="border-b border-border py-1.5 text-right align-top whitespace-nowrap">
                      {l.ask ? <span className="text-muted">ไม่มีราคาเกรดนี้</span> : (<>
                        {off && <><s className="text-muted">{BAHT(l.full)}</s><br /></>}
                        {BAHT(l.sale)}
                      </>)}
                    </td>
                    <td className="border-b border-border py-1.5 text-right align-top whitespace-nowrap">
                      <button onClick={() => movePick(p.key, -1)} disabled={i === 0} aria-label="เลื่อนซ้าย"
                        className="h-6 w-6 rounded-md border border-border bg-bg disabled:opacity-30">◀</button>
                      <button onClick={() => movePick(p.key, 1)} disabled={i === picked.length - 1} aria-label="เลื่อนขวา"
                        className="ml-1 h-6 w-6 rounded-md border border-border bg-bg disabled:opacity-30">▶</button>
                    </td>
                  </tr>
                );
              })}
              <tr className="font-semibold">
                <td colSpan={3} className="pt-2">ราคาเต็ม</td>
                <td className="pt-2 text-right">{BAHT(totals.full)}</td><td />
              </tr>
              <tr className="font-semibold">
                <td colSpan={3}>ส่วนลด</td>
                <td className="text-right">−{BAHT(totals.save)}</td><td />
              </tr>
              <tr className="text-[1.05rem] font-semibold text-ok">
                <td colSpan={3}>ราคาสุทธิ (รวม VAT)</td>
                <td className="text-right">฿{BAHT(totals.sale)}</td><td />
              </tr>
              {totals.ask > 0 && (
                <tr><td colSpan={5} className="pt-1 text-[0.74rem] text-muted">
                  มี {totals.ask} รายการที่ยังไม่มีราคาในเกรดนี้ · ยังไม่ได้รวมในยอด
                </td></tr>
              )}
            </tbody>
          </table>
        )}
      </section>

      {/* แบบแปลน */}
      <section id="phx-plan" className="mt-4 min-w-0 rounded-2xl border border-border bg-surface p-3">
        <h2 className="mb-2 text-[0.7rem] font-semibold tracking-[0.12em] text-muted uppercase">
          แบบแปลน
        </h2>
        <div ref={planBox}
          className="relative w-full overflow-x-auto rounded-xl border border-border bg-white p-2.5"
          style={{ touchAction: 'pan-y' }}
        >
          {!blocks.length ? (
            <p className="px-1 py-5 text-sm text-muted">
              เลือกตัวโซฟาหรือเดย์เบดแล้วจะขึ้นแบบแปลนให้
            </p>
          ) : (<>
            <div className="flex items-start"
              onPointerDown={(e) => {
                const el = (e.target as HTMLElement).closest<HTMLElement>('[data-b]');
                if (!el || (e.target as HTMLElement).closest('[data-mir]')) return;
                dragFrom.current = +el.dataset.b!;
                el.setPointerCapture(e.pointerId);
              }}
              onPointerMove={(e) => {
                if (dragFrom.current < 0) return;
                const kids = [...e.currentTarget.children] as HTMLElement[];
                const to = kids.findIndex((k) => {
                  const r = k.getBoundingClientRect();
                  return e.clientX >= r.left && e.clientX <= r.right;
                });
                if (to < 0 || to === dragFrom.current) return;
                swapBlocks(dragFrom.current, to);
                dragFrom.current = to;
              }}
              onPointerUp={() => { dragFrom.current = -1; }}
              onPointerCancel={() => { dragFrom.current = -1; }}
            >
              {blocks.map((x, i) => (
                <div key={`${x.key}-${i}`} data-b={i} data-code={x.code}
                  title={`${x.label} · ${x.code}`}
                  className={`relative flex-none select-none ${x.img ? '' : 'rounded border-[1.5px] border-[#8a9aa8] bg-[#eef1f3]'}`}
                  style={{ width: `${(x.w * SC).toFixed(1)}px`, height: `${(x.d * SC).toFixed(1)}px` }}
                >
                  <button type="button" data-mir aria-pressed={x.mir}
                    onClick={() => toggle(x.key, 'mir')} title="พลิกซ้ายขวา"
                    className={`absolute top-[3px] right-[3px] z-[2] flex h-6 w-6 items-center justify-center rounded-md border text-[13px] font-semibold
                      ${x.mir ? 'border-accent bg-accent text-white' : 'border-[#8a9aa8] bg-white/90 text-accent'}`}
                  >⇄</button>
                  {x.img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={x.img} alt={x.code} draggable={false}
                      className="absolute top-1/2 left-1/2 block"
                      style={{
                        width: `${(x.ow * SC).toFixed(1)}px`, height: `${(x.od * SC).toFixed(1)}px`,
                        transform: `translate(-50%,-50%)${x.rot ? ' rotate(90deg)' : ''}${x.mir ? ' scaleX(-1)' : ''}`,
                      }} />
                  ) : (
                    <span className="flex h-full flex-col items-center justify-center text-[0.66rem] text-[#38424d]">
                      <b>{x.label}</b><span className="text-[0.6rem] text-muted">ยังไม่มีแบบจากโรงงาน</span>
                    </span>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-1 flex">
              {blocks.map((x, i) => (
                <div key={i} className="relative h-[17px] flex-none border-x border-[#b9c2c9] text-center text-[0.62rem] leading-[17px] text-[#6a7682]"
                  style={{ width: `${(x.w * SC).toFixed(1)}px` }}>
                  <span className="relative bg-white px-1">{x.w}</span>
                  <span className="absolute inset-x-0 top-2 border-t border-[#b9c2c9]" />
                </div>
              ))}
            </div>
            <div className="relative mt-0.5 h-[18px] border-x border-[#8a9aa8] text-center text-[0.66rem] leading-[18px] font-medium text-[#38424d]"
              style={{ width: `${(span.w * SC).toFixed(1)}px` }}>
              <span className="relative bg-white px-1.5">กว้างรวม {span.w} ซม. · ลึกสุด {span.d} ซม.</span>
              <span className="absolute inset-x-0 top-[9px] border-t border-[#8a9aa8]" />
            </div>
          </>)}
        </div>
        <p className="mt-1.5 text-[0.72rem] text-muted">
          ลากรูปสลับตำแหน่งได้ · กด ⇄ พลิกซ้ายขวา · ⟲ หมุน 90° อยู่ในตารางข้างบน
          {blocks.some((x) => !x.img) && ' · บางชิ้นไฟล์แบบของโรงงานยังไม่มี วาดเป็นกรอบแทน'}
        </p>
        <button onClick={makePng}
          className="mt-2 w-full rounded-xl border border-accent px-3 py-2.5 text-sm font-semibold text-accent">
          ทำรูปไว้บันทึก
        </button>
        {png && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={png} alt="แบบแปลนชุดฟีนิกซ์" className="mt-2 w-full rounded-xl border border-border" />
        )}
      </section>

      {/* ปุ่มท้าย */}
      <section id="phx-share" className="mt-4 min-w-0 rounded-2xl border border-border bg-surface p-3">
        <button
          onClick={async () => {
            if (!picked.length) { setToast('ยังไม่ได้เลือกอะไรเลย'); return; }
            const t = copyText();
            try { await navigator.clipboard.writeText(t); setFallback(''); setToast('คัดลอกแล้ว วางในแชทได้เลย'); }
            catch { setFallback(t); setToast('คัดลอกอัตโนมัติไม่ได้ · ลากเลือกข้างล่าง'); }
          }}
          className="w-full rounded-xl bg-accent px-3 py-2.5 text-sm font-semibold text-white"
        >คัดลอกรายละเอียดส่งลูกค้า</button>
        <button onClick={() => { setPicked([]); setPng(''); setFallback(''); setToast('ล้างแล้ว'); }}
          className="mt-2 w-full rounded-xl border border-accent px-3 py-2.5 text-sm font-semibold text-accent"
        >ล้างทั้งหมด</button>
        {fallback && (
          <pre className="mt-2 overflow-x-auto rounded-lg bg-bg p-2.5 text-xs whitespace-pre-wrap">{fallback}</pre>
        )}
        <p className="mt-2 rounded-lg bg-bg p-2 text-[0.74rem] text-muted">
          ราคาดึงสดจากระบบ · แบบจาก Phoenix data sheet ของโรงงาน · ไม่ได้วาดเอง
        </p>
      </section>

      {toast && (
        <div role="status"
          className="fixed bottom-5 left-1/2 z-30 -translate-x-1/2 rounded-full bg-accent px-4 py-2 text-sm text-white">
          {toast}
        </div>
      )}
    </>
  );
}
