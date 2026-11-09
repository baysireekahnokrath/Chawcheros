'use client';

/**
 * ประตู PIN ของหน้าจัดชุดฟีนิกซ์
 *
 * ★ ไม่ต้องล็อกอิน (Bay 2026-11-09 "ใช้กันแค่ Bay กับ Book สองคนครับ")
 *   เข้าด้วย PIN ที่ Bay ตั้งเอง · ใส่ครั้งเดียวต่อเครื่อง จำไว้ใน localStorage
 *
 * ★ กันข้อมูลที่ฐานข้อมูล ไม่ใช่ที่หน้าจอ
 *   อ่านผ่าน pricing.phoenix_sheet(p_pin) ที่เป็น security definer
 *   ฟังก์ชันคืนเฉพาะแถวของฟีนิกซ์ และไม่มีช่องต้นทุนสักช่อง
 *   ถ้า PIN ผิด ฐานข้อมูลโยน pin_invalid ออกมา ไม่คืนข้อมูลเลย — ดู migration 0047
 *
 * ★ แบบแปลนเป็นไฟล์ใน /public ไม่ได้กัน · เป็นภาพลายเส้นเปล่า ไม่มีราคา
 */

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { buildPhoenix, type Item } from '@/modules/phoenix/build';
import type { PriceRow } from '@/modules/pricing/queries';
import Configurator from './Configurator';

const LS = 'chawcher-phx-pin';

const lsGet = () => {
  try {
    return localStorage.getItem(LS) ?? '';
  } catch {
    return '';
  }
};
const lsSet = (v: string) => {
  try {
    if (v) localStorage.setItem(LS, v);
    else localStorage.removeItem(LS);
  } catch {
    /* โหมดส่วนตัวของเบราว์เซอร์เขียนไม่ได้ · ใช้ได้ต่อ แค่ต้องใส่ PIN ใหม่รอบหน้า */
  }
};

/** คืนรายการสินค้า หรือโยน Error ที่มี .pin = true ถ้า PIN ไม่ผ่าน */
async function fetchSheet(pin: string): Promise<Item[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .schema('pricing')
    .rpc('phoenix_sheet', { p_pin: pin });

  if (error) {
    const bad = /pin_invalid/.test([error.message, error.details, error.hint].join(' '));
    const e = new Error(
      bad
        ? 'PIN ไม่ถูกต้อง'
        : [error.message, error.hint].filter(Boolean).join(' · ') || 'ต่อระบบไม่ได้',
    ) as Error & { pin?: boolean };
    e.pin = bad;
    throw e;
  }
  return buildPhoenix((data ?? []) as PriceRow[]);
}

export default function PhoenixGate() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [state, setState] = useState<'boot' | 'loading' | 'ask' | 'ready'>('boot');
  const [pinIn, setPinIn] = useState('');
  const [msg, setMsg] = useState('');

  const run = useCallback(async (pin: string, remember: boolean) => {
    try {
      const list = await fetchSheet(pin);
      if (remember) lsSet(pin);
      setItems(list);
      setState('ready');
    } catch (err) {
      const e = err as Error & { pin?: boolean };
      if (e.pin) lsSet('');
      setMsg(e.message);
      setState('ask');
    }
  }, []);

  const open = useCallback(
    (pin: string, remember: boolean) => {
      setState('loading');
      setMsg('');
      void run(pin, remember);
    },
    [run],
  );

  /* PIN ที่จำไว้ในเครื่อง · เข้าให้เลยไม่ต้องถามซ้ำ
     localStorage อ่านได้แค่ตอน mount (ฝั่งเซิร์ฟเวอร์ไม่มี) จึงต้องตั้ง state ที่นี่
     แบบเดียวกับ components/content/Calendar.tsx */
  useEffect(() => {
    const saved = lsGet();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(saved ? 'loading' : 'ask');
    if (saved) void run(saved, false);
  }, [run]);

  if (state === 'ready' && items) {
    return (
      <>
        <Configurator items={items} />
        <p className="mt-10 text-center text-xs text-muted">
          <button
            type="button"
            onClick={() => {
              lsSet('');
              setItems(null);
              setPinIn('');
              setMsg('ออกแล้ว · เครื่องนี้จะถาม PIN อีกครั้ง');
              setState('ask');
            }}
            className="underline underline-offset-2"
          >
            ลืม PIN ในเครื่องนี้
          </button>
        </p>
      </>
    );
  }

  if (state === 'boot' || (state === 'loading' && !items)) {
    return (
      <div className="grid min-h-[60dvh] place-items-center">
        <p className="text-sm text-muted">กำลังเปิดใบราคา…</p>
      </div>
    );
  }

  return (
    <div className="grid min-h-[70dvh] place-items-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">จัดชุดฟีนิกซ์</h1>
          <p className="mt-1 text-sm text-muted">ฌ เฌอ · Phoenix</p>
        </div>

        <form
          autoComplete="off"
          onSubmit={(e) => {
            e.preventDefault();
            const p = pinIn.trim();
            if (p) open(p, true);
          }}
          className="rounded-2xl border border-border bg-surface p-6 shadow-sm"
        >
          <label className="block text-sm font-medium" htmlFor="phxpin">
            PIN
          </label>
          <input
            id="phxpin"
            type="password"
            required
            autoFocus
            autoComplete="off"
            value={pinIn}
            onChange={(e) => setPinIn(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-border bg-bg px-3 py-2.5 tracking-widest outline-none focus:border-accent"
          />
          <p className="mt-2 text-xs text-muted">ใส่ครั้งเดียวต่อเครื่อง · PIN ตั้งโดย Bay</p>

          {msg && (
            <p role="alert" className="mt-4 rounded-lg bg-warn/10 px-3 py-2 text-sm text-warn">
              {msg}
            </p>
          )}

          <button
            type="submit"
            disabled={state === 'loading'}
            className="mt-6 w-full rounded-xl bg-accent px-4 py-3 font-medium text-accent-fg disabled:opacity-60"
          >
            {state === 'loading' ? 'กำลังตรวจ…' : 'เข้าใช้งาน'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-muted">
          หน้านี้ไม่ต้องล็อกอิน · มีแค่ขนาดกับราคาขาย ไม่มีต้นทุน
        </p>
      </div>
    </div>
  );
}
