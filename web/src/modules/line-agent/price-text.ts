/**
 * ข้อความตอบราคาลูกค้า · แยกไฟล์ไว้ให้ทดสอบได้ (scripts/price-sentence.test.mts)
 * แบบของ Bay (D13 · B41) · ห้ามเปลี่ยนถ้อยคำเอง ต้องให้ Bay ตกลงก่อน
 */
const todayBkk = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date());

export type Promo = { kind: 'ชำระเงินสด' | 'ขั้นบันได' | 'ส่งฟรี' | 'ของแถม'; name: string; percent: number | null;
  min_total: number | null; detail: string | null; link: string | null; ends_on: string | null };
export type PriceList = { hidden?: boolean; exact: boolean; total: number;
  items: { name: string; list_price: number | null; disc_pct: number | null; ontop_pct: number | null;
    price: number | null; final: number | null; approved: boolean; promos?: Promo[] }[] };

const TH_FULL = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
/** ตัวเลขแบบในไฟล์ราคา: 48150 · 30334.5 (ไม่มีจุลภาค) */
const plain = (n: number | null | undefined) => (n == null ? '—' : String(Math.round(Number(n) * 100) / 100));
/**
 * แบบตอบราคาลูกค้าของ Bay (D13 · คอลัมน์ "ราคา งานไม้ โซฟา - Answer Customer" ในไฟล์ Standard Price 2026)
 * ห้ามเปลี่ยนถ้อยคำเอง · ถ้าจะเปลี่ยนต้องให้ Bay ตกลงก่อน
 */
const PROMO_URL = 'https://chawcher.com/category/promotion/';

/** วันหมดเขตโปร · สิ้นเดือนพอดี = "ภายใน เดือนพฤศจิกายน 2569" (แบบในไฟล์ราคา) · วันอื่น = "ภายใน 15 พฤศจิกายน 2569" */
function until(d: string | null) {
  if (!d) return '';
  const [y, m, dd] = d.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return dd === last ? ` ภายใน เดือน${TH_FULL[m - 1]} ${y + 543}` : ` ภายใน ${dd} ${TH_FULL[m - 1]} ${y + 543}`;
}

/**
 * ส่วนหัวตายตัว (Bay 2026-11-12): "<ชื่อเต็ม> ราคา <เต็ม> ลด <x>% เหลือ <หลังลด>"
 * ส่วนท้าย: โปรฯ ที่ใช้อยู่วันนี้ (0052 · ตั้งในหน้าการตลาด) + ลิงก์โปรฯ
 * มีแค่โปรเงินสดสิ้นเดือน → ได้ประโยคเดิมในไฟล์ราคาเป๊ะ
 */
export function priceSentence(x: PriceList['items'][number]) {
  let s = `${x.name} ราคา ${plain(x.list_price)} ลด ${plain(x.disc_pct)}% เหลือ ${plain(x.price)}`;
  let promos = x.promos;
  if (!promos) {
    // ฐานข้อมูลยังไม่ได้รัน 0052 · ใช้ % on top จากไฟล์ เหมือนก่อนหน้า
    const [y, m] = todayBkk().split('-').map(Number);
    const end = `${y}-${String(m).padStart(2, '0')}-${new Date(Date.UTC(y, m, 0)).getUTCDate()}`;
    promos = x.ontop_pct ? [{ kind: 'ชำระเงินสด', name: '', percent: x.ontop_pct, min_total: null, detail: null, link: null, ends_on: end }] : [];
  }
  for (const p of promos) {
    if (p.kind === 'ชำระเงินสด') s += ` ชำระเป็นเงินสด ลด on top เพิ่ม ${plain(p.percent)}% เหลือ ${plain(x.final)}`;
    else if (p.kind === 'ขั้นบันได') s += ` ซื้อครบ ${plain(p.min_total)} ลดเพิ่ม ${plain(p.percent)}%`;
    else if (p.kind === 'ส่งฟรี') s += ` ส่งฟรี${p.min_total ? ` เมื่อซื้อครบ ${plain(p.min_total)}` : ''}${p.detail ? ` (${p.detail})` : ''}`;
    else if (p.kind === 'ของแถม') s += ` แถม ${p.detail}${p.min_total ? ` เมื่อซื้อครบ ${plain(p.min_total)}` : ''}`;
    else continue;
    s += until(p.ends_on);
  }
  const links = [...new Set(promos.map((p) => p.link).filter((l): l is string => !!l))];
  return s + ` และส่วนลดเพิ่มเติมตามโปรฯ ได้ที่ ${(links.length ? links : [PROMO_URL]).join(' ')}`;
}
