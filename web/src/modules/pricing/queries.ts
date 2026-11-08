import { createClient } from '@/lib/supabase/server';

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

export async function getPriceList(): Promise<PriceRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .schema('pricing')
    .from('v_price_list')
    .select('*')
    // เรียงที่ฐานข้อมูล หน้าจอจะได้ไม่ต้องเรียงใหม่ทุกครั้งที่พิมพ์ค้นหา
    .order('หมวด')
    .order('รุ่น')
    .order('ราคาเต็มรวม_vat', { ascending: true, nullsFirst: false })
    .limit(2000);
  return (data ?? []) as PriceRow[];
}
