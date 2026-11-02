/**
 * ดึง Google Sheet → sheets.* (0035) · ทางเดียว อ่านอย่างเดียว
 *
 * ★ ดึงเฉพาะคอลัมน์ที่ต้องใช้ · คอลัมน์ชื่อ/เบอร์/ที่อยู่ลูกค้า และต้นทุน ไม่ถูกขอจาก Google เลย
 *   (อ่านหัวตารางก่อน แล้วขอทีละคอลัมน์) · ใบ PO ขอตั้งแต่แถวรายการ ข้ามหัวกระดาษที่มีชื่อลูกค้า
 * ดึงไม่สำเร็จ = ข้อมูลเดิมยังอยู่ + จดสาเหตุ (F1 · F5)
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { q, read, tabs } from './google';
import * as P from './parse';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- ไม่มีไฟล์ type ของฐานข้อมูล
let client: SupabaseClient<any, 'sheets'> | null = null;
function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !key) throw new Error('ยังไม่ได้ใส่ SUPABASE_SECRET_KEY ใน Vercel');
  client ??= createClient(url, key, { db: { schema: 'sheets' }, auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}

type Source = { id: string; spreadsheet_id: string; tab: string | null };
export type SyncResult = Record<string, { ok: boolean; rows?: number; tab?: string | null; error?: string; warnings?: number }>;

const letter = (i: number) => {
  let s = '', n = i + 1;
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
};

/** อ่านเฉพาะคอลัมน์ที่ระบุ แล้วประกอบกลับเป็นแถว (ช่องอื่นว่าง) */
async function readColumns(id: string, tab: string, header: string[], want: (h: string) => boolean, maxRow = 3000) {
  const idx = header.map((h, i) => (want((h ?? '').replace(/\s+/g, ' ').trim()) ? i : -1)).filter((i) => i >= 0);
  const cols = await read(id, idx.map((i) => `${q(tab)}!${letter(i)}2:${letter(i)}${maxRow}`));
  const rows: string[][] = [header];
  cols.forEach((col, k) => col.forEach((cell, r) => {
    rows[r + 1] ??= [];
    rows[r + 1][idx[k]] = cell?.[0] ?? '';
  }));
  for (let r = 1; r < rows.length; r++) rows[r] ??= [];
  return rows;
}

async function save(id: string, rows: unknown[], meta: { tab?: string | null; warnings?: string[] }) {
  const { data, error } = await db().rpc('replace_source', { p_source: id, p_rows: rows, p_meta: meta });
  if (error) throw new Error('บันทึกไม่ได้: ' + error.message);
  return data as number;
}

const ORDER_COLS = new Set(['PO', 'w/o', 'วันที่สั่งซื้อ', 'รายการ', 'กำหนดส่งของ']);

const JOBS: Record<string, (s: Source) => Promise<{ rows: unknown[]; tab: string | null; warnings: string[] }>> = {
  async orders(s) {
    const tab = 'order2026';
    const [[head]] = await read(s.spreadsheet_id, [`${q(tab)}!A1:AZ1`]);
    const v = await readColumns(s.spreadsheet_id, tab, head ?? [], (h) => ORDER_COLS.has(h));
    const r = P.parseOrders(v);
    return { rows: r.rows, tab, warnings: r.warnings };
  },
  async po(s) {
    const list = P.poTabs(await tabs(s.spreadsheet_id));
    // E12:E13 = กำหนดส่ง · A14:F80 = รายการ · ไม่ขอแถว 1-11 (ชื่อ ที่อยู่ เบอร์ลูกค้า) และไม่ขอ A12:A13 (สถานที่ส่ง)
    const ranges = list.flatMap(({ tab }) => [`${q(tab)}!E12:E13`, `${q(tab)}!A14:F80`]);
    const got = await read(s.spreadsheet_id, ranges);
    const rows: P.PoLine[] = [];
    const warnings: string[] = [];
    list.forEach(({ tab, bls }, i) => {
      const due = got[i * 2].map((r) => ['', '', '', '', r?.[0] ?? '']);
      const lines = P.parsePoTab(bls, tab, [...due, ...got[i * 2 + 1]]);
      if (lines.length === 0) warnings.push(`แท็บ ${tab}: ไม่เจอรายการสินค้า (หน้าตาใบ PO ต่างจากแบบใหม่)`);
      rows.push(...lines);
    });
    return { rows, tab: `${list.length} แท็บ`, warnings };
  },
  async stock(s) {
    const tab = P.latestTab(await tabs(s.spreadsheet_id), /^CHAW CHER STOCK/i);
    if (!tab) throw new Error('หาแท็บ "CHAW CHER STOCK วว-ดด-ปป" ไม่เจอ');
    const [[head]] = await read(s.spreadsheet_id, [`${q(tab)}!A1:AZ1`]);
    // ★ ไม่ขอคอลัมน์ต้นทุน/มูลค่าเลย
    const v = await readColumns(s.spreadsheet_id, tab, head ?? [], (h) => !!h && !/cost|value|ต้นทุน/i.test(h), 1500);
    const r = P.parseStock(v);
    return { rows: r.rows, tab, warnings: r.warnings };
  },
  async fabric(s) {
    const tab = P.latestTab(await tabs(s.spreadsheet_id), /^STOCK\s*ผ้า/i);
    if (!tab) throw new Error('หาแท็บ "STOCKผ้า+หนัง วว-ดด-ปป" ไม่เจอ');
    const [v] = await read(s.spreadsheet_id, [`${q(tab)}!A1:Z600`]);
    const rows = P.parseFabric(v);
    return { rows, tab, warnings: rows.length ? [] : ['ไม่เจอกองผ้า (แถว 2 ต้องมี NO | ชื่อกอง | STOCK)'] };
  },
  async clearance(s) {
    const tab = (await tabs(s.spreadsheet_id))[0];
    const [v] = await read(s.spreadsheet_id, [`${q(tab)}!A1:AH1000`]);
    return { rows: P.parseClearance(v), tab, warnings: [] };
  },
};

let running: Promise<SyncResult> | null = null;

/** ดึงทุกแหล่ง · เรียกซ้อนกันได้ จะรอรอบที่กำลังวิ่งอยู่ */
export function syncAll(): Promise<SyncResult> {
  running ??= (async () => {
    const out: SyncResult = {};
    const { data, error } = await db().rpc('list_sources');
    if (error) throw new Error('อ่านรายชื่อชีตไม่ได้: ' + error.message);
    await Promise.all((data as Source[]).map(async (s) => {
      const job = JOBS[s.id];
      if (!job) return;
      try {
        const r = await job(s);
        const n = await save(s.id, r.rows, { tab: r.tab, warnings: r.warnings.slice(0, 50) });
        out[s.id] = { ok: true, rows: n, tab: r.tab, warnings: r.warnings.length };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        out[s.id] = { ok: false, error: msg };
        await db().rpc('mark_failed', { p_source: s.id, p_error: msg });
      }
    }));
    return out;
  })().finally(() => { running = null; });
  return running;
}
