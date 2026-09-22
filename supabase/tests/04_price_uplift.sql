-- ============================================================================
-- ทดสอบราคาแบบ "บวกเพิ่มจากตัวฐานกี่บาท"
-- ============================================================================
-- ต้องโหลดข้อมูลรอตรวจไว้ก่อน (supabase/seed/import_batch_*.sql)
--   psql -v ON_ERROR_STOP=1 -1 -d cctest -f supabase/tests/04_price_uplift.sql
--
-- ข้อที่สำคัญที่สุดคือข้อสอง ขึ้นราคาตัวฐานแล้วราคาตัวที่บวกต้องขยับตาม
-- ถ้าเก็บราคาสุดท้ายไว้แทนที่จะเก็บส่วนที่บวก ข้อนี้จะพังเงียบๆ
-- แล้วปีหน้าจะมีคนเสนอราคาหนังด้วยฐานราคาผ้าของปีที่แล้ว
-- ============================================================================

insert into auth.users (id) values ('22222222-2222-2222-2222-222222222222')
  on conflict do nothing;
insert into core.app_users (id, email, full_name, status)
  values ('22222222-2222-2222-2222-222222222222','uplift@test','ทดสอบราคา','ใช้งาน')
  on conflict do nothing;
insert into core.user_capabilities (user_id, capability)
  values ('22222222-2222-2222-2222-222222222222','products.write'),
         ('22222222-2222-2222-2222-222222222222','products.read'),
         ('22222222-2222-2222-2222-222222222222','admin')
  on conflict do nothing;

set local role authenticated;
set local "test.uid" = '22222222-2222-2222-2222-222222222222';

do $$
declare v_base uuid; v_leather uuid; v_price numeric; v_src text;
begin
  perform catalog.approve_import_group('กีวี่','เก้าอี้');

  select id into v_base from catalog.product_variants
   where material_grade = 'ผ้า A' and width_cm = 51 limit 1;
  if v_base is null then raise exception 'หาตัวฐานไม่เจอ'; end if;

  v_leather := catalog.add_variant_from_base(v_base, 'หนังแท้', 12000, 'ทดสอบ');

  select "ราคาเต็มรวม_vat", "ที่มาของราคา" into v_price, v_src
    from pricing.v_variant_price where variant_id = v_leather;
  if v_price <> 22500 then raise exception '10,500 + 12,000 ควรได้ 22,500 แต่ได้ %', v_price; end if;
  raise notice 'ผ่าน · ราคาคำนวณได้ % · %', v_price, v_src;

  -- ★ ขึ้นราคาตัวฐาน ราคาตัวที่บวกต้องขยับตาม
  update pricing.variant_prices set list_price_incl_vat = 11500 where variant_id = v_base;
  select "ราคาเต็มรวม_vat" into v_price from pricing.v_variant_price where variant_id = v_leather;
  if v_price <> 23500 then
    raise exception 'ขึ้นราคาฐานเป็น 11,500 แล้วหนังควรเป็น 23,500 แต่ได้ % (ราคาค้าง)', v_price;
  end if;
  raise notice 'ผ่าน · ขึ้นราคาฐาน ราคาหนังขยับตามเป็น % เอง', v_price;

  -- เพิ่มวัสดุซ้ำไม่ได้
  begin
    perform catalog.add_variant_from_base(v_base, 'หนังแท้', 9999);
    raise exception 'เพิ่มวัสดุซ้ำได้ ซึ่งไม่ควร';
  exception when others then
    if sqlerrm not like '%มีอยู่แล้ว%' then raise; end if;
  end;

  -- อิงต่อกันเป็นทอดๆ ไม่ได้
  begin
    perform catalog.add_variant_from_base(v_leather, 'ผ้า C', 3000);
    raise exception 'อิงต่อเป็นทอดได้ ซึ่งไม่ควร';
  exception when others then
    if sqlerrm not like '%ทอด%' and sqlerrm not like '%ยังไม่มีราคา%' then raise; end if;
  end;

  raise notice 'ผ่านครบ · เพิ่มวัสดุซ้ำไม่ได้ · อิงต่อเป็นทอดไม่ได้';
end $$;
