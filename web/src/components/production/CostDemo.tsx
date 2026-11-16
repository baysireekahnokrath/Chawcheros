'use client';

/**
 * หน้าจำลองโปรแกรม COST ของโรงงาน · บนเว็บ
 *
 * โจทย์จาก Bay (2026-11-16)
 *   "ทำ mockup ให้เหมือนกับว่าเค้าใช้งานใน Access แต่ใช้บนเว็บ
 *    เราจะยังไม่เปลี่ยนวิธีการใช้งานเค้า เอาแบบนี้ออกมาให้เค้าลองไปใช้ก่อน"
 *
 * ★ ตั้งใจให้เหมือนของเดิมทุกอย่าง
 *   เมนูสามกลุ่มเดิม · ชื่อรายการเดิมทุกตัว · ฟอร์ม PI สีเขียวเดิม ·
 *   ใบขอเบิกหน้าตาเดิมพร้อมช่อง "จำนวนที่เบิกจริง" และ "ผลต่าง"
 *   คนที่ใช้ Access อยู่ต้องเปิดมาแล้วทำงานต่อได้เลย ไม่ต้องเรียนใหม่
 *
 * ★ สิ่งเดียวที่เพิ่มเข้ามา · กดที่บรรทัดไหนก็ได้เพื่อดูว่าตัวเลขมาจากไหน
 *   จำนวนที่ใช้ ÷ Rec_ ÷ ตัวหาร#2 · ของเดิมดูไม่ได้ ต้องเปิดตารางเอง
 *
 * ⚠️ ยังไม่ได้ต่อฐานข้อมูลจริง · ใช้ตัวอย่าง 3 สูตรที่คัดมา · กดบันทึกแล้วไม่เก็บ
 */

import { useMemo, useState } from 'react';
import {
  COLOURS, DEPARTMENTS, GROUPS, HEADS, LINES,
  type CostHead, type CostLine,
} from '@/modules/production/cost-sample';
import {
  countByDep, depsUsed, explain, hiddenFor, slipFor,
} from '@/modules/production/issue-slip';

/* ── ชื่อเมนูทุกตัว ลอกจากหน้าจอจริงที่พี่หนิงถ่ายมา ───────────────── */
const MENU: Record<string, { id: string; label: string; ready: boolean }[]> = {
  'บันทึก': [
    { id: 'cost', label: 'บันทึก Cost (ต้นทุนการผลิต, จำนวนวัตถุดิบที่ใช้)', ready: true },
    { id: 'pi', label: 'บันทึก PI (ทำใบเตรียมวัตถุดิบ, ใบเบิก)', ready: true },
    { id: '', label: 'เรียกดู PI ที่ไม่ได้พิมพ์แล้ว · ไม่มีในบันทึก PI', ready: false },
  ],
  'รายงาน': [
    { id: '', label: '--------- รายงานการบันทึก Cost ----------', ready: false },
    { id: '', label: 'แบบฟอร์มต้นทุนการผลิต', ready: false },
    { id: 'use1', label: 'รายการจำนวนวัตถุดิบที่ใช้ : Cost 1 หน่วย', ready: true },
    { id: '', label: '--------- รายงานการบันทึก PI ----------', ready: false },
    { id: 'usepi', label: 'รายการจำนวนวัตถุดิบที่ใช้ : ตามจำนวนใน PI', ready: true },
    { id: 'issue', label: 'ใบขอเบิกวัตถุดิบ (แยกแผนกยกเว้นวางแบบ)', ready: true },
    { id: 'issue1', label: 'ใบขอเบิกวัตถุดิบ : แผนกวางแบบ', ready: true },
    { id: '', label: 'ใบเบิกหนังแผนกวางแบบ(โซฟา)', ready: false },
    { id: '', label: 'ใบขอเบิกวัตถุดิบ (แยกตาม W/O)', ready: false },
    { id: '', label: 'รายงานวัตถุดิบในแต่ละ W/O', ready: false },
    { id: '', label: 'ใบสั่งงาน (แยกตาม W/O)', ready: false },
  ],
  'Setup': [
    { id: '', label: 'ข้อมูลเบื้องต้น: แก้ไข, เพิ่มเติม ติดต่อ Admin', ready: false },
    { id: '', label: '------- รายงานข้อมูลเบื้องต้น ---------------', ready: false },
    { id: 'parts', label: 'รายชื่อ ส่วนประกอบ', ready: true },
    { id: 'models', label: 'รายชื่อ Model', ready: true },
    { id: 'colours', label: 'รายชื่อ สี', ready: true },
    { id: '', label: 'รายการ Model ที่บันทึกเข้าโปรแกรม COST', ready: false },
  ],
};

const thDate = (d: Date) =>
  `${d.getDate()} ${['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'][d.getMonth()]} ${d.getFullYear() + 543}`;

type PiLine = { key: string; costNo: string; partId: string; colourId: number; qty: number };

export default function CostDemo() {
  const [group, setGroup] = useState<keyof typeof MENU>('บันทึก');
  const [view, setView] = useState('pi');
  const [wo, setWo] = useState('45/26');
  const [piNo, setPiNo] = useState('EGG 45-26');
  const [customer, setCustomer] = useState('E.G.G. Enterprise Co.,Ltd');
  const [pi, setPi] = useState<PiLine[]>([
    { key: 'a', costNo: HEADS[0].costNo, partId: HEADS[0].partId, colourId: 1, qty: 1 },
  ]);
  const [pick, setPick] = useState(0);
  const [colour, setColour] = useState(1);
  const [qty, setQty] = useState(1);
  const [dep, setDep] = useState(2);
  const [open, setOpen] = useState<string>('');

  const head: CostHead = HEADS[pick];
  const lines = useMemo(
    () => LINES.filter((l) => l.costNo === head.costNo && l.partId === head.partId),
    [head],
  );
  const deps = useMemo(() => depsUsed(lines), [lines]);
  const counts = useMemo(() => countByDep(lines), [lines]);
  const slip = useMemo(() => slipFor(lines, dep, qty), [lines, dep, qty]);
  const hidden = useMemo(() => hiddenFor(lines, dep), [lines, dep]);
  const depName = DEPARTMENTS.find((d) => d.id === dep)?.name ?? '';

  const items = MENU[group];

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[680px] border border-[#8a8a6a] bg-[#ece9d8] font-sans text-[13px] text-black">

        {/* ── หัวโปรแกรม ───────────────────────────────────────────── */}
        <div className="flex items-stretch border-b border-[#8a8a6a] bg-gradient-to-b from-[#d9d8b4] to-[#a8a87c]">
          <div className="flex w-[150px] shrink-0 items-center gap-2 border-r border-[#8a8a6a] bg-[#e8e7d2] px-2 py-2">
            <span className="grid h-9 w-9 place-items-center bg-[#cfd3d6] text-lg font-bold italic text-[#2a4a6a]">A</span>
            <span className="leading-tight">
              <span className="block text-[10px] font-bold">ASE CO., LTD.</span>
              <span className="block text-[10px]">บริษัท เอเซ่ จำกัด</span>
            </span>
          </div>
          <div className="flex flex-1 items-center justify-end px-4">
            <span className="text-right leading-none">
              <span className="block font-serif text-3xl font-bold tracking-wide text-[#6a2d7a]">COST</span>
              <span className="block text-[11px] text-black/70">{thDate(new Date())}</span>
            </span>
          </div>
        </div>

        <div className="flex gap-2 p-2">
          {/* ── MENU CONTROL ───────────────────────────────────────── */}
          <div className="w-[170px] shrink-0">
            <div className="bg-[#4a6fa5] px-2 py-0.5 text-center text-[11px] font-bold text-white">
              MENU CONTROL
            </div>
            <div className="h-[150px] border border-[#7f9db9] bg-white">
              {(Object.keys(MENU) as (keyof typeof MENU)[]).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => { setGroup(g); setView(''); setOpen(''); }}
                  className={`block w-full px-2 py-0.5 text-left ${
                    group === g ? 'bg-[#0a246a] text-white' : 'hover:bg-[#d8e4f8]'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>

            <label className="mt-2 flex items-center gap-1 border border-[#aaa] bg-white px-1 py-0.5 text-[11px]">
              <input type="checkbox" defaultChecked className="h-3 w-3" /> Preview
            </label>

            <div className="mt-2 bg-[#4a6fa5] px-2 py-0.5 text-center text-[11px] font-bold text-white">
              รายงานวันที่
            </div>
            <div className="border border-[#7f9db9] bg-[#dcdcc8] p-1 text-[11px]">
              <div className="flex items-center gap-1">
                <span className="w-7 text-center">จาก</span>
                <input defaultValue="01/01/2002" className="w-full border border-[#7f9db9] bg-white px-1" />
              </div>
              <div className="mt-1 flex items-center gap-1">
                <span className="w-7 text-center">ถึง</span>
                <input defaultValue="01/01/2002" className="w-full border border-[#7f9db9] bg-white px-1" />
              </div>
            </div>

            <div className="mt-3 text-center">
              <span className="inline-grid h-10 w-10 place-items-center rounded-[6px] bg-[#c0392b] text-[9px] font-bold text-white">
                STOP
              </span>
            </div>
          </div>

          {/* ── SELECT ITEM ────────────────────────────────────────── */}
          <div className="min-w-0 flex-1">
            <div className="bg-[#6a2d7a] px-2 py-0.5 text-center text-[11px] font-bold text-white">
              SELECT ITEM
            </div>
            <div className="min-h-[150px] border border-[#7f9db9] bg-black p-2">
              {items.map((it, i) => (
                <button
                  key={i}
                  type="button"
                  disabled={!it.ready}
                  onClick={() => { setView(it.id); setOpen(''); }}
                  className={`flex w-full items-start gap-2 px-1 py-[3px] text-left leading-snug ${
                    it.ready ? 'text-white hover:bg-white/15' : 'cursor-default text-white/35'
                  } ${view === it.id && it.ready ? 'bg-white/20' : ''}`}
                >
                  <span className={it.ready ? 'text-[#ff9933]' : 'text-[#ff9933]/30'}>▶</span>
                  <span>{it.label}</span>
                </button>
              ))}
              {items.some((i) => !i.ready) && (
                <p className="mt-2 border-t border-white/20 pt-1 text-[10px] text-white/40">
                  รายการที่จาง ๆ คือยังไม่ได้ทำในตัวทดลองนี้
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ── ฟอร์ม/รายงานที่เปิดอยู่ ───────────────────────────────── */}
        {view === 'pi' && (
          <PiForm
            {...{ wo, setWo, piNo, setPiNo, customer, setCustomer, pi, setPi,
                  pick, setPick, colour, setColour, qty, setQty }}
          />
        )}

        {(view === 'issue' || view === 'issue1' || view === 'use1' || view === 'usepi') && (
          <Slip
            {...{ head, lines, deps, counts, dep, setDep, slip, hidden, depName,
                  wo, piNo, customer, qty, open, setOpen, view }}
          />
        )}

        {view === 'cost' && <CostForm head={head} lines={lines} pick={pick} setPick={setPick} />}

        {view === 'parts' && (
          <SimpleList title="รายชื่อ ส่วนประกอบ"
            rows={[...new Set(LINES.map((l) => l.partId))].map((p) => [p, ''])} />
        )}
        {view === 'models' && (
          <SimpleList title="รายชื่อ Model"
            rows={HEADS.map((h) => [h.modelId, `${h.costNo} · ${h.partId}`])} />
        )}
        {view === 'colours' && (
          <SimpleList title="รายชื่อ สี" rows={COLOURS.map((c) => [String(c.id), c.name])} />
        )}

        {!view && (
          <p className="border-t border-[#8a8a6a] bg-white px-3 py-6 text-center text-[12px] text-black/50">
            เลือกรายการทางขวาเพื่อเปิดหน้าทำงาน
          </p>
        )}
      </div>
    </div>
  );
}

/* ══ ฟอร์มบันทึก PI · ลอกสีเขียวและช่องทุกช่องจากของจริง ══════════════ */
function PiForm(p: {
  wo: string; setWo: (v: string) => void;
  piNo: string; setPiNo: (v: string) => void;
  customer: string; setCustomer: (v: string) => void;
  pi: PiLine[]; setPi: (v: PiLine[]) => void;
  pick: number; setPick: (v: number) => void;
  colour: number; setColour: (v: number) => void;
  qty: number; setQty: (v: number) => void;
}) {
  const box = 'border border-[#7f9db9] bg-white px-1 py-[1px] text-[12px]';
  return (
    <div className="border-t border-[#8a8a6a] bg-[#157a70] p-3 text-white">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
        <span className="text-xl font-bold">บันทึก PI</span>
        <label className="flex items-center gap-1 text-[12px]">
          เลือกรหัสลูกค้า
          <input value={p.customer} onChange={(e) => p.setCustomer(e.target.value)}
                 className={`${box} w-56 text-black`} />
        </label>
      </div>

      <div className="mt-2 grid gap-1 text-[12px] sm:grid-cols-2">
        <label className="flex items-center gap-1">
          <span className="w-40 shrink-0">วันที่ในใบเตรียมวัตถุดิบ</span>
          <input defaultValue="01/01/2002" className={`${box} w-28 text-black`} />
        </label>
        <label className="flex items-center gap-1">
          <span className="w-24 shrink-0 text-right">W/O NO</span>
          <input value={p.wo} onChange={(e) => p.setWo(e.target.value)}
                 className={`${box} w-32 text-black`} />
        </label>
        <label className="flex items-center gap-1">
          <span className="w-40 shrink-0">เลขที่ PI/เอกสารอ้างอิง</span>
          <input value={p.piNo} onChange={(e) => p.setPiNo(e.target.value)}
                 className={`${box} w-32 text-black`} />
        </label>
        <label className="flex items-center gap-1">
          <span className="w-24 shrink-0 text-right">ลำดับ W/O</span>
          <input defaultValue="0" className={`${box} w-16 text-right text-black`} />
        </label>
      </div>

      {/* เพิ่มรายการ */}
      <div className="mt-3 flex flex-wrap items-end gap-2 rounded bg-white/10 p-2 text-[12px]">
        <label className="flex flex-col">Model / ส่วนประกอบ
          <select value={p.pick} onChange={(e) => p.setPick(+e.target.value)}
                  className={`${box} text-black`}>
            {HEADS.map((h, i) => (
              <option key={h.costNo + h.partId} value={i}>
                {h.modelId} · {h.partId} · {h.costNo}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col">สี
          <select value={p.colour} onChange={(e) => p.setColour(+e.target.value)}
                  className={`${box} text-black`}>
            {COLOURS.map((c) => <option key={c.id} value={c.id}>{c.id} · {c.name}</option>)}
          </select>
        </label>
        <label className="flex flex-col">จำนวน
          <input type="number" min={1} value={p.qty}
                 onChange={(e) => p.setQty(Math.max(1, +e.target.value || 1))}
                 className={`${box} w-20 text-right text-black`} />
        </label>
        <button
          type="button"
          onClick={() => p.setPi([...p.pi, {
            key: String(Date.now()), costNo: HEADS[p.pick].costNo,
            partId: HEADS[p.pick].partId, colourId: p.colour, qty: p.qty,
          }])}
          className="border border-[#7f9db9] bg-[#ece9d8] px-6 py-[3px] text-black"
        >
          Add
        </button>
        <button
          type="button"
          onClick={() => p.setPi(p.pi.slice(0, -1))}
          disabled={p.pi.length === 0}
          className="border border-[#7f9db9] bg-[#ece9d8] px-6 py-[3px] text-black disabled:opacity-40"
        >
          Delete
        </button>
      </div>

      <p className="mt-3 text-[12px]">รายการใน PI</p>
      <div className="mt-1 overflow-x-auto border border-[#7f9db9] bg-white text-black">
        <table className="w-full min-w-[560px] text-[12px]">
          <thead className="bg-[#dcdcc8]">
            <tr>
              {['ลำดับ', 'เลขที่ Cost', 'รหัส Model', 'Model', 'ส่วนประกอบ', 'รหัสสี', 'ชื่อสี', 'จำนวนที่สั่ง'].map((h) => (
                <th key={h} className="border-r border-[#bbb] px-1 py-[2px] text-left font-normal">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {p.pi.map((r, i) => {
              const h = HEADS.find((x) => x.costNo === r.costNo && x.partId === r.partId);
              const c = COLOURS.find((x) => x.id === r.colourId);
              return (
                <tr key={r.key} className="border-t border-[#ddd]">
                  <td className="px-1">{i + 1}</td>
                  <td className="px-1">{r.costNo}</td>
                  <td className="px-1">{h?.modelId}</td>
                  <td className="px-1">{h?.modelId}</td>
                  <td className="px-1">{r.partId}</td>
                  <td className="px-1">{r.colourId}</td>
                  <td className="px-1">{c?.name}</td>
                  <td className="px-1 text-right tabular-nums">{r.qty.toFixed(2)}</td>
                </tr>
              );
            })}
            {p.pi.length === 0 && (
              <tr><td colSpan={8} className="px-2 py-3 text-center text-black/40">ยังไม่มีรายการ</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-white/70">
        ⚠️ ตัวทดลอง · กด Add แล้วยังไม่บันทึกลงฐานข้อมูลจริง
      </p>
    </div>
  );
}

/* ══ ใบขอเบิกวัตถุดิบ · หน้าตาเหมือนที่ปรินต์ออกมา ═══════════════════ */
function Slip(p: {
  head: CostHead; lines: CostLine[]; deps: number[]; counts: Map<number, number>;
  dep: number; setDep: (v: number) => void;
  slip: ReturnType<typeof slipFor>; hidden: ReturnType<typeof hiddenFor>; depName: string;
  wo: string; piNo: string; customer: string; qty: number;
  open: string; setOpen: (v: string) => void; view: string;
}) {
  const perUnit = p.view === 'use1';
  const shown = perUnit ? slipFor(p.lines, p.dep, 1) : p.slip;

  return (
    <div className="border-t border-[#8a8a6a] bg-white p-3 text-black">
      <div className="mb-2 flex flex-wrap gap-1 text-[12px]">
        {p.deps.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => p.setDep(d)}
            className={`border px-2 py-[2px] ${
              p.dep === d ? 'border-[#0a246a] bg-[#0a246a] text-white' : 'border-[#999] bg-[#ece9d8]'
            }`}
          >
            {DEPARTMENTS.find((x) => x.id === d)?.name} ({p.counts.get(d) ?? 0})
          </button>
        ))}
      </div>

      {/* กระดาษ */}
      <div className="border border-[#bbb] p-3 font-mono text-[12px]">
        <div className="grid gap-x-6 gap-y-0.5 sm:grid-cols-2">
          <div className="text-center font-bold sm:col-span-2">ใบขอเบิกวัตถุดิบ</div>
          <div>W/O NO <span className="font-bold">{p.wo}</span></div>
          <div>PI No : <span className="font-bold">{p.piNo}</span></div>
          <div>MODEL: <span className="font-bold">{p.head.modelId} ({p.head.costNo})</span></div>
          <div>แผนก : <span className="font-bold">{p.depName}</span></div>
          <div className="sm:col-span-2">ลูกค้า : {p.customer}</div>
          <div className="sm:col-span-2">
            {p.head.partId} , ขนาด W{p.head.w} D{p.head.d} H{p.head.h}
            {perUnit ? ' = 1 (ต่อ 1 หน่วย)' : ` = ${p.qty}`}
          </div>
        </div>

        <table className="mt-2 w-full border border-black text-[12px]">
          <thead>
            <tr className="border-b border-black">
              <th className="border-r border-black px-1 font-normal">NO.</th>
              <th className="border-r border-black px-1 text-left font-normal">PRODUCT</th>
              <th className="border-r border-black px-1 font-normal">หน่วย</th>
              <th className="border-r border-black px-1 font-normal">จำนวนตาม STD</th>
              <th className="border-r border-black px-1 font-normal">จำนวนที่<br />เบิกจริง</th>
              <th className="border-r border-black px-1 font-normal">ผลต่าง</th>
              <th className="px-1 font-normal">฿</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr
                key={r.item}
                onClick={() => p.setOpen(p.open === String(r.item) ? '' : String(r.item))}
                className="cursor-pointer border-b border-[#ccc] align-top hover:bg-[#fffbe6]"
              >
                <td className="border-r border-black px-1 text-center">{r.no}</td>
                <td className="border-r border-black px-1">
                  {r.name}
                  {p.open === String(r.item) && (
                    <span className="mt-0.5 block bg-[#fff3c4] px-1 text-[11px] text-black/80">
                      {explain(r, perUnit ? 1 : p.qty)}
                    </span>
                  )}
                </td>
                <td className="border-r border-black px-1 text-center">{r.unit1}</td>
                <td className="border-r border-black px-1 text-right tabular-nums">{r.issue}</td>
                <td className="border-r border-black px-1">&nbsp;</td>
                <td className="border-r border-black px-1">&nbsp;</td>
                <td className="px-1">&nbsp;</td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr><td colSpan={7} className="px-2 py-3 text-center text-black/40">แผนกนี้ไม่มีของต้องเบิก</td></tr>
            )}
          </tbody>
        </table>

        <p className="mt-2">
          รายการข้อมูลที่ไม่คิด COST:{' '}
          <span className="text-black/60">{p.hidden.map((h) => h.name).join(' · ') || '—'}</span>
        </p>
        <p className="mt-1">หมายเหตุ: ________________________________________</p>
        <div className="mt-3 grid gap-2 text-[11px] sm:grid-cols-3">
          <div>ผู้ออกเอกสาร : __________</div>
          <div>ผู้อนุมัติ : __________ <span className="block pl-10">หัวหน้าแผนก</span></div>
          <div>ผู้จ่าย : __________ <span className="block pl-8">สโตร์</span></div>
        </div>
      </div>

      <p className="mt-2 bg-[#fff3c4] px-2 py-1 text-[11px]">
        💡 กดที่ชื่อวัตถุดิบบรรทัดไหนก็ได้ เพื่อดูว่าตัวเลขคิดมาจากอะไร — ของเดิมใน Access ดูไม่ได้
      </p>
    </div>
  );
}

/* ══ หน้าดูสูตร ═══════════════════════════════════════════════════════ */
function CostForm({ head, lines, pick, setPick }: {
  head: CostHead; lines: CostLine[]; pick: number; setPick: (v: number) => void;
}) {
  return (
    <div className="border-t border-[#8a8a6a] bg-[#157a70] p-3 text-white">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xl font-bold">บันทึก Cost</span>
        <select value={pick} onChange={(e) => setPick(+e.target.value)}
                className="border border-[#7f9db9] bg-white px-1 text-[12px] text-black">
          {HEADS.map((h, i) => (
            <option key={h.costNo + h.partId} value={i}>{h.modelId} · {h.partId} · {h.costNo}</option>
          ))}
        </select>
        <span className="text-[12px]">
          W{head.w} D{head.d} H{head.h} · SH{head.sh} SW{head.sw} SD{head.sd}
          {head.leg && ` · ขา ${head.leg}`}
        </span>
      </div>

      <div className="mt-2 max-h-[420px] overflow-auto border border-[#7f9db9] bg-white text-black">
        <table className="w-full min-w-[720px] text-[12px]">
          <thead className="sticky top-0 bg-[#dcdcc8]">
            <tr>
              {['ลำดับ', 'วัตถุดิบ', 'ไม่แสดง\nในใบเบิก', 'หน่วย Cost', 'จำนวนที่ใช้', 'Rec_', 'ตัวหาร#2',
                'หน่วยเบิก', 'หมวด', 'แผนก', 'สี1', 'สี2'].map((h) => (
                <th key={h} className="whitespace-pre border-r border-[#bbb] px-1 py-[2px] text-left font-normal">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.item} className="border-t border-[#eee] hover:bg-[#fffbe6]">
                <td className="px-1 text-right">{l.item}</td>
                <td className="px-1">{l.name}</td>
                <td className="px-1 text-center">{l.hide ? '☑' : '☐'}</td>
                <td className="px-1">{l.unit}</td>
                <td className="px-1 text-right tabular-nums">{l.net}</td>
                <td className="px-1 text-right tabular-nums">{l.rec}</td>
                <td className="px-1 text-right tabular-nums">{l.rec1}</td>
                <td className="px-1">{l.unit1}</td>
                <td className="px-1">{GROUPS.find((g) => g.id === l.groupId)?.name ?? l.groupId}</td>
                <td className="px-1">{DEPARTMENTS.find((d) => d.id === l.depId)?.name ?? l.depId}</td>
                <td className="px-1 text-center">{l.c1 ? '☑' : '☐'}</td>
                <td className="px-1 text-center">{l.c2 ? '☑' : '☐'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-white/70">{lines.length} บรรทัด · ชื่อช่องตามที่ฟอร์ม Access เรียกทุกช่อง</p>
    </div>
  );
}

function SimpleList({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <div className="border-t border-[#8a8a6a] bg-white p-3">
      <p className="mb-1 font-bold">{title}</p>
      <table className="min-w-[280px] border border-[#bbb] text-[12px]">
        <tbody>
          {rows.map(([a, b], i) => (
            <tr key={i} className="border-b border-[#eee]">
              <td className="border-r border-[#ddd] px-2 py-[2px]">{a}</td>
              <td className="px-2 py-[2px] text-black/70">{b}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
