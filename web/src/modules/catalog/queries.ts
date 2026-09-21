import { createClient } from '@/lib/supabase/server';

/** 1 แถว = 1 รุ่น (Collection + หมวด) — มาจากวิว catalog.v_import_groups */
export type ImportGroup = {
  collection: string;
  category: string;
  จำนวนแถว: number;
  รอตรวจ: number;
  อนุมัติแล้ว: number;
  ไม่เอา: number;
  ราคาต่ำสุด: number | null;
  ราคาสูงสุด: number | null;
  วัสดุที่มี: string | null;
  รูปทรงที่มี: string | null;
  ไม่มีราคา: number;
};

export type ImportRow = {
  id: string;
  source_row_no: number;
  brand: string | null;
  sub_category: string | null;
  material_grade: string | null;
  wood: string | null;
  wood_colour: string | null;
  width_cm: number | null;
  depth_cm: number | null;
  height_cm: number | null;
  seat_height_cm: number | null;
  list_price_incl_vat: number | null;
  discount_pct: number | null;
  legacy_nnsku: string | null;
  review_status: string;
};

export type Batch = {
  id: string;
  source_file: string;
  note: string | null;
  imported_at: string;
};

export async function getImportGroups(): Promise<ImportGroup[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .schema('catalog')
    .from('v_import_groups')
    .select('*')
    .order('collection');
  return (data ?? []) as ImportGroup[];
}

/** แถวทั้งหมดในกลุ่มเดียว — ใช้ตอนกดดูรายละเอียดก่อนอนุมัติ */
export async function getGroupRows(collection: string, category: string): Promise<ImportRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .schema('catalog')
    .from('import_variants')
    .select(
      'id,source_row_no,brand,sub_category,material_grade,wood,wood_colour,width_cm,depth_cm,height_cm,seat_height_cm,list_price_incl_vat,discount_pct,legacy_nnsku,review_status',
    )
    .eq('collection', collection)
    .eq('category', category)
    .order('source_row_no');
  return (data ?? []) as ImportRow[];
}

export async function getBatches(): Promise<Batch[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .schema('catalog')
    .from('import_batches')
    .select('id,source_file,note,imported_at')
    .order('imported_at', { ascending: false });
  return (data ?? []) as Batch[];
}

/** ตัวเลขสรุปหน้าแรกของโมดูล */
export async function getCatalogCounts() {
  const supabase = await createClient();

  const count = { count: 'exact' as const, head: true };
  const [staged, approved, products, variants] = await Promise.all([
    supabase.schema('catalog').from('import_variants').select('id', count).eq('review_status', 'รอตรวจ'),
    supabase.schema('catalog').from('import_variants').select('id', count).eq('review_status', 'อนุมัติแล้ว'),
    supabase.schema('catalog').from('products').select('id', count).eq('status', 'ขายอยู่'),
    supabase.schema('catalog').from('product_variants').select('id', count).eq('status', 'ขายอยู่'),
  ]);

  return {
    รอตรวจ: staged.count ?? 0,
    อนุมัติแล้ว: approved.count ?? 0,
    รุ่นที่ขายอยู่: products.count ?? 0,
    ตัวที่ขายจริง: variants.count ?? 0,
  };
}
