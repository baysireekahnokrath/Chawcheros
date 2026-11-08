'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Sheet, Group, Module } from '@/modules/datasheet/build';
import { webSpecOf } from '@/modules/datasheet/descriptions';

/** ข้อความของรุ่นหนึ่ง · บางรุ่นมีหลายหมวด แต่เว็บเขียนไว้หมวดเดียว */
const sheetTexts = (sheet: Sheet) =>
  [...new Set(sheet.groups
    .map((g) => webSpecOf(sheet.th, g.cat)?.text)
    .filter(Boolean) as string[])];

const dim = (v: number | null) => (v == null ? '—' : String(v));

function sizeText(m: Module) {
  const core = [m.w && `W${m.w}`, m.d && `D${m.d}`, m.h && `H${m.h}`].filter(Boolean).join(' × ');
  return core ? `${core} ซม.` : 'ไม่ระบุขนาด';
}

/**
 * ผังด้านบน · ทุกชิ้นในหมวดเดียวกันใช้มาตราส่วนเดียวกัน จะได้เทียบขนาดกันได้ด้วยตา
 * พื้นหลังขาวตายตัว เพราะรูปนี้ถูกส่งต่อให้คนอื่นดู ไม่ควรเปลี่ยนตามธีมเครื่องคนดู
 */
function scaleOf(mods: Module[]) {
  const maxW = Math.max(...mods.map((m) => m.w ?? 60), 1);
  const maxD = Math.max(...mods.map((m) => m.d ?? m.w ?? 60), 1);
  const BOXW = 300, PAD = 14, LBL = 15;
  const sc = Math.min((BOXW - PAD * 2) / maxW, 150 / maxD);
  return { sc, BOXW, PAD, LBL, H: maxD * sc + PAD * 2 + LBL };
}

function Plan({ m, s }: { m: Module; s: ReturnType<typeof scaleOf> }) {
  const w = m.w ?? 60, d = m.d ?? m.w ?? 60;
  const bw = w * s.sc, bd = d * s.sc;
  const x = (s.BOXW - bw) / 2, y = s.PAD;
  const back = m.backD != null && m.backD < d ? m.backD * s.sc : null;
  const legW = back == null ? 0 : Math.min(bw * 0.42, bd * 0.75);

  return (
    <svg
      viewBox={`0 0 ${s.BOXW} ${Math.round(s.H)}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={`ผังด้านบน ${m.code}`}
      className="block w-full rounded-md border border-border bg-white"
    >
      {back == null ? (
        <rect x={x} y={y} width={bw} height={bd} rx={4} fill="#eef1f3" stroke="#2B4368" strokeWidth={1.4} />
      ) : (
        <path
          d={`M${x} ${y} h${bw} v${bd} h${-legW} v${-(bd - back)} h${-(bw - legW)} Z`}
          fill="#eef1f3" stroke="#2B4368" strokeWidth={1.4} strokeLinejoin="round"
        />
      )}
      <text x={s.BOXW / 2} y={y + bd + 12} textAnchor="middle" fontSize="11" fill="#6a7682">
        W{dim(m.w)}{m.d ? ` × D${dim(m.d)}` : ''}
      </text>
    </svg>
  );
}

function ModuleCard({ m, s }: { m: Module; s: ReturnType<typeof scaleOf> }) {
  const extra = [
    m.seatH != null ? `ที่นั่งสูง ${m.seatH}` : null,
    m.backD != null ? `ช่วงหลังลึก ${m.backD}` : null,
  ].filter(Boolean).join(' · ');

  return (
    <div className="flex min-w-0 flex-col gap-1.5 rounded-xl border border-border bg-bg p-2.5">
      <Plan m={m} s={s} />
      <span className="font-mono text-[0.72rem] font-medium break-all text-accent">{m.code}</span>
      {m.sub && <span className="text-xs text-muted">{m.sub}</span>}
      <span className="text-[0.74rem]">
        {sizeText(m)}
        {extra && <span className="text-muted"> · {extra}</span>}
      </span>
      {m.mats.length > 0 && (
        <span className="text-[0.72rem] leading-relaxed text-muted">{m.mats.join(' · ')}</span>
      )}
      {m.mats.length === 0 && m.woods.length > 0 && (
        <span className="text-[0.72rem] leading-relaxed text-muted">{m.woods.join(' · ')}</span>
      )}
    </div>
  );
}

/**
 * หมวดหนึ่ง = แถบกดเปิดหนึ่งอัน
 *
 * ★ ทำไมต้องยุบ
 *   ฟีนิกซ์มี 29 โมดูล กางหมดบนมือถือได้หน้ายาวสามหมื่นพิกเซล
 *   เลื่อนหาอะไรไม่เจอ · เปิดไว้แค่หมวดแรก ที่เหลือกดทีเดียวก็เห็น
 *   ใช้ details ของเบราว์เซอร์เอง จะได้ค้นด้วย Ctrl+F และสั่งพิมพ์ได้ตามปกติ
 */
function GroupBlock({ g, open, coll }: { g: Group; open: boolean; coll: string }) {
  const s = useMemo(() => scaleOf(g.mods), [g.mods]);
  const web = webSpecOf(coll, g.cat);
  return (
    <details open={open} className="mt-3 border-t border-border pt-3 first:border-t-0">
      <summary className="flex cursor-pointer flex-wrap items-baseline gap-2 text-sm font-semibold marker:text-muted">
        {g.cat}
        <span className="text-xs font-normal text-muted">{g.mods.length} โมดูล</span>
        {web && (
          <a href={web.link} target="_blank" rel="noopener noreferrer"
             onClick={(e) => e.stopPropagation()}
             className="text-xs font-normal text-muted underline-offset-2 hover:underline">
            ดูบนเว็บ
          </a>
        )}
      </summary>
      <div className="mt-2.5 grid gap-2.5 [grid-template-columns:repeat(auto-fill,minmax(9.5rem,1fr))]">
        {g.mods.map((m) => <ModuleCard key={m.code} m={m} s={s} />)}
      </div>
    </details>
  );
}

function Tech({ sheet }: { sheet: Sheet }) {
  const mats: string[] = [], woods: string[] = [], colours: string[] = [], seats: number[] = [];
  for (const g of sheet.groups) for (const m of g.mods) {
    m.mats.forEach((v) => !mats.includes(v) && mats.push(v));
    m.woods.forEach((v) => !woods.includes(v) && woods.push(v));
    m.colours.forEach((v) => !colours.includes(v) && colours.push(v));
    if (m.seatH != null && !seats.includes(m.seatH)) seats.push(m.seatH);
  }
  const rows: [string, string][] = [
    ['ประเภท', sheet.groups.map((g) => `${g.cat} (${g.mods.length})`).join(' · ')],
  ];
  if (mats.length) rows.push(['วัสดุหุ้มที่เลือกได้', mats.join(' · ')]);
  if (woods.length) rows.push(['โครง / ไม้', woods.join(' · ')]);
  if (colours.length) rows.push(['สี', colours.join(' · ')]);
  if (seats.length) rows.push(['สูงที่นั่ง', seats.sort((a, b) => a - b).map((v) => `${v} ซม.`).join(' · ')]);
  rows.push(['จำนวนในระบบ', `${sheet.variants} ตัวสินค้า · ${sheet.modules} โมดูล`]);

  return (
    <table className="w-full border-collapse text-sm">
      <tbody>
        {rows.map(([k, v]) => (
          <tr key={k}>
            <th className="w-40 py-1 pr-3 text-left align-top font-normal text-muted">{k}</th>
            <td className="py-1 align-top">{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function copyText(sheet: Sheet) {
  const L = [`ฌ เฌอ · ${sheet.en || sheet.th} (${sheet.th})`, ''];
  for (const g of sheet.groups) {
    L.push(g.cat);
    for (const m of g.mods) {
      L.push(
        `  ${m.code}  ${sizeText(m)}` +
        (m.seatH != null ? ` · ที่นั่งสูง ${m.seatH}` : '') +
        (m.mats.length ? `  [${m.mats.join(', ')}]` : ''),
      );
    }
    L.push('');
  }
  const texts = sheetTexts(sheet);
  if (texts.length) L.push(texts.join('\n\n'));
  return L.join('\n').trimEnd();
}

export default function DataSheet({ sheets, totalModules }: { sheets: Sheet[]; totalModules: number }) {
  const [cur, setCur] = useState(0);
  const [q, setQ] = useState('');
  const [fallback, setFallback] = useState('');
  const box = useRef<HTMLDivElement>(null);

  /**
   * กางทุกหมวดก่อนพิมพ์ แล้วพับกลับเหมือนเดิม
   *
   * ★ ทำด้วย CSS ไม่ได้ · ลองสั่ง display กับ content-visibility ใน @media print แล้ว
   *   render PDF ออกมาหมวดที่ยุบไว้หายหมด เหลือแต่หัวข้อ
   *   แผ่นที่ส่งลูกค้าขาดของแบบนี้อันตรายกว่าหน้าจอยาว
   */
  useEffect(() => {
    let opened: HTMLDetailsElement[] = [];
    const before = () => {
      opened = [...(box.current?.querySelectorAll('details:not([open])') ?? [])] as HTMLDetailsElement[];
      opened.forEach((d) => { d.open = true; });
    };
    const after = () => { opened.forEach((d) => { d.open = false; }); opened = []; };
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    // Safari บน iOS ไม่ยิง beforeprint · ใช้ matchMedia แทน
    const mq = window.matchMedia('print');
    const onChange = (e: MediaQueryListEvent) => (e.matches ? before() : after());
    mq.addEventListener('change', onChange);
    return () => {
      window.removeEventListener('beforeprint', before);
      window.removeEventListener('afterprint', after);
      mq.removeEventListener('change', onChange);
    };
  }, []);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return sheets.map((sheet, i) => ({ sheet, i }));
    return sheets
      .map((sheet, i) => ({ sheet, i }))
      .filter(({ sheet }) =>
        `${sheet.th} ${sheet.en} ${sheet.prefix}`.toLowerCase().includes(s) ||
        sheet.groups.some((g) =>
          g.cat.toLowerCase().includes(s) ||
          g.mods.some((m) => m.code.toLowerCase().includes(s) || m.sub.toLowerCase().includes(s))));
  }, [sheets, q]);

  const shown = list.some(({ i }) => i === cur) ? cur : list[0]?.i;
  const sheet = shown == null ? undefined : sheets[shown];

  if (!sheets.length) return null;

  const texts = sheet ? sheetTexts(sheet) : [];

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        <select
          value={shown ?? ''}
          onChange={(e) => { setCur(Number(e.target.value)); setFallback(''); }}
          aria-label="เลือกรุ่น"
          className="min-w-0 flex-1 basis-48 rounded-lg border border-border bg-bg px-2.5 py-2 text-sm"
        >
          {list.map(({ sheet: s, i }) => (
            <option key={s.th} value={i}>{s.th} · {s.en} ({s.variants})</option>
          ))}
        </select>
        <input
          type="search" value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="ค้นหา ชื่อรุ่น หมวด หรือ รหัส" aria-label="ค้นหา"
          className="min-w-0 flex-1 basis-40 rounded-lg border border-border bg-bg px-2.5 py-2 text-sm"
        />
        <button
          type="button"
          onClick={async () => {
            if (!sheet) return;
            const t = copyText(sheet);
            try { await navigator.clipboard.writeText(t); setFallback(''); }
            catch { setFallback(t); }
          }}
          className="rounded-lg border border-accent px-3 py-2 text-sm font-medium text-accent"
        >
          คัดลอกเป็นข้อความ
        </button>
      </div>

      <p className="mb-3 text-xs text-muted">
        {q.trim() ? `${list.length} รุ่นที่ตรง` : `${sheets.length} รุ่น · ${totalModules} โมดูล`}
      </p>

      {!sheet && (
        <div className="rounded-xl border border-border p-4 text-sm text-muted">ไม่พบรุ่นที่ค้น</div>
      )}

      {sheet && (
        <div ref={box} className="rounded-2xl border border-border bg-surface p-4">
          <div className="mb-3 border-b-2 border-accent pb-2">
            <div className="text-2xl font-medium tracking-[0.12em] text-accent uppercase">
              {sheet.en || sheet.th}
            </div>
            <div className="text-base font-medium">{sheet.th}</div>
            <div className="mt-0.5 font-mono text-xs text-muted">
              ตัวย่อรหัส {sheet.prefix}
              {sheet.codeReal ? ' · รหัสจริงจาก data sheet โรงงาน' : ' · รหัสที่เสนอ'}
            </div>
          </div>

          <h2 className="mt-4 mb-1.5 text-[0.7rem] font-semibold tracking-[0.16em] text-muted uppercase">
            Description
          </h2>
          {texts.length ? (
            <p className="text-sm whitespace-pre-line">{texts.join('\n\n')}</p>
          ) : (
            <p className="text-sm text-muted italic">
              ยังไม่มีคำอธิบายบนเว็บสำหรับรุ่นนี้ · มีแต่บรรทัดขนาด
            </p>
          )}

          <h2 className="mt-5 mb-1.5 text-[0.7rem] font-semibold tracking-[0.16em] text-muted uppercase">
            Technical description
          </h2>
          <Tech sheet={sheet} />

          <h2 className="mt-5 mb-1.5 text-[0.7rem] font-semibold tracking-[0.16em] text-muted uppercase">
            Modules
          </h2>
          {sheet.groups.map((g, i) => (
            <GroupBlock key={g.cat} g={g} coll={sheet.th}
                        open={i === 0 || sheet.groups.length === 1} />
          ))}

          {!sheet.codeReal && (
            <div className="mt-4 rounded-xl border border-warn/40 bg-warn/10 p-3 text-xs">
              รหัสในแผ่นนี้เป็นรหัสที่เสนอ ตั้งแบบเดียวกับ Phoenix/Koontong data sheet ของโรงงาน
              (ตัวย่อรุ่น + ความกว้างเป็นมิลลิเมตร + หมวด) ยังไม่ได้ยืนยันกับโรงงาน
            </div>
          )}

          {sheet.groups.some((g) => g.mods.some((m) => !m.w || !m.d)) && (
            <div className="mt-2 rounded-xl border border-warn/40 bg-warn/10 p-3 text-xs">
              มีโมดูลที่ยังไม่ได้ใส่ขนาดในระบบ
            </div>
          )}

          {sheet.ambiguous.length > 0 && (
            <div className="mt-2 rounded-xl border border-warn/40 bg-warn/10 p-3 text-xs">
              <b>ใบราคามีแถวที่แยกชื่อไม่ออก</b> — ขนาดกับรูปแบบเหมือนกัน
              น่าจะเป็นสินค้าตัวเดียวกันที่ลงไว้สองแถว
              <ul className="mt-1 list-disc pl-4">
                {sheet.ambiguous.map((a) => (
                  <li key={a.codes.join()}>
                    {a.cat} — {a.codes.map((c, i) => `${c} (${a.subs[i]})`).join(' · ')}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {fallback && (
            <>
              <p className="mt-4 text-xs text-muted">
                คัดลอกอัตโนมัติไม่ได้ในเบราว์เซอร์นี้ · ลากเลือกข้อความข้างล่างแทน
              </p>
              <pre className="mt-1 overflow-x-auto rounded-lg bg-bg p-2.5 text-xs whitespace-pre-wrap">
                {fallback}
              </pre>
            </>
          )}

          <p className="mt-5 border-t border-border pt-2.5 text-xs text-muted">
            ขนาดและวัสดุดึงสดจากระบบ · คำอธิบายจาก chawcher.com · ไม่ระบุราคาในแผ่นนี้
          </p>
        </div>
      )}
    </>
  );
}
