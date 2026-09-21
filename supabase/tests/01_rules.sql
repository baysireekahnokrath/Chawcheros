\set ON_ERROR_STOP on
\echo '=== 1. เลขตรวจสอบ (Luhn) ==='
select sku_check_digit('1234566') as "check_ของ_1234566",
       sku_is_valid('12345666')  as "ถูกต้อง",
       sku_is_valid('12345662')  as "พิมพ์ผิด",
       sku_is_valid('12435666')  as "สลับเลข",
       sku_is_valid('02345666')  as "ขึ้นต้น0";

\echo '=== 2. ออก SKU จริง 2000 ตัว ==='
select count(*) as "ออกได้", count(distinct sku) as "ไม่ซ้ำ",
       bool_and(sku_is_valid(sku)) as "ผ่านcheck", bool_and(sku not like '0%') as "ไม่มี0นำ"
from (select mint_sku() as sku from generate_series(1,2000)) x;

\echo '=== 3. รูปแบบแสดงผล ==='
select sku, sku_display(sku) as "แบบ IKEA" from sku_registry limit 3;

\echo '=== 4. กฎ A7 ห้ามลบ ==='
do $$ begin
  delete from sku_registry where true;
  raise exception 'ผิด! ลบได้';
exception when restrict_violation then raise notice 'ถูก: ลบไม่ได้'; end $$;

\echo '=== 5. เตรียมข้อมูลตัวอย่าง ==='
insert into auth.users values ('11111111-1111-1111-1111-111111111111');
insert into app_users (id,email,full_name)
  values ('11111111-1111-1111-1111-111111111111','bay@chawcher.com','Bay');
insert into brands (name) values ('ฌ เฌอ');
insert into categories (name) values ('โซฟา');
insert into products (collection, brand_id, category_id, status)
  select 'ทากะ', b.id, c.id, 'ขายอยู่' from brands b, categories c;
insert into product_variants (sku, product_id, configuration, material_grade, status)
  select (select sku from sku_registry order by sku limit 1), p.id, '3 ที่นั่ง', 'ผ้า A', 'ขายอยู่'
  from products p;
select sku, sku_display(sku) as "แสดงผล", configuration, material_grade from product_variants;

\echo '=== 6. กฎ A3 SKU ห้ามเปลี่ยน ==='
do $$ begin
  update product_variants set sku = (select sku from sku_registry order by sku offset 5 limit 1);
  raise exception 'ผิด! เปลี่ยน SKU ได้';
exception when restrict_violation then raise notice 'ถูก: เปลี่ยน SKU ไม่ได้'; end $$;

\echo '=== 7. แก้ช่องอื่นได้ + updated_at ขยับเอง ==='
update product_variants set configuration = 'L-shape';
select configuration, (updated_at > created_at) as "updated_at_ขยับ" from product_variants;

\echo '=== 8. SKU นอกทะเบียน ใส่ไม่ได้ ==='
do $$ begin
  insert into product_variants (sku, product_id, status) select '99999999', p.id, 'ร่าง' from products p;
  raise exception 'ผิด! ใส่ SKU นอกทะเบียนได้';
exception when foreign_key_violation then raise notice 'ถูก: SKU นอกทะเบียนใส่ไม่ได้'; end $$;

\echo '=== 9. audit_log บันทึกเอง ==='
select table_name, action, count(*) from audit_log group by 1,2 order by 1,2;
