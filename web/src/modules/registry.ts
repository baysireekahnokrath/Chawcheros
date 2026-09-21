import { createClient } from '@/lib/supabase/server';

/**
 * ทะเบียนโมดูล — อ่านจากตาราง core.modules ในฐานข้อมูล
 *
 * เมนูและ App Launcher สร้างตัวเองจากตรงนี้
 * เพิ่มโมดูลใหม่ = เพิ่ม 1 แถวในฐานข้อมูล ไม่ต้องมาแก้โค้ดเมนู
 */
export type ModuleRow = {
  id: string;
  name_th: string;
  name_en: string;
  icon: string;
  db_schema: string | null;
  depends_on: string[];
  required_capability: string | null;
  home_path: string | null;
  sort_order: number;
  is_enabled: boolean;
  is_core: boolean;
  description_th: string | null;
};

/** โมดูลที่เปิดอยู่ และผู้ใช้คนนี้มีสิทธิ์เข้า */
export async function getMyModules(): Promise<ModuleRow[]> {
  const supabase = await createClient();

  const [{ data: modules }, { data: caps }] = await Promise.all([
    supabase
      .schema('core')
      .from('modules')
      .select('*')
      .eq('is_enabled', true)
      .order('sort_order'),
    supabase.schema('core').from('user_capabilities').select('capability').is('revoked_at', null),
  ]);

  const mine = new Set((caps ?? []).map((c) => c.capability as string));

  return ((modules ?? []) as ModuleRow[]).filter(
    (m) => !m.required_capability || mine.has(m.required_capability),
  );
}

/** ความสามารถทั้งหมดของผู้ใช้ที่ล็อกอินอยู่ */
export async function getMyCapabilities(): Promise<Set<string>> {
  const supabase = await createClient();
  const { data } = await supabase
    .schema('core')
    .from('user_capabilities')
    .select('capability')
    .is('revoked_at', null);
  return new Set((data ?? []).map((c) => c.capability as string));
}
