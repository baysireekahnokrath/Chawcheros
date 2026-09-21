-- ============================================================================
-- ทดสอบเส้นทาง อัปโหลด → ตรวจ → อนุมัติ → ออก SKU
-- ============================================================================
-- วิธีรัน (ต้องโหลดข้อมูลรอตรวจไว้ก่อน เช่นจาก supabase/seed/import_batch_*.sql)
--   psql -v ON_ERROR_STOP=1 -1 -d cctest -f supabase/tests/03_catalog_import.sql
--
-- ไฟล์นี้เกิดจากการเจอของจริง: ตอนทดสอบครั้งแรกหน้าตรวจเปิดไม่ได้เลย
-- เพราะวิว v_import_groups ไม่ได้ให้สิทธิ์คนล็อกอินอ่าน (แก้ใน 0016)
-- ถ้าไม่ได้ลองรันจริง จะไปเจอตอนผู้ใช้กดใช้งานแทน
-- ============================================================================

insert into auth.users (id) values ('11111111-1111-1111-1111-111111111111')
  on conflict do nothing;
insert into core.app_users (id, email, full_name, status)
  values ('11111111-1111-1111-1111-111111111111','bay@test','เบย์ (ทดสอบ)','ใช้งาน')
  on conflict do nothing;
insert into core.user_capabilities (user_id, capability)
  values ('11111111-1111-1111-1111-111111111111','products.write'),
         ('11111111-1111-1111-1111-111111111111','products.read')
  on conflict do nothing;

set local role authenticated;
set local "test.uid" = '11111111-1111-1111-1111-111111111111';

-- อนุมัติทุกกลุ่มที่ยังรอตรวจ
do $$
declare g record; total int := 0;
begin
  for g in select collection, category from catalog.v_import_groups where รอตรวจ > 0 loop
    total := total + catalog.approve_import_group(g.collection, g.category);
  end loop;
  raise notice 'อนุมัติไป % ตัว', total;
end $$;

-- ตรวจผล · ทุกข้อต้องผ่าน ไม่งั้นโยน exception
do $$
declare v int; n int;
begin
  select count(*) into n from catalog.product_variants;
  if n = 0 then raise exception 'ไม่มีสินค้าเลย — โหลดข้อมูลรอตรวจก่อนรันไฟล์นี้'; end if;

  select count(distinct sku) into v from catalog.product_variants;
  if v <> n then raise exception 'SKU ซ้ำกัน: มี % ตัว แต่ SKU ไม่ซ้ำแค่ %', n, v; end if;

  select count(*) into v from catalog.product_variants where sku !~ '^[1-9][0-9]{7}$';
  if v > 0 then raise exception 'SKU % ตัวผิดรูปแบบ (ต้อง 8 หลัก ไม่ขึ้นต้นด้วย 0)', v; end if;

  select count(*) into v from catalog.product_variants where not catalog.sku_is_valid(sku);
  if v > 0 then raise exception 'เลขตรวจทาน Luhn ผิด % ตัว', v; end if;

  select count(*) into v from catalog.sku_registry;
  if v <> n then raise exception 'ทะเบียน SKU ไม่ตรงกับสินค้า: ทะเบียน % สินค้า %', v, n; end if;

  select count(*) into v from catalog.import_variants
    where review_status = 'อนุมัติแล้ว' and variant_id is null;
  if v > 0 then raise exception 'อนุมัติแล้วแต่ไม่ได้ผูกกลับไปหาแถวต้นทาง % แถว', v; end if;

  raise notice 'ผ่านทุกข้อ · สินค้า % ตัว · SKU ไม่ซ้ำ ไม่ผิดรูปแบบ ทะเบียนตรง', n;
end $$;

-- กฎที่ห้ามพัง
do $$
declare v_id uuid; bad text := '';
begin
  select id into v_id from catalog.product_variants limit 1;

  begin
    update catalog.product_variants set sku = '99999999' where id = v_id;
    bad := bad || ' · แก้ SKU ได้ (กฎ A3 พัง)';
  exception when others then null;
  end;

  begin
    delete from catalog.product_variants where id = v_id;
    bad := bad || ' · ลบสินค้าได้ (กฎ A7 พัง)';
  exception when others then null;
  end;

  begin
    delete from catalog.import_variants where variant_id = v_id;
    bad := bad || ' · ลบแถวนำเข้าได้ (กฎ A7 พัง)';
  exception when others then null;
  end;

  if bad <> '' then raise exception 'กฎพัง:%', bad; end if;
  raise notice 'กฎครบ · SKU แก้ไม่ได้ · ลบไม่ได้ทั้งสินค้าและแถวนำเข้า';
end $$;
