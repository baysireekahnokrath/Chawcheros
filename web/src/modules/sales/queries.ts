import { createClient } from '@/lib/supabase/server';

export { CHANNELS, PAYMENT_METHODS } from './types';

export type OrderRow = {
  id: string;
  เลขที่: string;
  ลูกค้า: string;
  ส่งที่: string | null;
  ช่องทาง: string;
  วันที่สั่ง: string;
  ต้องผลิตเสร็จ: string | null;
  กำหนดส่ง: string | null;
  ยอดรวม: number;
  รับชำระแล้ว: number;
  ยอดค้าง: number;
  สถานะการเงิน: string;
  เลยกำหนดส่งและยังค้างเงิน: boolean;
  สถานะเอกสาร: string;
  'w/o': string | null;
};

export type OrderLine = {
  id: string;
  line_no: number;
  description: string;
  qty: number;
  unit_price_incl_vat: number;
  variant_id: string | null;
  note: string | null;
};

export type Payment = {
  id: string;
  paid_on: string;
  amount_incl_vat: number;
  method: string;
  ref: string | null;
  note: string | null;
};

export async function getOrders(status?: string): Promise<OrderRow[]> {
  const supabase = await createClient();
  let q = supabase.schema('sales').from('v_orders').select('*');
  if (status && status !== 'all') q = q.eq('สถานะเอกสาร', status);
  const { data } = await q.order('วันที่สั่ง', { ascending: false }).limit(300);
  return (data ?? []) as OrderRow[];
}

export async function getOrder(id: string) {
  const supabase = await createClient();

  const [{ data: head }, { data: lines }, { data: payments }] = await Promise.all([
    supabase.schema('sales').from('v_orders').select('*').eq('id', id).maybeSingle(),
    supabase
      .schema('sales')
      .from('order_lines')
      .select('id,line_no,description,qty,unit_price_incl_vat,variant_id,note')
      .eq('order_id', id)
      .order('line_no'),
    supabase
      .schema('sales')
      .from('order_payments')
      .select('id,paid_on,amount_incl_vat,method,ref,note')
      .eq('order_id', id)
      .order('paid_on'),
  ]);

  if (!head) return null;
  return {
    order: head as OrderRow,
    lines: (lines ?? []) as OrderLine[],
    payments: (payments ?? []) as Payment[],
  };
}

/** ของที่ยังค้างเงินหรือเลยกำหนด — หน้าแรกของฝ่ายขายและพี่ษา */
export async function getToday(): Promise<OrderRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.schema('sales').from('v_today').select('*').limit(100);
  return (data ?? []) as OrderRow[];
}

/** สินค้าที่อนุมัติแล้ว สำหรับผูกรายการในออเดอร์กับ SKU จริง */
export async function getVariantPicker() {
  const supabase = await createClient();
  const { data } = await supabase
    .schema('catalog')
    .from('product_variants')
    .select('id,sku,material_grade,wood_type,configuration,products(collection,categories(name))')
    .eq('status', 'ขายอยู่')
    .limit(1000);
  return (data ?? []) as unknown as {
    id: string;
    sku: string;
    material_grade: string | null;
    wood_type: string | null;
    configuration: string | null;
    products: { collection: string; categories: { name: string } | null } | null;
  }[];
}
