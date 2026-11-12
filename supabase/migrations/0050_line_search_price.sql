-- ============================================================================
-- 0038 · Team Bay หาของเจอจริง · ค้นแบบใกล้เคียง + ราคามาตรฐาน
-- ============================================================================
-- Bay ลองจริง 2026-11-12: "ขอราคา krasa armchair บอกไม่เจอ · ขอสต็อก kiwi armchair บอกไม่เจอ"
--
-- สาเหตุ (ความผิดพลาดของการออกแบบ ไม่ใช่ของข้อมูล)
--   1 บอทไม่มีทางดูราคามาตรฐานเลย · ถามราคาสินค้า = ไปค้นแค่ Clearance
--     → ราคามาตรฐาน 2026 อยู่ใน catalog.import_variants (751 แถว) และ pricing.v_variant_price
--   2 ค้นสต็อกแบบ "ทุกคำต้องเจอ" · ชีตเขียน "Kiwi Sofa(1p)" ไม่มีคำว่า armchair → ไม่เจอเลย
--     → เปลี่ยนเป็นให้คะแนน: ชื่อรุ่นต้องเจอ · คำทั่วไป (armchair · sofa · โต๊ะ ...) ช่วยเรียงลำดับ
--       และรู้จักคำพ้อง armchair = 1p = 1 ที่นั่ง = อาร์มแชร์
--     → ไม่เจอตรงทุกคำ = ส่ง "ใกล้เคียง" กลับไป ไม่ตอบว่าไม่เจอเฉยๆ
-- ============================================================================

-- คำทั่วไป · ช่วยเรียง แต่เจอแค่คำพวกนี้ไม่นับว่าเจอ
create or replace function line_agent.is_generic(w text)
returns boolean language sql immutable
as $$
  select w = any (array[
    'armchair','arm','chair','chairs','sofa','sofas','table','tables','stool','bed','cabinet','sideboard','side',
    'board','tv','coffee','dining','bench','bookshelf','shelf','set','oak','walnut','ash','natural','fabric','leather',
    'อาร์มแชร์','โซฟา','เก้าอี้','โต๊ะ','สตูล','เตียง','ตู้','ตู้เก็บของ','ชั้นวาง','ชั้นวางทีวี','ม้านั่ง','โต๊ะกลาง',
    'โต๊ะข้าง','โต๊ะทานข้าว','ไม้โอ๊ค','ไม้วอลนัท','สีธรรมชาติ','สีวอลนัท','ผ้า','หนัง','ราคา','สต็อก','สต็อค','ตัว',
    'มี','ไหม','เหลือ','กี่','ที่นั่ง','1p','1s','2s','3s'])
$$;

-- คำพ้อง · คำที่คนพิมพ์ → คำที่อาจอยู่ในชีต/ไฟล์ราคา
create or replace function line_agent.word_forms(w text)
returns text[] language sql immutable
as $$
  select case w
    when 'armchair'  then array['armchair','arm chair','อาร์มแชร์','(1p)','1p','1 ที่นั่ง','1s']
    when 'อาร์มแชร์' then array['armchair','arm chair','อาร์มแชร์','(1p)','1p','1 ที่นั่ง','1s']
    when 'sofa'      then array['sofa','โซฟา']
    when 'โซฟา'      then array['sofa','โซฟา']
    when 'chair'     then array['chair','เก้าอี้']
    when 'เก้าอี้'    then array['chair','เก้าอี้']
    when 'sideboard' then array['sideboard','side board','ตู้เก็บของ']
    when 'ตู้'        then array['sideboard','side board','ตู้']
    when 'tv'        then array['tv','ทีวี']
    when 'stool'     then array['stool','สตูล']
    when 'สตูล'      then array['stool','สตูล']
    when 'bed'       then array['bed','เตียง']
    when 'เตียง'      then array['bed','เตียง']
    when 'bench'     then array['bench','ม้านั่ง']
    when 'table'     then array['table','โต๊ะ']
    when 'โต๊ะ'      then array['table','โต๊ะ']
    when 'kangkaen'  then array['kangkaen','kang-kaen','kang kaen','kangkean','กางเขน']
    when 'nangnuan'  then array['nangnuan','nang-nuan','nang nuan','นางนวล']
    when 'nokyoong'  then array['nokyoong','nok-yoong','nok yoong','นกยูง']
    when 'flamingo'  then array['flamingo','famingo','ฟลามิงโก']
    else array[w]
  end
$$;

-- คะแนน: -1 = ชื่อรุ่น (คำที่ไม่ใช่คำทั่วไป) ไม่เจอสักคำ · ไม่งั้น = จำนวนคำที่เจอ
-- ถ้าคำค้นมีแต่คำทั่วไป ต้องเจออย่างน้อย 1 คำ
create or replace function line_agent.match_score(p_hay text, p_query text)
returns int language plpgsql immutable
as $$
declare w text; hay text := lower(coalesce(p_hay, '')); n int := 0; distinct_hit int := 0; distinct_all int := 0;
begin
  for w in select x from regexp_split_to_table(lower(btrim(coalesce(p_query, ''))), '\s+') x where length(x) > 0 loop
    if not line_agent.is_generic(w) then distinct_all := distinct_all + 1; end if;
    if exists (select 1 from unnest(line_agent.word_forms(w)) f where position(f in hay) > 0) then
      n := n + 1;
      if not line_agent.is_generic(w) then distinct_hit := distinct_hit + 1; end if;
    end if;
  end loop;
  if distinct_all > 0 and distinct_hit = 0 then return -1; end if;
  if n = 0 then return -1; end if;
  return n;
end;
$$;

create or replace function line_agent.query_words(p_query text)
returns int language sql immutable
as $$ select count(*)::int from regexp_split_to_table(btrim(coalesce(p_query,'')), '\s+') x where length(x) > 0 $$;

-- ---------------------------------------------------------------------------
-- สต็อก · ค้นแบบให้คะแนน · exact = เจอทุกคำ
-- ---------------------------------------------------------------------------
drop function if exists line_agent.room_stock(text);
create or replace function line_agent.room_stock(p_query text)
returns table (kind text, item text, location text, status text, units numeric, source text, exact boolean)
language sql stable security definer
set search_path = line_agent, stock, catalog, sheets, public
as $$
  with sys as (
    select 'สินค้า'::text as kind,
           concat_ws(' · ', p.collection, nullif(p.name_th,''), v.configuration, v.material_grade,
                     nullif(concat_ws(' ', v.wood_type, v.wood_colour), '')) as item,
           loc.name as location, u.status::text as status, count(*)::numeric as units, 'ระบบ'::text as source,
           concat_ws(' ', p.collection, p.name_th, p.name_en, v.configuration, v.material_grade,
                     v.wood_type, v.wood_colour, v.legacy_fullname) as hay
    from stock.units u
    join catalog.product_variants v on v.id = u.variant_id
    join catalog.products p         on p.id = v.product_id
    join stock.locations loc        on loc.id = u.location_id
    where u.status <> 'ส่งแล้ว'
    group by 1, 2, 3, 4, 6, 7
  ),
  sh as (
    select 'สินค้า', concat_ws(' · ', s.product, nullif(s.material,''), nullif(s.color,''), nullif(s.size,'')),
           (select string_agg(e.key || ' ' || e.value, ' · ' order by e.key)
              from jsonb_each_text(s.by_place) e where btrim(e.value) not in ('', '0')),
           null::text, s.total, 'ชีต',
           concat_ws(' ', s.product, s.brand, s.category, s.material, s.color, s.size)
    from sheets.stock s
  ),
  fab as (
    select 'วัสดุ', concat_ws(' · ', f.group_name, f.name), null::text,
           coalesce(f.stock_text, '—'), f.stock, 'ชีต', concat_ws(' ', f.group_name, f.name, 'ผ้า หนัง วัสดุ')
    from sheets.fabric f
  ),
  mats as (
    select 'วัสดุ', concat_ws(' · ', c.pricing_grade, m.name, m.colour_name), null::text,
           m.status::text, null::numeric, 'ระบบ',
           concat_ws(' ', c.pricing_grade, c.name_en, c.name_th, m.name, m.colour_name, m.code, 'ผ้า หนัง วัสดุ')
    from materials.materials m
    join materials.material_collections c on c.id = m.collection_id
  ),
  scored as (
    select a.*, line_agent.match_score(a.hay, p_query) as score
    from (select * from sys union all select * from sh union all select * from fab union all select * from mats) a
  ),
  best as (select max(score) as top from scored)
  select kind, item, location, status, units, source, score >= line_agent.query_words(p_query)
  from scored, best
  where score >= 0 and score = best.top          -- เอาเฉพาะกลุ่มที่ใกล้ที่สุด
  order by kind desc, item
  limit 20
$$;

-- ---------------------------------------------------------------------------
-- ราคามาตรฐาน · ไฟล์ราคา Standard Price 2026 (import_variants) · ถ้าผ่านการตรวจแล้วใช้ราคาในระบบ
-- ---------------------------------------------------------------------------
create or replace function line_agent._price_full(p_query text)
returns jsonb
language sql stable security definer
set search_path = line_agent, catalog, pricing, public
as $$
  with rows as (
    select distinct on (iv.legacy_fullname)
           iv.legacy_fullname as name,
           coalesce(vp."ราคาเต็มรวม_vat", iv.list_price_incl_vat) as list_price,
           coalesce(vp."ส่วนลดปกติ_pct", iv.discount_pct) as disc_pct,
           (iv.variant_id is not null) as approved,
           line_agent.match_score(concat_ws(' ', iv.legacy_fullname, iv.collection, iv.category, iv.sub_category,
                                            iv.material_grade, iv.wood, iv.wood_colour), p_query) as score,
           iv.source_row_no
    from catalog.import_variants iv
    left join pricing.v_variant_price vp on vp.variant_id = iv.variant_id
    where iv.legacy_fullname is not null
      and coalesce(iv.review_status::text, '') <> 'ไม่ใช้'
    order by iv.legacy_fullname, iv.reviewed_at desc nulls last
  ),
  best as (select max(score) as top from rows where score >= 0)
  select jsonb_build_object(
    'exact', coalesce((select top from best), -1) >= line_agent.query_words(p_query),
    'total', (select count(*) from rows, best where rows.score = best.top),
    'items', coalesce((select jsonb_agg(jsonb_build_object(
               'name', name, 'list_price', list_price, 'disc_pct', disc_pct,
               'price', case when disc_pct is not null and list_price is not null
                             then round(list_price * (1 - disc_pct / 100)) end,
               'approved', approved) order by source_row_no)
             from (select r.* from rows r, best where r.score = best.top order by r.source_row_no limit 12) t), '[]'::jsonb))
$$;

create or replace function line_agent.room_price(p_query text, p_group_id text)
returns jsonb
language sql stable security definer
set search_path = line_agent, public
as $$
  select case when f.id is null then null
              when not f.see_price then jsonb_build_object('hidden', true)
              else line_agent._price_full(p_query) end
  from (select (line_agent.room_flags(p_group_id)).*) f
$$;

-- Clearance ค้นแบบให้คะแนนเหมือนกัน
create or replace function line_agent._clearance_full(p_query text)
returns jsonb
language sql stable security definer
set search_path = line_agent, sheets, public
as $$
  with src as (select expires_on from sheets.sources where id = 'clearance'),
  scored as (
    select c.*, line_agent.match_score(concat_ws(' ', c.full_name, c.code, c.collection, c.name_en,
                                                 c.wood, c.wood_colour, c.upholstery_colour), p_query) as score
    from sheets.clearance c
  ),
  best as (select max(score) as top from scored where score >= 0),
  hit as (select s.* from scored s, best where s.score = best.top order by s.row_no limit 10)
  select jsonb_build_object(
    'expires_on', (select expires_on from src),
    'expired', (select expires_on < line_agent.today() from src),
    'updated_at', (select last_ok_at from sheets.sources where id = 'clearance'),
    'exact', coalesce((select top from best), -1) >= line_agent.query_words(p_query),
    'total', (select count(*) from hit),
    'items', case when (select expires_on < line_agent.today() from src) then '[]'::jsonb
                  else coalesce((select jsonb_agg(jsonb_build_object(
                         'name', h.full_name, 'retail', h.retail, 'disc', h.disc_pct, 'price', h.price)
                         order by h.row_no) from hit h), '[]'::jsonb) end)
$$;

revoke all on function line_agent.room_stock(text), line_agent._price_full(text), line_agent.room_price(text, text),
  line_agent._clearance_full(text) from public, anon, authenticated;
revoke all on function line_agent._price_full(text), line_agent._clearance_full(text) from service_role;
grant execute on function line_agent.room_stock(text), line_agent.room_price(text, text) to service_role;
grant execute on function line_agent.match_score(text, text), line_agent.is_generic(text),
  line_agent.word_forms(text), line_agent.query_words(text) to service_role;

notify pgrst, 'reload schema';
