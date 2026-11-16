-- ============================================================================
-- ทดสอบ 0053 · เพิ่มขนาดใหม่ให้รุ่นที่มีอยู่ · รันหลัง 04 (ใช้สินค้ากีวี่ชุดเดิม)
-- ============================================================================
--   1 เพิ่มขนาดใหม่ได้ · ได้ SKU ใหม่ · สเปกอื่นคัดลอกมาครบ
--   2 ราคาเป็น "ราคาของตัวเอง" ไม่ใช่ราคาที่อิงตัวฐาน
--     ★ ข้อนี้สำคัญสุด · ขึ้นราคาตัวฐานแล้วราคาขนาดใหม่ต้อง "ไม่" ขยับตาม
--       เพราะย่อขนาดแล้วส่วนที่หายไปไม่คงที่ ต่างจากเรื่องวัสดุใน 0018
--   3 ขนาดเท่าเดิมทุกด้าน = ไม่ใช่ตัวใหม่ ต้องไม่ยอม
--   4 ขนาดซ้ำกับที่มีอยู่แล้ว ต้องไม่ยอม
--   5 ไม่ใส่ความกว้าง / ไม่ใส่ราคา ต้องไม่ยอม
--   6 ไม่มีสิทธิ์ products.write ต้องทำไม่ได้
-- ============================================================================

insert into auth.users (id) values ('33333333-3333-3333-3333-333333333333')
  on conflict do nothing;
insert into core.app_users (id, email, full_name, status)
  values ('33333333-3333-3333-3333-333333333333','resize@test','ทดสอบขนาดใหม่','ใช้งาน')
  on conflict do nothing;
insert into core.user_capabilities (user_id, capability)
  values ('33333333-3333-3333-3333-333333333333','products.write'),
         ('33333333-3333-3333-3333-333333333333','products.read'),
         ('33333333-3333-3333-3333-333333333333','admin')
  on conflict do nothing;

set local role authenticated;
set local "test.uid" = '33333333-3333-3333-3333-333333333333';

do $$
declare
  v_base uuid; v_new uuid; v_price numeric; v_src text;
  b record; n record;
begin
  select id into v_base from catalog.product_variants
   where material_grade = 'ผ้า A' and width_cm = 51 limit 1;
  if v_base is null then raise exception 'หาตัวฐานไม่เจอ — ต้องรัน 04 ก่อน'; end if;

  select * into b from catalog.product_variants where id = v_base;

  -- ── 1 · เพิ่มขนาดใหม่ ──────────────────────────────────────────────
  v_new := catalog.add_variant_resize(v_base, 70, b.depth_cm, b.height_cm, 13500, 'ลูกค้าสั่งพิเศษ');
  select * into n from catalog.product_variants where id = v_new;

  if n.sku = b.sku then raise exception 'SKU ซ้ำกับตัวฐาน'; end if;
  if n.product_id <> b.product_id then raise exception 'ไปอยู่ผิดรุ่น'; end if;
  if n.material_grade is distinct from b.material_grade
     or n.configuration is distinct from b.configuration
     or n.wood_type is distinct from b.wood_type then
    raise exception 'สเปกไม่ได้คัดลอกมา';
  end if;
  if n.width_cm <> 70 then raise exception 'ความกว้างใหม่ไม่ได้ถูกใช้ (%)', n.width_cm; end if;
  if n.status <> 'ขายอยู่' then raise exception 'ตัวใหม่ควรขายได้ทันที'; end if;
  raise notice 'ข้อ 1 ผ่าน · ได้ SKU ใหม่ % กว้าง 70 สเปกอื่นคัดลอกครบ', n.sku;

  -- ── 2 · ราคาเป็นของตัวเอง ไม่อิงตัวฐาน ────────────────────────────
  select "ราคาเต็มรวม_vat", "ที่มาของราคา" into v_price, v_src
    from pricing.v_variant_price where variant_id = v_new;
  if v_price <> 13500 then raise exception 'ควรได้ 13,500 แต่ได้ %', v_price; end if;
  if v_src <> 'ราคาของตัวเอง' then raise exception 'ที่มาของราคาควรเป็นของตัวเอง แต่ได้ %', v_src; end if;

  update pricing.variant_prices set list_price_incl_vat = list_price_incl_vat + 5000
    where variant_id = v_base and status = 'ขายอยู่';
  select "ราคาเต็มรวม_vat" into v_price from pricing.v_variant_price where variant_id = v_new;
  if v_price <> 13500 then
    raise exception 'ขึ้นราคาตัวฐานแล้วราคาขนาดใหม่ขยับตาม (%) — ไม่ควร', v_price;
  end if;
  raise notice 'ข้อ 2 ผ่าน · ราคาของตัวเอง 13,500 ไม่ขยับตามตัวฐาน';

  -- ── 3 · ขนาดเท่าเดิมทุกด้าน ───────────────────────────────────────
  begin
    perform catalog.add_variant_resize(v_base, b.width_cm, b.depth_cm, b.height_cm, 9999);
    raise exception 'ขนาดเท่าเดิมแต่เพิ่มได้ ซึ่งไม่ควร';
  exception when others then
    if sqlerrm not like '%ยังไม่ได้เปลี่ยนอะไรเลย%' then raise; end if;
  end;
  raise notice 'ข้อ 3 ผ่าน · ขนาดเท่าเดิมเพิ่มไม่ได้';

  -- ── 4 · ขนาดซ้ำกับที่เพิ่งเพิ่มไป ─────────────────────────────────
  begin
    perform catalog.add_variant_resize(v_base, 70, b.depth_cm, b.height_cm, 14000);
    raise exception 'ขนาดซ้ำแต่เพิ่มได้ ซึ่งไม่ควร';
  exception when others then
    if sqlerrm not like '%มีอยู่แล้ว%' then raise; end if;
  end;
  raise notice 'ข้อ 4 ผ่าน · ขนาดซ้ำเพิ่มไม่ได้';

  -- ── 5 · กรอกไม่ครบ ────────────────────────────────────────────────
  begin
    perform catalog.add_variant_resize(v_base, null, 60, 80, 9999);
    raise exception 'ไม่ใส่ความกว้างแต่เพิ่มได้';
  exception when others then
    if sqlerrm not like '%ความกว้าง%' then raise; end if;
  end;
  begin
    perform catalog.add_variant_resize(v_base, 90, 60, 80, 0);
    raise exception 'ราคา 0 แต่เพิ่มได้';
  exception when others then
    if sqlerrm not like '%ราคาเต็ม%' then raise; end if;
  end;
  raise notice 'ข้อ 5 ผ่าน · กรอกไม่ครบเพิ่มไม่ได้';
end $$;

-- ── 6 · ไม่มีสิทธิ์ products.write ────────────────────────────────────
update core.user_capabilities set revoked_at = now()
  where user_id = '33333333-3333-3333-3333-333333333333' and capability = 'products.write';

do $$
declare v_base uuid;
begin
  select id into v_base from catalog.product_variants
   where material_grade = 'ผ้า A' and width_cm = 51 limit 1;
  begin
    perform catalog.add_variant_resize(v_base, 95, 60, 80, 15000);
    raise exception 'ไม่มีสิทธิ์แต่เพิ่มได้ ซึ่งไม่ควร';
  exception when insufficient_privilege then
    raise notice 'ข้อ 6 ผ่าน · ไม่มีสิทธิ์ products.write เพิ่มไม่ได้';
  end;
end $$;

update core.user_capabilities set revoked_at = null
  where user_id = '33333333-3333-3333-3333-333333333333' and capability = 'products.write';
