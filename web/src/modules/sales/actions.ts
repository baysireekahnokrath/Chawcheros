'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

const text = (fd: FormData, k: string) => {
  const v = (fd.get(k) as string | null)?.trim();
  return v ? v : null;
};
const num = (fd: FormData, k: string) => {
  const v = (fd.get(k) as string | null)?.replace(/,/g, '').trim();
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export async function createOrder(fd: FormData): Promise<ActionResult<string>> {
  const order_no = text(fd, 'order_no');
  const customer_id = text(fd, 'customer_id');
  if (!order_no) return { ok: false, error: 'ต้องใส่เลขที่ออเดอร์ (เช่น BLS3167)' };
  if (!customer_id) return { ok: false, error: 'ยังไม่ได้เลือกลูกค้า' };

  const supabase = await createClient();
  const { data, error } = await supabase.schema('sales').rpc('create_order', {
    p_order_no: order_no,
    p_customer_id: customer_id,
    p_channel: (fd.get('channel') as string) || 'ขายตรง',
    p_shipping_address_id: text(fd, 'shipping_address_id'),
    p_billing_address_id: text(fd, 'billing_address_id'),
    p_ordered_on: text(fd, 'ordered_on'),
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath('/orders');
  return { ok: true, data: data as string };
}

export async function addLine(fd: FormData): Promise<ActionResult> {
  const order_id = text(fd, 'order_id');
  const description = text(fd, 'description');
  const qty = num(fd, 'qty');
  const price = num(fd, 'unit_price');
  if (!order_id || !description) return { ok: false, error: 'ต้องใส่รายการสินค้า' };
  if (!qty || qty <= 0) return { ok: false, error: 'จำนวนต้องมากกว่า 0' };
  if (price === null || price < 0) return { ok: false, error: 'ราคาต่อหน่วยไม่ถูกต้อง' };

  const supabase = await createClient();
  const { error } = await supabase.schema('sales').rpc('add_order_line', {
    p_order_id: order_id,
    p_description: description,
    p_qty: qty,
    p_unit_price: price,
    p_variant_id: text(fd, 'variant_id'),
    p_note: text(fd, 'note'),
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/orders/${order_id}`);
  return { ok: true };
}

export async function confirmOrder(orderId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.schema('sales').rpc('confirm_order', { p_order_id: orderId });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/orders/${orderId}`);
  revalidatePath('/orders');
  return { ok: true };
}

export async function cancelOrder(fd: FormData): Promise<ActionResult> {
  const order_id = text(fd, 'order_id');
  const reason = text(fd, 'reason');
  if (!order_id) return { ok: false, error: 'ไม่พบออเดอร์' };
  if (!reason) return { ok: false, error: 'ยกเลิกต้องบอกเหตุผล จะได้ย้อนดูได้ว่าทำไม' };

  const supabase = await createClient();
  const { error } = await supabase
    .schema('sales')
    .rpc('cancel_order', { p_order_id: order_id, p_reason: reason });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/orders/${order_id}`);
  revalidatePath('/orders');
  return { ok: true };
}

/** งานของพี่ษา — ต้องมีสิทธิ์ finance.write ฐานข้อมูลเป็นคนกั้น ไม่ใช่หน้าจอ */
export async function recordPayment(fd: FormData): Promise<ActionResult> {
  const order_id = text(fd, 'order_id');
  const amount = num(fd, 'amount');
  if (!order_id) return { ok: false, error: 'ไม่พบออเดอร์' };
  if (!amount || amount <= 0) return { ok: false, error: 'ยอดเงินต้องมากกว่า 0' };

  const supabase = await createClient();
  const { error } = await supabase.schema('sales').rpc('record_payment', {
    p_order_id: order_id,
    p_amount: amount,
    p_method: (fd.get('method') as string) || 'โอน SCB/TTB',
    p_paid_on: text(fd, 'paid_on'),
    p_ref: text(fd, 'ref'),
    p_note: text(fd, 'note'),
  });

  if (error) {
    if (error.message.includes('finance.write'))
      return { ok: false, error: 'คุณไม่มีสิทธิ์บันทึกการรับชำระ — เรื่องนี้เป็นของฝ่ายการเงิน' };
    return { ok: false, error: error.message };
  }

  revalidatePath(`/orders/${order_id}`);
  revalidatePath('/orders');
  return { ok: true };
}

/** วันนัดส่งและค่าขนส่ง — ฝ่ายจัดส่งแก้ได้ ไม่ต้องผ่านฝ่ายขาย */
export async function updateDelivery(fd: FormData): Promise<ActionResult> {
  const order_id = text(fd, 'order_id');
  if (!order_id) return { ok: false, error: 'ไม่พบออเดอร์' };

  const patch: Record<string, unknown> = {};
  const promised = text(fd, 'promised_delivery_on');
  const fee = num(fd, 'shipping_fee');
  if (promised !== null) patch.promised_delivery_on = promised;
  if (fee !== null) patch.shipping_fee_incl_vat = fee;
  if (Object.keys(patch).length === 0) return { ok: false, error: 'ยังไม่ได้กรอกอะไร' };

  const supabase = await createClient();
  const { data, error } = await supabase
    .schema('sales')
    .from('orders')
    .update(patch)
    .eq('id', order_id)
    .select('id');

  if (error) return { ok: false, error: error.message };
  // RLS ไม่โยน error เวลาไม่มีสิทธิ์ มันแค่ไม่โดนแถวไหนเลย ต้องเช็คเอง
  if (!data || data.length === 0)
    return { ok: false, error: 'แก้ไม่ได้ — ต้องมีสิทธิ์ฝ่ายขายหรือฝ่ายจัดส่ง' };

  revalidatePath(`/orders/${order_id}`);
  return { ok: true };
}
