-- ============================================================================
-- 0053 · เพิ่ม "ขนาดใหม่" ของรุ่นที่มีอยู่แล้ว
-- ============================================================================
-- โจทย์จาก Bay (2026-11-16)
--   "ควรเพิ่มหน้าที่ผมจะเอาสินค้าใหม่ไปเข้า database ด้วย
--    หน้านี้ก็แค่วางชื่อสินค้าพร้อมขนาดลงไป จากนั้นดึง database ขึ้นมาโชว์
--    พร้อมบอกว่าใช่หรือไม่ แล้ว recommended price"
--
-- ★ ทำไมต้องมีฟังก์ชันใหม่ ทั้งที่ 0018 มี add_variant_from_base อยู่แล้ว
--   ตัวเดิมคัดลอกสเปกทั้งหมดแล้วเปลี่ยน "วัสดุหุ้ม" · ราคาเก็บเป็น "ส่วนที่บวก"
--   จากตัวฐาน เพราะหนังแท้ = ผ้า A + 12,000 เป็นความจริงที่คงที่
--
--   ขนาดใหม่ไม่ใช่แบบนั้น · ย่อโต๊ะจาก 120×90 เหลือ 120×60 ราคาไม่ได้
--   "ลบเท่าเดิมทุกครั้ง" มันขึ้นกับว่าท็อปเล็กลงเท่าไหร่ · ตัวใหม่จึงต้องมี
--   ราคาของตัวเอง ไม่ใช่ราคาที่อิงตัวอื่น
--   (และ guard_uplift_base ใน 0018 ห้ามอิงกันเป็นทอด ๆ อยู่แล้ว)
--
-- ★ ราคาที่ส่งเข้ามาเป็นราคาที่ "คนตัดสินใจแล้ว"
--   หน้าเว็บคำนวณราคาแนะนำให้ดู (web/src/modules/catalog/suggest-price.ts)
--   แต่คนแก้ตัวเลขได้เสมอก่อนกดยืนยัน · ฐานข้อมูลไม่คิดราคาเอง
--   ตรงกับกฎที่ใช้มาตลอด — ระบบเสนอ คนตัดสิน
-- ============================================================================

create or replace function catalog.add_variant_resize(
  p_base_variant_id uuid,
  p_width_cm        numeric,
  p_depth_cm        numeric,
  p_height_cm       numeric,
  p_price_incl_vat  numeric,
  p_note            text default null
) returns uuid
language plpgsql security definer
set search_path = core, catalog, materials, pricing, cost, public
as $$
declare b record; v_sku char(8); v_new uuid; v_label text;
begin
  if not core.has_capability('products.write') then
    raise exception 'ต้องมีสิทธิ์ products.write จึงจะเพิ่มตัวสินค้าได้'
      using errcode = 'insufficient_privilege';
  end if;

  select * into b from catalog.product_variants where id = p_base_variant_id;
  if not found then raise exception 'ไม่พบตัวฐานที่อ้างถึง'; end if;

  if p_width_cm is null or p_width_cm <= 0 then
    raise exception 'ต้องระบุความกว้างของขนาดใหม่';
  end if;
  if p_price_incl_vat is null or p_price_incl_vat <= 0 then
    raise exception 'ต้องระบุราคาเต็มของขนาดใหม่';
  end if;

  -- ขนาดเท่าเดิมทุกด้าน = ไม่ใช่ตัวใหม่ · กันคนกดยืนยันโดยลืมแก้ขนาด
  if  b.width_cm  is not distinct from p_width_cm
  and b.depth_cm  is not distinct from p_depth_cm
  and b.height_cm is not distinct from p_height_cm then
    raise exception 'ขนาดเท่ากับตัวฐานทุกด้าน — ยังไม่ได้เปลี่ยนอะไรเลย';
  end if;

  if exists (
    select 1 from catalog.product_variants x
    where x.product_id     =  b.product_id
      and x.material_grade is not distinct from b.material_grade
      and x.configuration  is not distinct from b.configuration
      and x.wood_type      is not distinct from b.wood_type
      and x.wood_colour    is not distinct from b.wood_colour
      and x.width_cm       is not distinct from p_width_cm
      and x.depth_cm       is not distinct from p_depth_cm
      and x.height_cm      is not distinct from p_height_cm
  ) then
    raise exception 'ขนาดนี้มีอยู่แล้วในรุ่นนี้ (% × % × %)',
      p_width_cm, p_depth_cm, p_height_cm;
  end if;

  v_label := 'ขนาดใหม่ของ ' || catalog.sku_display(b.sku::text)
             || ' → W' || p_width_cm
             || coalesce(' D' || p_depth_cm, '')
             || coalesce(' H' || p_height_cm, '')
             || coalesce(' · ' || nullif(trim(p_note), ''), '');

  v_sku := catalog.mint_sku(v_label);

  insert into catalog.product_variants
    (sku, product_id, configuration, width_cm, depth_cm, height_cm, seat_height_cm,
     seat_depth_cm, material_grade, wood_type, wood_colour, seat_count, arm_config,
     is_modular, status)
  values
    (v_sku, b.product_id, b.configuration, p_width_cm, p_depth_cm, p_height_cm,
     b.seat_height_cm, b.seat_depth_cm, b.material_grade, b.wood_type, b.wood_colour,
     b.seat_count, b.arm_config, b.is_modular, 'ขายอยู่')
  returning id into v_new;

  -- ราคาของตัวเอง ไม่ใช่ราคาที่อิงตัวอื่น · เหตุผลอยู่ในหัวไฟล์
  insert into pricing.variant_prices (variant_id, list_price_incl_vat)
  values (v_new, p_price_incl_vat);

  return v_new;
end;
$$;

comment on function catalog.add_variant_resize(uuid, numeric, numeric, numeric, numeric, text) is
  'เพิ่มขนาดใหม่ให้รุ่นที่มีอยู่ · คัดลอกสเปกจากตัวฐาน เปลี่ยนแค่ขนาดกับราคา · '
  'ราคาเป็นราคาของตัวเอง เพราะย่อขนาดแล้วส่วนที่หายไปไม่คงที่';

revoke execute on function catalog.add_variant_resize(uuid, numeric, numeric, numeric, numeric, text) from public, anon;
grant  execute on function catalog.add_variant_resize(uuid, numeric, numeric, numeric, numeric, text) to authenticated;
