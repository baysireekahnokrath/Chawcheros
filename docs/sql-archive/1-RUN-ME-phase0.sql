-- Phase 0 · วางทั้งไฟล์ใน Supabase SQL Editor แล้วกด Run ครั้งเดียว
-- รวม APPLY-0044 (ปุ่ม Data Sheet) + APPLY-0047 (หน้าจัดชุดฟีนิกซ์) · รันซ้ำได้ ไม่พัง
-- เสร็จแล้วตั้ง PIN ฟีนิกซ์อีกบรรทัด:  select pricing.set_phx_pin('รหัสที่อยากใช้');

-- ===== APPLY-0044 =====
-- ============================================================================
-- 0044 · ลงทะเบียนโมดูล Data Sheet
-- ============================================================================
-- แผ่นสเปคสินค้าทุกรุ่น · ขนาด วัสดุ รหัส และผังด้านบน
--
-- ★ ไม่มีวิวใหม่ ไม่มีตารางใหม่ ตั้งใจ
--   data sheet ไม่มีข้อมูลที่ใบราคาไม่มี มันคือใบราคาที่ยุบเกรดวัสดุทิ้ง
--   แล้วเหลือ "1 แถว = 1 โมดูล" แทน "1 แถว = 1 ตัวสินค้า"
--   ใช้ pricing.v_price_list ที่มี RLS คุมอยู่แล้ว ไม่ต้องเปิดสิทธิ์ใหม่
--   และไม่มีทางที่หน้า data sheet จะเห็นของที่ใบราคาเห็นไม่ได้
--
--   การจัดกลุ่มกับการตั้งรหัสทำในแอป (web/src/modules/datasheet/build.ts)
--   มีชุดทดสอบ 37 ข้อที่ web/scripts/datasheet.test.mts รันโดยไม่ต้องต่อฐานข้อมูล
--
-- ★ ทำไมแผ่นนี้ไม่มีราคา
--   data sheet ของโรงงาน (Phoenix/koontong) ไม่ใส่ราคา เพราะราคาเปลี่ยนบ่อยกว่าขนาด
--   แผ่นที่ไม่มีราคาส่งให้ดีลเลอร์หรือสถาปนิกได้เลย ไม่ต้องกลัวตัวเลขหลุด
--   ใครอยากได้ราคาไปดูที่ /price ซึ่งดึงสดเหมือนกัน
--
-- ไฟล์นี้ทำอย่างเดียวคือใส่เมนูหน้าแรก · หน้า /datasheet ใช้งานได้ก่อนรันไฟล์นี้อยู่แล้ว
-- ============================================================================

insert into core.modules
  (id, name_th, name_en, icon, db_schema, depends_on, required_capability,
   home_path, sort_order, is_core, description_th) values
  ('datasheet', 'Data Sheet', 'Data Sheet', 'ruler', 'pricing',
   '{core,catalog,pricing}', 'products.read', '/datasheet', 8, false,
   'แผ่นสเปคสินค้าทุกรุ่น ขนาด วัสดุ รหัส และผังด้านบน · ไม่มีราคา ส่งต่อได้เลย')
on conflict (id) do update
  set name_th            = excluded.name_th,
      name_en            = excluded.name_en,
      icon               = excluded.icon,
      home_path          = excluded.home_path,
      description_th     = excluded.description_th;

notify pgrst, 'reload schema';

-- ===== APPLY-0047 =====
-- ============================================================================
-- 0047 · หน้าจัดชุดฟีนิกซ์ · เข้าด้วย PIN ไม่ต้องล็อกอิน
-- ============================================================================
-- โจทย์จาก Bay (2026-11-09)
--   "เอาเข้าระบบจริงเลยครับ ทำหน้า /phoenix · ขอแบบไม่ต้อง login
--    ใช้กันแค่ Bay กับ Book สองคนครับ · หรือ ให้ใส่ pin ง่ายๆ ที่ set โดยผมเอง"
--
-- ทางแก้ · ใช้ประตูเดิมแบบเดียวกับ POS ไม่เปิดประตูใหม่
--   อ่านผ่านฟังก์ชัน security definer ที่ต้องใส่ PIN ให้ถูกก่อน
--   RLS ของ catalog กับ pricing ยังปิดสนิทเหมือนเดิม · anon แตะตารางตรง ๆ ไม่ได้
--   ฟังก์ชันคืนเฉพาะแถวของฟีนิกซ์ และไม่มีต้นทุนสักช่อง
--
-- ★★★ ไฟล์นี้ไม่ต้องแก้อะไร · รันทั้งไฟล์ได้เลย ★★★
--     ไฟล์นี้ไม่ตั้ง PIN ให้ · ตั้งใจ · PIN ไม่ควรอยู่ใน git ให้ใครอ่านก็ได้
--     รันไฟล์นี้เสร็จแล้ว ตั้ง PIN ด้วยคำสั่งบรรทัดเดียว
--
--         select pricing.set_phx_pin('รหัสที่อยากใช้');
--
--     ยังไม่ตั้ง PIN = ยังไม่มีใครเข้าหน้า /phoenix ได้ (ปิดไว้ก่อน ปลอดภัย)
--     อย่างน้อย 6 ตัว · ตัวเลขล้วนก็ได้ พิมพ์ในมือถือง่าย
--     เปลี่ยนทีหลังใช้คำสั่งเดียวกัน · คนละตัวกับ PIN ของ POS
-- ============================================================================

-- ---------------------------------------------------------------------------
-- ที่เก็บ PIN · เก็บเป็น hash ไม่ได้เก็บตัวรหัส
-- ---------------------------------------------------------------------------
create table if not exists pricing.phx_settings (
  id          smallint primary key default 1 check (id = 1),
  pin_hash    text not null,
  updated_at  timestamptz not null default now()
);
alter table pricing.phx_settings enable row level security;
-- ไม่มี policy = ไม่มีใครอ่านหรือเขียนตรง ๆ ได้ · ผ่านฟังก์ชันข้างล่างเท่านั้น

create or replace function pricing.set_phx_pin(p_pin text)
returns void
language plpgsql
security definer
set search_path = pricing, extensions, public
as $$
begin
  if length(coalesce(p_pin, '')) < 6 then
    raise exception 'pin_too_short' using hint = 'PIN ต้องยาวอย่างน้อย 6 ตัว';
  end if;
  insert into pricing.phx_settings (id, pin_hash)
  values (1, crypt(p_pin, gen_salt('bf')))
  on conflict (id) do update
    set pin_hash = excluded.pin_hash, updated_at = now();
end;
$$;

create or replace function pricing.check_phx_pin(p_pin text)
returns boolean
language sql
security definer
set search_path = pricing, extensions, public
as $$
  select exists (
    select 1 from pricing.phx_settings s
    where s.pin_hash = crypt(coalesce(p_pin, ''), s.pin_hash)
  );
$$;

-- ---------------------------------------------------------------------------
-- แถวใบราคาของฟีนิกซ์ · ต้องใส่ PIN ให้ถูกก่อน
-- ---------------------------------------------------------------------------
create or replace function pricing.phoenix_sheet(p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = pricing, catalog, extensions, public
as $$
declare v jsonb;
begin
  if not pricing.check_phx_pin(p_pin) then
    raise exception 'pin_invalid' using errcode = '28000';
  end if;

  select coalesce(jsonb_agg(to_jsonb(t) order by t."หมวด", t."กว้าง"), '[]'::jsonb)
  into v
  from (
    select
      product_id, "รุ่น", "หมวด", "ชื่ออังกฤษ", "รูป", "หมายเหตุรุ่น",
      variant_id, sku, sku_display, "รูปทรง", "เกรดวัสดุ", "ไม้", "สีไม้",
      "กว้าง", "ลึก", "สูง", "สูงที่นั่ง", "ลึกที่นั่ง",
      "ราคาเต็มรวม_vat", "ส่วนลดปกติ_pct", "ราคาขายรวม_vat", "ที่มาของราคา"
    from pricing.v_price_list
    where "รุ่น" = 'ฟีนิกซ์'
  ) t;

  return v;
end;
$$;

comment on function pricing.phoenix_sheet(text) is
  'แถวใบราคาของฟีนิกซ์ สำหรับหน้า /phoenix ที่เข้าด้วย PIN ไม่ต้องล็อกอิน · '
  'ไม่มีต้นทุนสักช่อง · เปลี่ยน PIN ด้วย pricing.set_phx_pin()';

revoke all on function pricing.set_phx_pin(text)   from public;
revoke all on function pricing.check_phx_pin(text) from public;
revoke all on function pricing.phoenix_sheet(text) from public;

grant usage   on schema pricing                        to anon;
grant execute on function pricing.check_phx_pin(text)  to anon, authenticated;
grant execute on function pricing.phoenix_sheet(text)  to anon, authenticated;
-- set_phx_pin ไม่ให้สิทธิ์ใครเลย · เจ้าของฐานข้อมูลเท่านั้นที่เรียกได้
-- คือ Bay ที่หน้า SQL Editor · คนที่ล็อกอินเข้าแอปเปลี่ยน PIN ของคนอื่นไม่ได้

-- ---------------------------------------------------------------------------
-- ลงทะเบียนโมดูล · เมนูหน้าแรกสร้างตัวเองจากตารางนี้
-- ---------------------------------------------------------------------------
insert into core.modules
  (id, name_th, name_en, icon, db_schema, depends_on, required_capability,
   home_path, sort_order, is_core, description_th) values
  ('phoenix', 'จัดชุดฟีนิกซ์', 'Phoenix Configurator', 'sofa', 'pricing',
   '{core,catalog,pricing}', 'products.read', '/phoenix', 9, false,
   'เลือกโมดูลฟีนิกซ์ ได้ราคาและแบบแปลนทันที · เข้าด้วย PIN ไม่ต้องล็อกอิน')
on conflict (id) do update
  set name_th        = excluded.name_th,
      name_en        = excluded.name_en,
      icon           = excluded.icon,
      home_path      = excluded.home_path,
      description_th = excluded.description_th;

notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- บอกว่ายังเหลืออีกขั้น · ยังไม่มี PIN = ยังไม่มีใครเข้าหน้า /phoenix ได้
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pricing.phx_settings) then
    raise notice '%', E'\n'
      || '  ติดตั้งเรียบร้อย · เหลืออีกขั้นเดียว ตั้ง PIN' || E'\n'
      || '      select pricing.set_phx_pin(''รหัสที่อยากใช้'');' || E'\n'
      || '  ยังไม่ตั้ง = ยังไม่มีใครเข้าหน้า /phoenix ได้';
  end if;
end $$;
