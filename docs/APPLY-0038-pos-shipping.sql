-- ============================================================================
-- APPLY 0038 · POS · วิธีรับสินค้า + ที่อยู่ลูกค้า + ใบปะหน้า
-- ============================================================================
-- วิธีใช้: Supabase → SQL Editor → New query → วางทั้งไฟล์ → Run
-- ต้องรัน APPLY-0037 มาก่อนแล้ว (รันแล้วเมื่อ 2026-11-06)
-- ถ้าขึ้น "already exists" แปลว่าเคยรันแล้ว ไม่ต้องรันซ้ำ
--
-- ทดสอบแล้วบน Postgres เปล่า + migration 0001-0037
--   ✓ เครื่องหน้าบูธที่เปิดหน้าเก่าค้างไว้ ยังบันทึกได้ (บิลนั้นเป็น "รับเอง")
--   ✓ บิล EMS เก็บที่อยู่ · รหัสไปรษณีย์ตัดเหลือตัวเลข 5 หลัก
--   ✓ เฉพาะ admin แก้ที่อยู่ผู้ส่งได้
-- ============================================================================

begin;
alter table pos.sales
  add column ship_method      text not null default 'รับเอง'
                              check (ship_method in ('รับเอง', 'EMS', 'Door to door')),
  add column ship_address     text not null default '',
  add column ship_postcode    text not null default '' check (ship_postcode ~ '^[0-9]{0,5}$'),
  add column label_printed_at timestamptz;

create index pos_sales_ship on pos.sales (ship_method, sold_on) where ship_method <> 'รับเอง';

-- ผู้ส่งบนใบปะหน้า · แก้ได้จากหลังบ้าน
alter table pos.settings
  add column sender_name    text not null default 'CHAW CHER HOME SALES GALLERY',
  add column sender_address text not null default '',
  add column sender_phone   text not null default '';

grant select (sender_name, sender_address, sender_phone) on pos.settings to authenticated;

create or replace function pos.set_sender(p_name text, p_address text, p_phone text)
returns void language plpgsql security definer
set search_path = pos, public as $$
begin
  if not core.has_capability('admin') then raise exception 'not_allowed' using errcode = '42501'; end if;
  update pos.settings
     set sender_name = left(btrim(coalesce(p_name, '')), 120),
         sender_address = left(btrim(coalesce(p_address, '')), 400),
         sender_phone = left(btrim(coalesce(p_phone, '')), 40),
         updated_at = now()
   where id = 1;
end $$;
revoke all on function pos.set_sender(text, text, text) from public;
grant execute on function pos.set_sender(text, text, text) to authenticated;

-- บันทึกบิล · รับช่องจัดส่งเพิ่ม (ช่องอื่นเหมือนเดิมทุกอย่าง)
create or replace function pos.record_sale(p_pin text, p_sale jsonb)
returns jsonb language plpgsql security definer
set search_path = pos, extensions, public as $$
declare v_row pos.sales; v_event text; v_ship text;
begin
  if not pos.check_pin(p_pin) then
    raise exception 'pin_invalid' using errcode = '28000';
  end if;
  select event_name into v_event from pos.settings where id = 1;
  v_ship := case when p_sale->>'ship' in ('EMS', 'Door to door') then p_sale->>'ship' else 'รับเอง' end;

  insert into pos.sales (id, bill_no, sold_at, sold_on, event_name, seller, items,
                         subtotal, discount_type, discount_value, total, pay,
                         customer, phone, note, ship_method, ship_address, ship_postcode)
  values (
    p_sale->>'id',
    left(coalesce(p_sale->>'no', ''), 40),
    coalesce((p_sale->>'at')::timestamptz, now()),
    coalesce((p_sale->>'date')::date, (now() at time zone 'Asia/Bangkok')::date),
    v_event,
    left(btrim(coalesce(p_sale->>'seller', '')), 60),
    coalesce(p_sale->'items', '[]'::jsonb),
    0,
    case when p_sale->>'discountType' = 'pct' then 'pct' else 'baht' end,
    greatest(coalesce((p_sale->>'discountValue')::numeric, 0), 0),
    0,
    coalesce(p_sale->>'pay', 'โอน'),
    left(coalesce(p_sale->>'customer', ''), 120),
    left(coalesce(p_sale->>'phone', ''), 60),
    left(coalesce(p_sale->>'note', ''), 300),
    v_ship,
    left(btrim(coalesce(p_sale->>'address', '')), 400),
    left(regexp_replace(coalesce(p_sale->>'postcode', ''), '[^0-9]', '', 'g'), 5)
  )
  on conflict (id) do nothing;

  select * into v_row from pos.sales where id = p_sale->>'id';
  return jsonb_build_object('id', v_row.id, 'total', v_row.total, 'bill_no', v_row.bill_no);
end $$;

-- ที่อยู่ผู้ส่งตั้งต้น (จากหน้า 1 ของ CI) · แก้บ้านเลขที่ได้ที่ /pos-admin
update pos.settings
   set sender_name = 'CHAW CHER HOME SALES GALLERY',
       sender_address = 'ถนนเพชรหึงษ์ ตำบลบางยอ อำเภอพระประแดง จังหวัดสมุทรปราการ 10130',
       sender_phone = '062 601 8045'
 where id = 1;

commit;

notify pgrst, 'reload schema';

-- ตรวจ
select
  exists (select 1 from information_schema.columns where table_schema = 'pos' and table_name = 'sales' and column_name = 'ship_method') as มีช่องวิธีรับ,
  (select sender_phone from pos.settings where id = 1) = '062 601 8045' as ตั้งผู้ส่งแล้ว;
