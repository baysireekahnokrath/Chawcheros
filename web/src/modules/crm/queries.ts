import { createClient } from '@/lib/supabase/server';

export type CustomerRow = {
  id: string;
  ชื่อลูกค้า: string;
  ประเภท: string;
  เลขผู้เสียภาษี: string | null;
  เบอร์: string | null;
  อีเมล: string | null;
  LINE: string | null;
  สถานะ: string;
  จำนวนที่อยู่: number;
};

export type Address = {
  id: string;
  label: string;
  kind: string;
  address: string;
  contact_name: string | null;
  contact_phone: string | null;
  is_default: boolean;
  status: string;
};

export type Customer = {
  id: string;
  kind: string;
  name: string;
  tax_id: string | null;
  email: string | null;
  phone: string | null;
  line_id: string | null;
  facebook: string | null;
  instagram: string | null;
  note: string | null;
  status: string;
};

export async function getCustomers(q?: string): Promise<CustomerRow[]> {
  const supabase = await createClient();
  let query = supabase.schema('crm').from('v_customers').select('*');
  if (q?.trim()) query = query.ilike('ชื่อลูกค้า', `%${q.trim()}%`);
  const { data } = await query.order('ชื่อลูกค้า').limit(200);
  return (data ?? []) as CustomerRow[];
}

export async function getCustomer(
  id: string,
): Promise<{ customer: Customer; addresses: Address[] } | null> {
  const supabase = await createClient();
  const { data: customer } = await supabase
    .schema('crm')
    .from('customers')
    .select('id,kind,name,tax_id,email,phone,line_id,facebook,instagram,note,status')
    .eq('id', id)
    .maybeSingle();
  if (!customer) return null;

  const { data: addresses } = await supabase
    .schema('crm')
    .from('customer_addresses')
    .select('id,label,kind,address,contact_name,contact_phone,is_default,status')
    .eq('customer_id', id)
    .order('is_default', { ascending: false })
    .order('label');

  return { customer: customer as Customer, addresses: (addresses ?? []) as Address[] };
}

/** รายชื่อย่อสำหรับช่องเลือกลูกค้าตอนสร้างออเดอร์ */
export async function getCustomerPicker() {
  const supabase = await createClient();
  const { data } = await supabase
    .schema('crm')
    .from('customers')
    .select('id,name,phone,customer_addresses(id,label,kind,status)')
    .eq('status', 'ใช้งาน')
    .order('name')
    .limit(500);
  return (data ?? []) as {
    id: string;
    name: string;
    phone: string | null;
    customer_addresses: { id: string; label: string; kind: string; status: string }[];
  }[];
}
