\set ON_ERROR_STOP on
insert into auth.users values ('11111111-1111-1111-1111-111111111111');
insert into core.app_users (id,email,full_name) values ('11111111-1111-1111-1111-111111111111','bay@chawcher.com','Bay');
insert into core.user_capabilities (user_id,capability)
  select '11111111-1111-1111-1111-111111111111', c from unnest(enum_range(null::core.capability)) c;
set "test.uid" = '11111111-1111-1111-1111-111111111111';

-- สินค้าตัวอย่าง: เตียง 2 ตัว + โซฟา 1 ตัว
insert into catalog.brands (name) values ('ฌ เฌอ');
insert into catalog.categories (name) values ('เตียง'),('โซฟา');
insert into catalog.products (collection,brand_id,category_id,status)
  select 'นอนดี', b.id, c.id, 'ขายอยู่' from catalog.brands b, catalog.categories c where c.name='เตียง';
insert into catalog.products (collection,brand_id,category_id,status)
  select 'ทากะ', b.id, c.id, 'ขายอยู่' from catalog.brands b, catalog.categories c where c.name='โซฟา';
insert into catalog.product_variants (sku,product_id,configuration,status)
  select catalog.mint_sku(), p.id, v.cfg, 'ขายอยู่'
  from catalog.products p, (values ('5 ฟุต'),('6 ฟุต')) v(cfg) where p.collection='นอนดี';
insert into catalog.product_variants (sku,product_id,configuration,status)
  select catalog.mint_sku(), p.id, '3 ที่นั่ง', 'ขายอยู่' from catalog.products p where p.collection='ทากะ';
insert into pricing.variant_prices (variant_id,list_price_incl_vat)
  select id, 53500 from catalog.product_variants where configuration like '%ฟุต';
insert into pricing.variant_prices (variant_id,list_price_incl_vat)
  select id, 107000 from catalog.product_variants where configuration='3 ที่นั่ง';

\echo '=== 1. ราคาก่อนจัดโปร ==='
select collection, configuration, ราคาเต็มรวม_vat, ส่วนลดปกติ_pct, ราคาขายรวม_vat
from pricing.v_variant_price order by collection, configuration;

\echo '=== 2. การตลาดตั้งแคมเปญ + โปรลดเตียงทั้งหมด 30% ==='
insert into marketing.campaigns (name,channel_id,objective,starts_on,ends_on,budget,status)
  values ('โปรเตียงรับปีใหม่','facebook','ดันยอดเตียงหมวดทั้งหมด',
          current_date, current_date+30, 50000,'กำลังทำ');

-- เรียกผ่าน "ประตู" ของโมดูล pricing เท่านั้น ห้ามเขียนตารางส่วนลดตรงๆ
insert into marketing.promotions (name,campaign_id,headline,starts_on,ends_on,discount_rule_id,status)
select 'ลดเตียงทั้งหมด 30%', c.id, 'เตียงทุกรุ่น ลด 30%', current_date, current_date+30,
       pricing.create_promo_discount('โปรเตียงรับปีใหม่','หมวด',
         (select id from catalog.categories where name='เตียง'), 30, current_date, current_date+30),
       'กำลังใช้'
from marketing.campaigns c where c.name='โปรเตียงรับปีใหม่';

\echo '=== 3. ราคาหลังจัดโปร (เตียงต้องลด โซฟาต้องไม่ขยับ) ==='
select collection, configuration, ราคาเต็มรวม_vat, ส่วนลดปกติ_pct, ราคาขายรวม_vat
from pricing.v_variant_price order by collection, configuration;

\echo '=== 4. ประตูกันคนไม่มีสิทธิ์ได้ไหม ==='
update core.user_capabilities set revoked_at=now()
  where capability='marketing.write' and user_id='11111111-1111-1111-1111-111111111111';
do $$ begin
  perform pricing.create_promo_discount('แอบลด','ทั้งหมด',null,99,current_date,null);
  raise exception 'ผิด! ตั้งส่วนลดได้ทั้งที่ไม่มีสิทธิ์';
exception when insufficient_privilege then raise notice 'ถูก: ไม่มีสิทธิ์ ตั้งส่วนลดไม่ได้'; end $$;
update core.user_capabilities set revoked_at=null
  where capability='marketing.write' and user_id='11111111-1111-1111-1111-111111111111';

\echo '=== 5. ประตูกันส่วนลดเกิน 100% ได้ไหม ==='
do $$ begin
  perform pricing.create_promo_discount('ลดเกินจริง','ทั้งหมด',null,150,current_date,null);
  raise exception 'ผิด! ลด 150%% ได้';
exception when others then raise notice 'ถูก: %', sqlerrm; end $$;

\echo '=== 6. ค่าโฆษณา เทียบงบ ==='
insert into marketing.campaign_spend (campaign_id,amount,note)
  select id, 12000,'ยิงแอด 3 วันแรก' from marketing.campaigns;
insert into marketing.campaign_spend (campaign_id,amount,note)
  select id, 8500,'ยิงแอดต่อ' from marketing.campaigns;
select name, ช่องทาง, งบที่ตั้ง, ใช้จริง, คงเหลือ, จำนวนโปร from marketing.v_campaign_summary;

\echo '=== 7. หน้างานวันนี้ของการตลาด ==='
insert into marketing.content_items (title,campaign_id,channel_id,status,scheduled_at)
  select 'โพสต์เปิดตัวโปรเตียง', id,'facebook','กำลังทำ', now() - interval '2 day'
  from marketing.campaigns;
update marketing.promotions set ends_on = current_date + 3;
select หมวด, เรื่อง, อีกกี่วัน from marketing.v_today order by หมวด;
