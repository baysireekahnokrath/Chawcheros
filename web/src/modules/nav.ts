/**
 * โครงการเดินในระบบ · ตาม docs/ui-framework/README.md (Bay เลือก 2026-11-16)
 *
 * มือถือ = แถบล่าง 5 ช่อง · คอม = ช่องเดียวกันเป็นเมนูข้าง
 * หน้าแรก = ปุ่มใช้ทุกวัน 4 ปุ่ม + แอปทั้งหมดแยกหมวด
 *
 * รายชื่อแอปยังมาจาก core.modules (เปิด/ปิด/สิทธิ์ ทำงานเหมือนเดิม)
 * ไฟล์นี้แค่บอกว่าแอปไหนอยู่หมวดไหน · แอปใหม่ที่ไม่มีในนี้จะไปอยู่หมวด "อื่นๆ" เอง
 */

export type NavItem = { href: string; label: string; icon: string };

/** แถบล่าง (มือถือ) / ส่วนบนของเมนูข้าง (คอม) */
export const TABS: NavItem[] = [
  { href: '/', label: 'หน้าแรก', icon: 'home' },
  { href: '/orders', label: 'ขาย', icon: 'receipt' },
  { href: '/price', label: 'สินค้า', icon: 'tag' },
  { href: '/customers', label: 'ลูกค้า', icon: 'users' },
  { href: '/menu', label: 'เมนู', icon: 'menu' },
];

/** ปุ่มใช้ทุกวันบนหน้าแรก · `/pos` เปิดได้โดยไม่ต้องล็อกอิน (ใช้ PIN) */
export const DAILY: NavItem[] = [
  { href: '/pos', label: 'ขายหน้าบูธ', icon: 'cart' },
  { href: '/pos-report', label: 'ยอดขายวันนี้', icon: 'chart' },
  { href: '/price', label: 'ใบราคา', icon: 'tag' },
  { href: '/quotes', label: 'ใบเสนอราคา', icon: 'file-text' },
];

export const GROUPS: { id: string; label: string; modules: string[] }[] = [
  { id: 'sales', label: 'ขาย', modules: ['pos', 'quotes', 'sales', 'crm', 'line_agent'] },
  { id: 'products', label: 'สินค้าและราคา', modules: ['pricelist', 'datasheet', 'phoenix', 'catalog', 'materials', 'pricing'] },
  { id: 'stock', label: 'คลังและผลิต', modules: ['stock', 'production'] },
  { id: 'marketing', label: 'การตลาด', modules: ['marketing', 'content'] },
  { id: 'admin', label: 'หลังบ้าน', modules: ['core', 'cost'] },
];

/** แท็บไหนควรไฮไลต์ สำหรับ path นี้ */
export function activeTab(pathname: string): string {
  if (pathname === '/') return '/';
  const hit = TABS.filter((t) => t.href !== '/').find(
    (t) => pathname === t.href || pathname.startsWith(t.href + '/'),
  );
  return hit?.href ?? '/menu';
}

/** จัดแอปเข้าหมวด · คงลำดับ sort_order จากฐานข้อมูล */
export function groupModules<T extends { id: string }>(modules: T[]) {
  const known = new Set(GROUPS.flatMap((g) => g.modules));
  const out = GROUPS.map((g) => ({
    ...g,
    items: modules.filter((m) => g.modules.includes(m.id)),
  }));
  const rest = modules.filter((m) => !known.has(m.id));
  if (rest.length) out.push({ id: 'other', label: 'อื่นๆ', modules: [], items: rest });
  return out.filter((g) => g.items.length > 0);
}
