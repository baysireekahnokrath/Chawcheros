-- APPLY 0046 · ใบเสร็จย้อนหลังให้เห็นที่อยู่จัดส่ง
-- วางทั้งไฟล์ใน Supabase SQL Editor แล้วกด Run · รันซ้ำได้ ไม่มีผลเสีย


create or replace function pos.list_sales(p_pin text, p_date date)
returns jsonb
language plpgsql security definer
set search_path = pos, extensions, public
as $$
declare v jsonb;
begin
  if not pos.check_pin(p_pin) then
    raise exception 'pin_invalid' using errcode = '28000';
  end if;

  select coalesce(jsonb_agg(x order by x->>'at' desc), '[]'::jsonb) into v
  from (
    select jsonb_build_object(
      'id',            s.id,
      'no',            s.bill_no,
      'at',            to_char(s.sold_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'date',          to_char(s.sold_on, 'YYYY-MM-DD'),
      'seller',        s.seller,
      'items',         s.items,
      'subtotal',      s.subtotal,
      'discountType',  s.discount_type,
      'discountValue', s.discount_value,
      'discount',      s.discount,
      'total',         s.total,
      'pay',           s.pay,
      'customer',      s.customer,
      'phone',         s.phone,
      'note',          s.note,
      'status',        s.status,
      'ship',          s.ship_method,
      'address',       s.ship_address,
      'postcode',      s.ship_postcode,
      'synced',        true          -- มาจากฐานข้อมูล จึงเข้าระบบแน่นอน
    ) as x
    from pos.sales s
    where s.sold_on = p_date
  ) t;

  return v;
end $$;

revoke all on function pos.list_sales(text, date) from public;
grant execute on function pos.list_sales(text, date) to anon, authenticated;

notify pgrst, 'reload schema';

-- ตรวจ (ต้องได้ true)
select pg_get_functiondef('pos.list_sales(text,date)'::regprocedure) like '%ship_method%' as list_sales_มีที่อยู่;
