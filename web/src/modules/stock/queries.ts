import { createClient } from '@/lib/supabase/server';

export type Location = {
  id: string;
  name: string;
  kind: string;
  is_fixed: boolean;
  note: string | null;
};

export type TodayItem = {
  หมวด: string;
  เรื่อง: string;
  เลยมากี่วัน: number | null;
  ref_id: string;
};

export type OverdueLoan = {
  loan_id: string;
  รหัสตัว: string;
  รุ่น: string;
  หมวด: string | null;
  วัสดุ: string | null;
  ยืมไปไหน: string;
  ใครยืม: string | null;
  ออกไปเมื่อ: string;
  กำหนดกลับ: string;
  เลยมากี่วัน: number;
  มูลค่าที่จมอยู่: number | null;
};

export type OnHand = {
  variant_id: string;
  SKU: string;
  รุ่น: string;
  หมวด: string | null;
  วัสดุ: string | null;
  อยู่ที่: string;
  ทั้งหมด: number;
  พร้อมขาย: number;
  จองแล้ว: number;
  ตำหนิ: number;
  ยืมออก: number;
};

export type UnitDetail = {
  id: string;
  unit_code: string;
  status: string;
  serial_no: string | null;
  made_at: string | null;
  made_on: string | null;
  made_by: string | null;
  note: string | null;
  location_id: string;
  stock_locations: { name: string } | null;
  catalog_variant: {
    sku: string;
    material_grade: string | null;
    wood_type: string | null;
    configuration: string | null;
    width_cm: number | null;
    depth_cm: number | null;
    height_cm: number | null;
    products: { collection: string } | null;
  } | null;
};

export async function getLocations(): Promise<Location[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .schema('stock')
    .from('locations')
    .select('id,name,kind,is_fixed,note')
    .eq('status', 'ขายอยู่')
    .order('is_fixed', { ascending: false })
    .order('name');
  return (data ?? []) as Location[];
}

/** งานที่คลังต้องลงมือวันนี้ */
export async function getStockToday(): Promise<TodayItem[]> {
  const supabase = await createClient();
  const { data } = await supabase.schema('stock').from('v_today').select('*');
  return (data ?? []) as TodayItem[];
}

/** เรียงตามมูลค่าที่จม จะได้รู้ว่าควรตามตัวไหนก่อน */
export async function getOverdueLoans(): Promise<OverdueLoan[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .schema('stock')
    .from('v_overdue_loans')
    .select('*')
    .order('มูลค่าที่จมอยู่', { ascending: false, nullsFirst: false });
  return (data ?? []) as OverdueLoan[];
}

export async function getOnHand(): Promise<OnHand[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .schema('stock')
    .from('v_on_hand')
    .select('*')
    .order('รุ่น');
  return (data ?? []) as OnHand[];
}

export async function getStockCounts() {
  const supabase = await createClient();
  const c = { count: 'exact' as const, head: true };

  const [all, ready, lent, flawed, overdue] = await Promise.all([
    supabase.schema('stock').from('units').select('id', c).neq('status', 'ส่งแล้ว'),
    supabase.schema('stock').from('units').select('id', c).eq('status', 'พร้อมขาย'),
    supabase.schema('stock').from('units').select('id', c).eq('status', 'ยืมออก'),
    supabase.schema('stock').from('units').select('id', c).eq('status', 'ตำหนิ'),
    supabase.schema('stock').from('v_overdue_loans').select('loan_id', c),
  ]);

  return {
    ทั้งหมด: all.count ?? 0,
    พร้อมขาย: ready.count ?? 0,
    ยืมออก: lent.count ?? 0,
    ตำหนิ: flawed.count ?? 0,
    เลยกำหนดคืน: overdue.count ?? 0,
  };
}

/** รุ่น + ตัวที่ขายจริง สำหรับเลือกตอนรับของเข้า */
export async function getVariantsForReceiving() {
  const supabase = await createClient();
  const { data } = await supabase
    .schema('catalog')
    .from('product_variants')
    .select('id,sku,material_grade,wood_type,configuration,products(collection,categories(name))')
    .eq('status', 'ขายอยู่')
    .order('sku')
    .limit(2000);
  return (data ?? []) as unknown as {
    id: string;
    sku: string;
    material_grade: string | null;
    wood_type: string | null;
    configuration: string | null;
    products: { collection: string; categories: { name: string } | null } | null;
  }[];
}
