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
-- ★★★ ตั้ง PIN ตรงนี้ก่อนรัน ★★★
--     เลื่อนไปบรรทัดสุดท้ายของไฟล์ แก้คำว่า ใส่PINของคุณที่นี่
--     ให้เป็น PIN ที่อยากใช้ (อย่างน้อย 6 ตัว · ตัวเลขล้วนก็ได้ พิมพ์ในมือถือง่าย)
--     ถ้าลืมแก้ ไฟล์จะหยุดและไม่ติดตั้งอะไรเลย — ตั้งใจให้เป็นอย่างนั้น
--     เพราะถ้าปล่อยให้ติดตั้งด้วยคำที่อยู่ในไฟล์ ใครอ่านไฟล์นี้ก็เข้าหน้าได้
--     เปลี่ยนทีหลังได้ด้วย  select pricing.set_phx_pin('รหัสใหม่');
--     PIN นี้แยกกับ PIN ของ POS คนละตัว เปลี่ยนอันหนึ่งไม่กระทบอีกอัน
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
  -- กันลืมแก้ตัวอย่างในไฟล์ · ถ้าปล่อยผ่าน PIN จะเป็นคำที่อยู่ใน git ให้ใครก็อ่านได้
  if p_pin = 'ใส่PINของคุณที่นี่' then
    raise exception 'pin_placeholder'
      using hint = 'ยังไม่ได้ตั้ง PIN · แก้คำว่า ใส่PINของคุณที่นี่ ในบรรทัดสุดท้ายของไฟล์ ให้เป็น PIN ของคุณ แล้วรันทั้งไฟล์ใหม่';
  end if;
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
grant execute on function pricing.set_phx_pin(text)    to authenticated;

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
-- ★★★ บรรทัดสุดท้าย · ตั้ง PIN ครั้งแรก ★★★
--     แก้คำว่า ใส่PINของคุณที่นี่ ให้เป็น PIN ที่อยากใช้ แล้วรันทั้งไฟล์
--     ถ้าไม่แก้ ไฟล์จะหยุดและไม่ติดตั้งอะไรเลย (ตั้งใจ · ดูเหตุผลที่หัวไฟล์)
-- ---------------------------------------------------------------------------
select pricing.set_phx_pin('ใส่PINของคุณที่นี่');
