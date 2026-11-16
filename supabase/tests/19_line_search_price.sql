-- ทดสอบ 0038 · ค้นแบบใกล้เคียง + ราคามาตรฐาน · รันหลัง 18
-- เคสจริงจาก Bay 2026-11-12: "ราคา krasa armchair" · "สต็อก kiwi armchair"
do $$
declare j jsonb; n int; b uuid;
begin
  if line_agent.match_score('Kiwi Sofa(1p) Chaw Cher โซฟา Walnut', 'kiwi armchair') <> 2 then raise exception '1 พัง: armchair ต้องเท่ากับ (1p)'; end if;
  if line_agent.match_score('Koontong side board W120', 'kiwi armchair') <> -1 then raise exception '2 พัง: ชื่อรุ่นไม่ตรงต้องไม่นับ'; end if;
  if line_agent.match_score('Kang-Kaen TV cabinet', 'kangkaen') < 1 then raise exception '3 พัง: Kang-Kaen = kangkaen'; end if;

  perform sheets.replace_source('stock', jsonb_build_array(
    jsonb_build_object('row_no',27,'product','Kiwi Sofa(1p)','brand','Chaw Cher','category','โซฟา','material','Walnut','color','Walnut','total',0,'by_place','{}'::jsonb),
    jsonb_build_object('row_no',29,'product','Kiwi Sofa(3S) W158','brand','Chaw Cher','category','โซฟา','material','Walnut','color','Walnut','total',7,'by_place','{"ASE-เพื่อขาย":"7"}'::jsonb),
    jsonb_build_object('row_no',24,'product','Kiwi Side Chair (ตัวสูง)','brand','Chaw Cher','category','เก้าอี้','material','Oak','total',1,'by_place','{}'::jsonb)), '{}');
  select count(*) into n from line_agent.room_stock('kiwi armchair');
  if n <> 1 or (select item from line_agent.room_stock('kiwi armchair')) !~ '1p' then raise exception '4 พัง: kiwi armchair ต้องได้ Kiwi Sofa(1p)'; end if;
  if not (select bool_and(exact) from line_agent.room_stock('kiwi armchair')) then raise exception '5 พัง: armchair=1p ถือว่าตรง'; end if;
  select count(*) into n from line_agent.room_stock('kiwi');
  if n <> 3 then raise exception '6 พัง: kiwi ต้องได้ทั้ง 3 ตัว ได้ %', n; end if;

  insert into catalog.import_batches (source_file) values ('ทดสอบ') returning id into b;
  insert into catalog.import_variants (batch_id, source_row_no, collection, legacy_fullname, list_price_incl_vat, discount_pct, ontop_pct) values
    (b, 1, 'กีวี่', 'ฌ เฌอ | อาร์มแชร์   กีวี่ (Kiwi Armchair) ไม้โอ๊ค   ผ้า A เลือกสีได้ | ขนาด W66 D82 H77 cm', 33600, 20, 10),
    (b, 2, 'กระสา', 'ฌ เฌอ | โซฟา 3 ที่นั่ง กระสา (Krasa Sofa)   ผ้า A เลือกสีได้ | ขนาด W151 D75 H76 cm', 60000, 20, 10);
  -- 0052: % เงินสดมาจากโปรฯ · ใส่โปรของวันนี้เอง ไม่พึ่งโปรตั้งต้นที่หมดเขตสิ้นเดือน
  if to_regclass('marketing.promotions') is not null and exists (select 1 from information_schema.columns
       where table_schema = 'marketing' and table_name = 'promotions' and column_name = 'kind') then
    execute $q$insert into marketing.promotions (name, kind, percent, starts_on, ends_on, status)
      select 'ทดสอบ 19 เงินสด', 'ชำระเงินสด', 10, line_agent.today(), line_agent.today(), 'กำลังใช้'
      where not exists (select 1 from marketing.promotions where kind = 'ชำระเงินสด' and status = 'กำลังใช้'
                        and starts_on <= line_agent.today() and coalesce(ends_on, 'infinity') >= line_agent.today())$q$;
  end if;
  j := line_agent._price_full('kiwi armchair');
  if j->'items'->0->>'name' !~ 'Kiwi Armchair' or (j->'items'->0->>'price')::numeric <> 26880 or (j->'items'->0->>'final')::numeric <> 24192 or not (j->>'exact')::boolean then
    raise exception '7 พัง: ราคา Kiwi Armchair %', j;
  end if;
  j := line_agent._price_full('krasa armchair');
  if (j->>'exact')::boolean or j->'items'->0->>'name' !~ 'Krasa Sofa' then
    raise exception '8 พัง: krasa armchair ไม่มีในไฟล์ ต้องได้ "ใกล้เคียง" Krasa Sofa %', j;
  end if;
  if not (line_agent.room_price('kiwi', 'Gprog')->>'hidden')::boolean then raise exception '9 พัง: กลุ่มไม่เห็นราคา'; end if;
  if (line_agent.room_price('kiwi', 'Gpo')->'items'->0->>'list_price')::numeric <> 33600 then raise exception '10 พัง: กลุ่ม PO ต้องเห็นราคา'; end if;
  raise notice '19 ผ่านทั้ง 10 ข้อ · ราคาตรงไฟล์ Kiwi Armchair โอ๊ค 33600→26880→24192 · armchair=1p · Kang-Kaen=kangkaen · ราคามาตรฐาน · ใกล้เคียงเมื่อไม่ตรง · สิทธิ์ราคา';
end $$;
