'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type Item = { name: string; v: string; price: number; qty: number };
type Sale = {
  id: string; bill_no: string; sold_at: string; sold_on: string; event_name: string; seller: string;
  items: Item[]; subtotal: number; discount_type: 'baht' | 'pct'; discount_value: number; discount: number;
  total: number; pay: string; customer: string; phone: string; note: string; status: 'ปกติ' | 'ยกเลิก';
  edited_at: string | null;
  ship_method: 'รับเอง' | 'EMS' | 'Door to door'; ship_address: string; ship_postcode: string; label_printed_at: string | null;
};
type Sender = { sender_name: string; sender_address: string; sender_phone: string };
const SHIPS = ['รับเอง', 'EMS', 'Door to door'] as const;

const baht = (n: number) => Number(n).toLocaleString('th-TH', { maximumFractionDigits: 2 });
const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Bangkok' });
const PAYS = ['โอน', 'เงินสด', 'บัตร'];
const field = 'w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm';

function calc(items: Item[], type: string, value: number) {
  const sub = items.reduce((s, l) => s + l.price * l.qty, 0);
  let d = type === 'pct' ? (sub * Math.min(value, 100)) / 100 : value;
  d = Math.round(Math.min(Math.max(d, 0), sub) * 100) / 100;
  return { sub, disc: d, total: Math.round((sub - d) * 100) / 100 };
}

export default function PosAdminPage() {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<Sale[]>([]);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState(today());
  const [seller, setSeller] = useState('');
  const [showVoid, setShowVoid] = useState(true);
  const [edit, setEdit] = useState<Sale | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const [pin, setPin] = useState('');
  const [msg, setMsg] = useState('');
  const [shipFilter, setShipFilter] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [labelSize, setLabelSize] = useState<'100x150' | 'a4'>('100x150');
  const [printList, setPrintList] = useState<Sale[]>([]);
  const [sender, setSender] = useState<Sender>({ sender_name: '', sender_address: '', sender_phone: '' });

  const [tick, setTick] = useState(0);
  const load = useCallback(() => setTick((n) => n + 1), []);

  // โหลดบิลตามช่วงวัน · รีเฟรชเองทุก 30 วินาที และทุกครั้งที่แก้/ลบ (load)
  useEffect(() => {
    let alive = true;
    const fetchRows = async () => {
      const { data, error } = await supabase.schema('pos').from('sales').select('*')
        .gte('sold_on', from).lte('sold_on', to).order('sold_at', { ascending: false }).limit(2000);
      if (!alive) return;
      if (error) setErr('โหลดบิลไม่ได้: ' + error.message + ' (ต้องมีสิทธิ์ admin และรัน migration 0037 แล้ว)');
      else { setErr(''); setRows((data ?? []) as Sale[]); }
      setLoading(false);
    };
    const fetchSender = async () => {
      const { data } = await supabase.schema('pos').from('settings').select('sender_name, sender_address, sender_phone').eq('id', 1).maybeSingle();
      if (alive && data) setSender(data as Sender);
    };
    fetchRows();
    if (tick === 0) fetchSender();
    const t = setInterval(fetchRows, 30000);
    return () => { alive = false; clearInterval(t); };
  }, [supabase, from, to, tick]);

  const sellers = [...new Set(rows.map((r) => r.seller))].sort();
  const list = rows.filter((r) => (!seller || r.seller === seller) && (showVoid || r.status !== 'ยกเลิก') && (!shipFilter || (r.ship_method ?? 'รับเอง') === shipFilter));
  const shippable = list.filter((r) => r.status !== 'ยกเลิก' && r.ship_method && r.ship_method !== 'รับเอง');
  const togglePick = (id: string) => setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  // พิมพ์ใบปะหน้า: วาด label ลงหน้า แล้วสั่งพิมพ์หลังวาดเสร็จ
  useEffect(() => {
    if (!printList.length) return;
    const t = setTimeout(() => window.print(), 150);
    const done = () => setPrintList([]);
    window.addEventListener('afterprint', done, { once: true });
    return () => { clearTimeout(t); window.removeEventListener('afterprint', done); };
  }, [printList]);

  async function printLabels() {
    const sel = shippable.filter((r) => picked.has(r.id));
    if (!sel.length) { setMsg('เลือกบิลที่จะพิมพ์ก่อน (ติ๊กช่องหน้าเลขบิล)'); return; }
    if (!sender.sender_address) setMsg('ยังไม่ได้ใส่ที่อยู่ผู้ส่ง · ใส่ได้ที่ส่วน "ผู้ส่งบนใบปะหน้า" ด้านล่าง');
    await supabase.schema('pos').from('sales').update({ label_printed_at: new Date().toISOString() }).in('id', sel.map((r) => r.id));
    setPrintList(sel); setPicked(new Set()); load();
  }
  async function saveSender() {
    const { error } = await supabase.schema('pos').rpc('set_sender', { p_name: sender.sender_name, p_address: sender.sender_address, p_phone: sender.sender_phone });
    setMsg(error ? 'บันทึกผู้ส่งไม่สำเร็จ: ' + error.message : 'บันทึกที่อยู่ผู้ส่งแล้ว');
  }
  const ok = list.filter((r) => r.status !== 'ยกเลิก');
  const sum = ok.reduce((a, r) => a + Number(r.total), 0);
  const by = (p: string) => ok.filter((r) => r.pay === p).reduce((a, r) => a + Number(r.total), 0);

  async function save(s: Sale, note: string) {
    const { error } = await supabase.schema('pos').from('sales').update({
      items: s.items, discount_type: s.discount_type, discount_value: s.discount_value, pay: s.pay, seller: s.seller,
      customer: s.customer, phone: s.phone, note: s.note, status: s.status, edited_at: new Date().toISOString(),
      ship_method: s.ship_method ?? 'รับเอง', ship_address: s.ship_address ?? '', ship_postcode: (s.ship_postcode ?? '').replace(/\D/g, '').slice(0, 5),
    }).eq('id', s.id);
    if (error) { setMsg('บันทึกไม่สำเร็จ: ' + error.message); return; }
    setMsg(note); setEdit(null); load();
  }
  async function remove(id: string) {
    const { error } = await supabase.schema('pos').from('sales').delete().eq('id', id);
    if (error) { setMsg('ลบไม่สำเร็จ: ' + error.message); return; }
    setMsg('ลบบิลแล้ว'); setEdit(null); setConfirmDel(false); load();
  }
  async function changePin() {
    const { error } = await supabase.schema('pos').rpc('set_pin', { p_pin: pin });
    setMsg(error ? 'เปลี่ยน PIN ไม่สำเร็จ: ' + (error.message.includes('short') ? 'ต้องยาวอย่างน้อย 6 ตัว' : error.message) : 'เปลี่ยน PIN แล้ว · เครื่องหน้าบูธจะถูกถาม PIN ใหม่');
    if (!error) setPin('');
  }
  function csv() {
    const head = ['เลขบิล', 'วันที่', 'เวลา', 'สินค้า', 'ตัวเลือก', 'จำนวน', 'ราคา/ชิ้น', 'รวมรายการ', 'ส่วนลดบิล', 'ยอดสุทธิบิล', 'ชำระ', 'ลูกค้า', 'เบอร์', 'หมายเหตุ', 'คนขาย', 'สถานะ', 'วิธีรับ', 'ที่อยู่', 'รหัสไปรษณีย์'];
    const cell = (v: unknown) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const lines = [head];
    list.forEach((r) => r.items.forEach((l, i) => lines.push([r.bill_no, r.sold_on, new Date(r.sold_at).toLocaleTimeString('th-TH'), l.name, l.v, l.qty, l.price, l.price * l.qty, i === 0 ? r.discount : '', i === 0 ? r.total : '', r.pay, r.customer, r.phone, r.note, r.seller, r.status, r.ship_method ?? 'รับเอง', r.ship_address ?? '', r.ship_postcode ?? ''].map(String))));
    const blob = new Blob(['﻿' + lines.map((r) => r.map(cell).join(',')).join('\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `pos-sales-${from}-${to}.csv`; a.click();
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">ขายหน้าบูธ · หลังบ้าน</h1>
          <p className="mt-1 text-sm text-muted">ลิงก์ให้ทีมหน้าบูธ: <a className="text-accent underline" href="/pos" target="_blank">/pos</a> · อัปเดตเองทุก 30 วินาที</p>
        </div>
        <button onClick={csv} className="rounded-xl border border-border bg-surface px-4 py-2 text-sm">ดาวน์โหลด CSV</button>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3 text-sm">
        <label className="grid gap-1 text-muted">ตั้งแต่<input type="date" className={field} value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="grid gap-1 text-muted">ถึง<input type="date" className={field} value={to} onChange={(e) => setTo(e.target.value)} /></label>
        <label className="grid gap-1 text-muted">คนขาย
          <select className={field} value={seller} onChange={(e) => setSeller(e.target.value)}>
            <option value="">ทุกคน</option>{sellers.map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-muted">วิธีรับ
          <select className={field} value={shipFilter} onChange={(e) => setShipFilter(e.target.value)}>
            <option value="">ทั้งหมด</option>{SHIPS.map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 pb-2 text-muted"><input type="checkbox" checked={showVoid} onChange={(e) => setShowVoid(e.target.checked)} />แสดงบิลยกเลิก</label>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[['ยอดสุทธิ', '฿' + baht(sum)], ['จำนวนบิล', String(ok.length)], ['โอน / QR', '฿' + baht(by('โอน'))], ['เงินสด · บัตร', `฿${baht(by('เงินสด'))} · ${baht(by('บัตร'))}`]].map(([k, v]) => (
          <div key={k} className="rounded-2xl border border-border bg-surface p-3"><p className="text-xs text-muted">{k}</p><p className="text-lg font-semibold tabular-nums text-accent">{v}</p></div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-surface p-3 text-sm">
        <span className="font-medium">ใบปะหน้า</span>
        <button className="rounded-xl border border-border px-3 py-1.5" onClick={() => setPicked(new Set(shippable.filter((r) => r.ship_method === 'EMS' && !r.label_printed_at).map((r) => r.id)))}>เลือก EMS ที่ยังไม่พิมพ์</button>
        <button className="rounded-xl border border-border px-3 py-1.5" onClick={() => setPicked(new Set(shippable.map((r) => r.id)))}>เลือกบิลส่งของทั้งหมด</button>
        <select className={field + ' w-auto'} value={labelSize} onChange={(e) => setLabelSize(e.target.value as '100x150' | 'a4')} aria-label="ขนาดกระดาษ">
          <option value="100x150">สติกเกอร์ 100×150 มม.</option><option value="a4">A4 (4 ใบต่อหน้า)</option>
        </select>
        <button className="rounded-xl bg-accent px-4 py-1.5 font-medium text-accent-fg" onClick={printLabels}>พิมพ์ใบปะหน้า ({picked.size})</button>
      </div>

      {msg && <p className="mt-3 rounded-xl bg-accent/10 px-3 py-2 text-sm">{msg}</p>}
      {err && <p className="mt-3 rounded-xl border border-danger px-3 py-2 text-sm text-danger">{err}</p>}

      <div className="mt-4 overflow-x-auto rounded-2xl border border-border bg-surface">
        <table className="w-full text-sm tabular-nums">
          <thead className="text-left text-xs text-muted"><tr>{['', 'เลขบิล', 'เวลา', 'รายการ', 'ส่วนลด', 'ยอด', 'ชำระ', 'รับสินค้า', 'ลูกค้า', 'คนขาย', ''].map((h) => <th key={h} className="whitespace-nowrap px-3 py-2 font-medium">{h}</th>)}</tr></thead>
          <tbody>
            {loading && !rows.length ? <tr><td colSpan={11} className="px-3 py-4 text-muted">กำลังโหลด…</td></tr>
              : !list.length ? <tr><td colSpan={11} className="px-3 py-4 text-muted">ยังไม่มีบิลในช่วงนี้</td></tr>
              : list.map((r) => (
                <tr key={r.id} className={'border-t border-border align-top ' + (r.status === 'ยกเลิก' ? 'text-muted line-through' : '')}>
                  <td className="px-3 py-2">{r.ship_method && r.ship_method !== 'รับเอง' && r.status !== 'ยกเลิก' && <input type="checkbox" aria-label={'เลือก ' + r.bill_no} checked={picked.has(r.id)} onChange={() => togglePick(r.id)} />}</td>
                  <td className="px-3 py-2">{r.bill_no}{r.edited_at && <span className="ml-1 text-xs text-warn no-underline">แก้ไขแล้ว</span>}</td>
                  <td className="whitespace-nowrap px-3 py-2">{new Date(r.sold_at).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}</td>
                  <td className="px-3 py-2">{r.items.map((l) => `${l.name}${l.v ? ' ' + l.v : ''}${l.qty > 1 ? ' ×' + l.qty : ''}`).join(', ')}</td>
                  <td className="px-3 py-2 text-right">{Number(r.discount) ? '−' + baht(r.discount) : ''}</td>
                  <td className="px-3 py-2 text-right font-medium">฿{baht(r.total)}</td>
                  <td className="px-3 py-2">{r.pay}</td>
                  <td className="whitespace-nowrap px-3 py-2">{r.ship_method ?? 'รับเอง'}{r.label_printed_at && <span className="ml-1 text-xs text-ok no-underline">พิมพ์แล้ว</span>}</td>
                  <td className="px-3 py-2">{r.customer} {r.phone}{r.ship_address && <span className="block text-xs text-muted">{r.ship_address} {r.ship_postcode}</span>}</td>
                  <td className="px-3 py-2">{r.seller}</td>
                  <td className="px-3 py-2"><button className="rounded-lg border border-border px-2 py-1 text-xs no-underline" onClick={() => { setEdit(JSON.parse(JSON.stringify(r))); setConfirmDel(false); }}>แก้ไข</button></td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-surface p-4 text-sm">
        <h2 className="font-semibold">ผู้ส่งบนใบปะหน้า</h2>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <label className="grid gap-1 text-muted">ชื่อผู้ส่ง<input className={field} value={sender.sender_name} onChange={(e) => setSender({ ...sender, sender_name: e.target.value })} /></label>
          <label className="grid gap-1 text-muted">เบอร์โทร<input className={field} value={sender.sender_phone} onChange={(e) => setSender({ ...sender, sender_phone: e.target.value })} /></label>
          <label className="grid gap-1 text-muted sm:col-span-2">ที่อยู่ผู้ส่ง (ใส่บ้านเลขที่ด้วย)<textarea className={field} rows={2} value={sender.sender_address} onChange={(e) => setSender({ ...sender, sender_address: e.target.value })} /></label>
        </div>
        <button onClick={saveSender} className="mt-2 rounded-xl bg-accent px-4 py-2 text-accent-fg">บันทึกผู้ส่ง</button>
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-surface p-4 text-sm">
        <h2 className="font-semibold">PIN ร้าน</h2>
        <p className="mt-1 text-muted">ทีมหน้าบูธใส่ PIN นี้ครั้งเดียวต่อเครื่อง · เปลี่ยนแล้วทุกเครื่องต้องใส่ใหม่</p>
        <div className="mt-2 flex gap-2"><input className={field + ' max-w-48'} inputMode="numeric" placeholder="PIN ใหม่ 6 ตัวขึ้นไป" value={pin} onChange={(e) => setPin(e.target.value)} /><button onClick={changePin} className="rounded-xl bg-accent px-4 py-2 text-accent-fg">เปลี่ยน PIN</button></div>
      </div>

      {edit && (() => {
        const t = calc(edit.items, edit.discount_type, Number(edit.discount_value) || 0);
        const set = (p: Partial<Sale>) => setEdit({ ...edit, ...p });
        const setItem = (i: number, p: Partial<Item>) => set({ items: edit.items.map((l, j) => (j === i ? { ...l, ...p } : l)) });
        return (
          <div className="fixed inset-0 z-20 grid place-items-center bg-black/40 p-4" onClick={() => setEdit(null)}>
            <div className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl bg-surface p-5 text-sm" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-base font-semibold">แก้ไข {edit.bill_no} {edit.status === 'ยกเลิก' && <span className="text-danger">· ยกเลิกอยู่</span>}</h2>
              <div className="mt-3 grid gap-2">
                {edit.items.map((l, i) => (
                  <div key={i} className="grid grid-cols-[1fr_70px_100px] gap-2">
                    <input className={field} value={l.name + (l.v ? ' · ' + l.v : '')} onChange={(e) => setItem(i, { name: e.target.value, v: '' })} aria-label="สินค้า" />
                    <input className={field} inputMode="numeric" value={l.qty} onChange={(e) => setItem(i, { qty: Math.max(0, +e.target.value || 0) })} aria-label="จำนวน" />
                    <input className={field} inputMode="numeric" value={l.price} onChange={(e) => setItem(i, { price: Math.max(0, +e.target.value || 0) })} aria-label="ราคาต่อชิ้น" />
                  </div>
                ))}
                <div className="grid grid-cols-2 gap-2">
                  <label className="grid gap-1 text-muted">ส่วนลด<input className={field} inputMode="decimal" value={edit.discount_value} onChange={(e) => set({ discount_value: +e.target.value || 0 })} /></label>
                  <label className="grid gap-1 text-muted">หน่วย<select className={field} value={edit.discount_type} onChange={(e) => set({ discount_type: e.target.value as 'baht' | 'pct' })}><option value="baht">บาท</option><option value="pct">%</option></select></label>
                  <label className="grid gap-1 text-muted">ชำระ<select className={field} value={edit.pay} onChange={(e) => set({ pay: e.target.value })}>{PAYS.map((p) => <option key={p}>{p}</option>)}</select></label>
                  <label className="grid gap-1 text-muted">คนขาย<input className={field} value={edit.seller} onChange={(e) => set({ seller: e.target.value })} /></label>
                  <label className="grid gap-1 text-muted">ลูกค้า<input className={field} value={edit.customer} onChange={(e) => set({ customer: e.target.value })} /></label>
                  <label className="grid gap-1 text-muted">เบอร์<input className={field} value={edit.phone} onChange={(e) => set({ phone: e.target.value })} /></label>
                </div>
                <div className="grid grid-cols-[1fr_110px] gap-2">
                  <label className="grid gap-1 text-muted">วิธีรับสินค้า<select className={field} value={edit.ship_method ?? 'รับเอง'} onChange={(e) => set({ ship_method: e.target.value as Sale['ship_method'] })}>{SHIPS.map((s) => <option key={s}>{s}</option>)}</select></label>
                  <label className="grid gap-1 text-muted">รหัสไปรษณีย์<input className={field} inputMode="numeric" maxLength={5} value={edit.ship_postcode ?? ''} onChange={(e) => set({ ship_postcode: e.target.value })} /></label>
                </div>
                <label className="grid gap-1 text-muted">ที่อยู่จัดส่ง<textarea className={field} rows={2} value={edit.ship_address ?? ''} onChange={(e) => set({ ship_address: e.target.value })} /></label>
                <label className="grid gap-1 text-muted">หมายเหตุ<input className={field} value={edit.note} onChange={(e) => set({ note: e.target.value })} /></label>
                <p className="text-base font-semibold text-accent">ยอดสุทธิใหม่ ฿{baht(t.total)} <span className="text-sm font-normal text-muted">(รวม ฿{baht(t.sub)} ลด ฿{baht(t.disc)})</span></p>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button className="rounded-xl bg-accent px-4 py-2 text-accent-fg" onClick={() => save({ ...edit, items: edit.items.filter((l) => l.qty > 0) }, 'แก้ไขบิลแล้ว')}>บันทึก</button>
                <button className="rounded-xl border border-border px-4 py-2" onClick={() => setEdit(null)}>ปิด</button>
                <button className="rounded-xl border border-danger px-4 py-2 text-danger" onClick={() => save({ ...edit, status: edit.status === 'ยกเลิก' ? 'ปกติ' : 'ยกเลิก' }, edit.status === 'ยกเลิก' ? 'คืนสถานะบิลแล้ว' : 'ยกเลิกบิลแล้ว')}>{edit.status === 'ยกเลิก' ? 'คืนสถานะบิล' : 'ยกเลิกบิล'}</button>
                <button className="rounded-xl border border-danger px-4 py-2 text-danger" onClick={() => setConfirmDel(true)}>ลบถาวร</button>
              </div>
              {confirmDel && (
                <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-danger/10 p-3 text-danger">
                  ลบ {edit.bill_no} ถาวร กู้คืนไม่ได้
                  <button className="rounded-lg border border-danger px-3 py-1" onClick={() => remove(edit.id)}>ยืนยันลบ</button>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      <style>{`
        @media screen { .pos-labels { display: none; } }
        @media print {
          @page { size: ${labelSize === 'a4' ? 'A4' : '100mm 150mm'}; margin: 0; }
          body * { visibility: hidden !important; }
          .pos-labels, .pos-labels * { visibility: visible !important; }
          .pos-labels { position: absolute; left: 0; top: 0; width: ${labelSize === 'a4' ? '210mm' : '100mm'}; color: #000; background: #fff; }
          .pos-labels.a4 { display: grid; grid-template-columns: 105mm 105mm; grid-auto-rows: 148.5mm; }
          .pos-label { box-sizing: border-box; width: ${labelSize === 'a4' ? '105mm' : '100mm'}; height: ${labelSize === 'a4' ? '148.5mm' : '150mm'}; padding: 6mm; display: flex; flex-direction: column; gap: 3mm; font-family: Tahoma, sans-serif; overflow: hidden; break-inside: avoid; }
          .pos-labels:not(.a4) .pos-label { break-after: page; }
          .pos-labels.a4 .pos-label { border: 0.3mm dashed #999; }
          .pos-labels.a4 .pos-label:nth-child(4n) { break-after: page; }
          .pos-label .tag { align-self: flex-start; border: 0.6mm solid #000; padding: 1mm 3mm; font-size: 16pt; font-weight: 700; letter-spacing: 1pt; }
          .pos-label .from { font-size: 8.5pt; line-height: 1.35; border-bottom: 0.3mm solid #000; padding-bottom: 2mm; }
          .pos-label .to { flex: 1; font-size: 13pt; line-height: 1.4; }
          .pos-label .to b { font-size: 16pt; }
          .pos-label .pc { display: flex; gap: 1.5mm; margin-top: 2mm; }
          .pos-label .pc span { width: 8mm; height: 10mm; border: 0.4mm solid #000; display: grid; place-items: center; font-size: 15pt; font-weight: 700; }
          .pos-label .meta { font-size: 8pt; border-top: 0.3mm solid #000; padding-top: 2mm; line-height: 1.35; }
        }
      `}</style>
      <div className={'pos-labels' + (labelSize === 'a4' ? ' a4' : '')} aria-hidden>
        {printList.map((r) => (
          <div key={r.id} className="pos-label">
            <div className="tag">{r.ship_method === 'EMS' ? 'EMS' : 'DOOR TO DOOR'}</div>
            <div className="from"><b>ผู้ส่ง</b> {sender.sender_name}<br />{sender.sender_address}<br />โทร {sender.sender_phone}</div>
            <div className="to">
              <div style={{ fontSize: '9pt' }}>ผู้รับ</div>
              <b>{r.customer}</b><br />โทร {r.phone}<br />{r.ship_address}
              <div className="pc">{(r.ship_postcode || '     ').padEnd(5, ' ').split('').map((c, i) => <span key={i}>{c.trim()}</span>)}</div>
            </div>
            <div className="meta">บิล {r.bill_no} · {new Date(r.sold_at).toLocaleDateString('th-TH')} · CHAW CHER<br />{r.items.map((l) => `${l.name}${l.v ? ' ' + l.v : ''} ×${l.qty}`).join(', ')}</div>
          </div>
        ))}
      </div>
    </>
  );
}
