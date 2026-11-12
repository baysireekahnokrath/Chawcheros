/**
 * อ่าน Google Sheet ด้วย service account · สิทธิ์ "อ่านอย่างเดียว" (spreadsheets.readonly)
 *
 * ต่อให้โค้ดผิด Google ก็ไม่ยอมให้เขียน (B40) · ไม่มีฟังก์ชันเขียนในไฟล์นี้เลย
 * ไม่ใช้ไลบรารี googleapis (ใหญ่) · เซ็น JWT เองด้วย node:crypto
 */
import { createSign } from 'node:crypto';

const SCOPE = 'https://www.googleapis.com/auth/spreadsheets.readonly';
const API = 'https://sheets.googleapis.com/v4/spreadsheets';

type Key = { client_email: string; private_key: string };
let cached: { token: string; exp: number } | null = null;

function key(): Key {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) throw new Error('ยังไม่ได้ใส่ GOOGLE_SERVICE_ACCOUNT_JSON ใน Vercel');
  const text = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
  const k = JSON.parse(text) as Key;
  if (!k.client_email || !k.private_key) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON ไม่ครบ (ต้องมี client_email และ private_key)');
  return k;
}

export function serviceEmail(): string | null {
  try { return key().client_email; } catch { return null; }
}

const b64 = (s: string | Buffer) => Buffer.from(s).toString('base64url');

async function token(): Promise<string> {
  if (cached && cached.exp > Date.now() + 60_000) return cached.token;
  const k = key();
  const now = Math.floor(Date.now() / 1000);
  const head = b64(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const body = b64(JSON.stringify({
    iss: k.client_email, scope: SCOPE, aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
  }));
  const sig = createSign('RSA-SHA256').update(`${head}.${body}`).sign(k.private_key.replace(/\\n/g, '\n'));
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${head}.${body}.${b64(sig)}`,
    }),
  });
  if (!res.ok) throw new Error(`Google ไม่ให้กุญแจ ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = (await res.json()) as { access_token: string; expires_in: number };
  cached = { token: j.access_token, exp: Date.now() + j.expires_in * 1000 };
  return j.access_token;
}

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${await token()}` } });
  if (res.status === 403 || res.status === 404) {
    throw new Error(`อ่านชีตไม่ได้ (${res.status}) · แชร์ไฟล์ให้ ${serviceEmail()} แบบผู้ดูหรือยัง`);
  }
  if (!res.ok) throw new Error(`Google ตอบ ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()) as T;
}

/** ชื่อแท็บทั้งหมดในไฟล์ */
export async function tabs(spreadsheetId: string): Promise<string[]> {
  const j = await get<{ sheets: { properties: { title: string } }[] }>(
    `${API}/${spreadsheetId}?fields=sheets.properties.title`);
  return j.sheets.map((s) => s.properties.title);
}

/** อ่านหลายช่วงในครั้งเดียว · ค่าตามที่เห็นในชีต (ข้อความ) */
export async function read(spreadsheetId: string, ranges: string[]): Promise<string[][][]> {
  const out: string[][][] = [];
  // ทีละ 40 ช่วง กัน URL ยาวเกิน
  for (let i = 0; i < ranges.length; i += 40) {
    const q = ranges.slice(i, i + 40).map((r) => 'ranges=' + encodeURIComponent(r)).join('&');
    const j = await get<{ valueRanges: { values?: string[][] }[] }>(
      `${API}/${spreadsheetId}/values:batchGet?${q}&valueRenderOption=FORMATTED_VALUE`);
    for (const v of j.valueRanges) out.push(v.values ?? []);
  }
  return out;
}

export const q = (tab: string) => `'${tab.replace(/'/g, "''")}'`;
