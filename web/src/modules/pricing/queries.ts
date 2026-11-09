import { createClient } from '@/lib/supabase/server';
import { sortRows } from '@/lib/sortRows';

/** 1 แถว = 1 ตัวสินค้า พร้อมราคาและรูปของรุ่น — มาจากวิว pricing.v_price_list */
export type PriceRow = {
  product_id: string;
  รุ่น: string;
  หมวด: string;
  ชื่ออังกฤษ: string | null;
  รูป: string | null;
  หมายเหตุรุ่น: string | null;
  variant_id: string;
  sku: string;
  sku_display: string;
  รูปทรง: string | null;
  เกรดวัสดุ: string | null;
  ไม้: string | null;
  สีไม้: string | null;
  กว้าง: number | null;
  ลึก: number | null;
  สูง: number | null;
  สูงที่นั่ง: number | null;
  ลึกที่นั่ง: number | null;
  ราคาเต็มรวม_vat: number | null;
  ส่วนลดปกติ_pct: number | null;
  ราคาขายรวม_vat: number | null;
  ที่มาของราคา: string;
};

/**
 * ★ คืน error ออกมาด้วย ไม่กลืนทิ้ง
 *
 * ของเดิมเขียน `const { data } = await ...` แล้ว return `data ?? []`
 * พอ API ตอบ error หน้าจอจึงขึ้นว่า "0 รุ่น" เฉยๆ เหมือนไม่มีสินค้าในระบบ
 * ทั้งที่ฐานข้อมูลมี 751 แถว — คนอ่านหน้าจอไม่มีทางรู้ว่าต่างกันตรงไหน
 */
export async function getPriceList(): Promise<{ rows: PriceRow[]; error: string | null }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema('pricing')
    .from('v_price_list')
    .select('*')
    .limit(2000);

  if (error) {
    return {
      rows: [],
      error: [error.message, error.details, error.hint].filter(Boolean).join(' · '),
    };
  }
  // เรียงในเครื่อง · API เรียงตามชื่อคอลัมน์ภาษาไทยไม่ได้ (ดู lib/sortRows)
  const rows = sortRows((data ?? []) as PriceRow[], [
    { key: (r) => r.หมวด },
    { key: (r) => r.รุ่น },
    { key: (r) => r.ราคาเต็มรวม_vat },
  ]);
  return { rows, error: null };
}
