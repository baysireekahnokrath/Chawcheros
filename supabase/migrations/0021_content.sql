-- ============================================================================
-- 0021 · โมดูลคอนเทนต์ · ของชิ้นเดียว ลงหลายที่
-- ============================================================================
-- คำตอบของ Bay ที่กำหนดรูปร่างโมดูลนี้
--   งานที่ทำ  · YouTube คลิปยาว/คลิปสั้น · TikTok · Reel · Shorts · เว็บไซต์
--   ใครตั้งได้ · ใครก็ได้ (การตลาดหรือกราฟิก)
--   อนุมัติ   · Bay คนเดียว แต่เพิ่มคนได้ทีหลัง (สิทธิ์ content.approve ใน 0020)
--   ไฟล์งาน   · แปะลิงก์ Drive/Figma ไม่อัปไฟล์เข้าระบบ
--   เตือน     · ไม่ต้องมี
--
-- ★ เรื่องที่เปลี่ยนโครงทั้งหมด: Reel กับ Shorts กับ TikTok คือคลิปตัวเดียวกัน
--   ถ่ายทีเดียว ตัดทีเดียว แล้วโพสต์สามที่
--   ของเดิม marketing.content_items ผูก 1 คอนเทนต์ = 1 ช่องทาง ซึ่งจะทำให้
--   ต้องสร้างงานซ้ำสามใบสำหรับคลิปเดียว แล้วแก้บททีต้องแก้สามที่
--   จึงแยกเป็น "ชิ้นงาน" กับ "ที่ลง" แล้วถามได้ว่าคลิปนี้ลงครบทุกที่แล้วยัง
--
-- แยกเป็น schema ของตัวเอง ไม่อยู่ใน marketing เพราะกราฟิกต้องเข้าถึงงานตัวเอง
-- แต่ไม่ควรเห็นงบแคมเปญและค่าโฆษณา ถ้าอยู่ schema เดียวกันจะแยกสิทธิ์ไม่ได้
-- ============================================================================

create schema if not exists content;

-- ---------------------------------------------------------------------------
-- ความยาวงาน · แยกออกจากแพลตฟอร์ม
-- คลิปสั้นตัวเดียวลงได้ทั้ง TikTok Reel และ Shorts จึงไม่ควรเป็นประเภทตายตัว
-- เพิ่มแพลตฟอร์มใหม่วันหน้า = เพิ่มแถวใน marketing.channels ไม่ต้องแก้โค้ด
-- ---------------------------------------------------------------------------
create type content.format as enum ('คลิปยาว', 'คลิปสั้น', 'หน้าเว็บ');

-- ---------------------------------------------------------------------------
-- ขั้นของงาน · Bay เลือกให้แยกช่วงผลิตเป็น 3 ขั้น
-- เพราะงานวิดีโอค้างที่ "ถ่ายแล้วแต่ยังไม่ได้ตัด" บ่อยที่สุด
-- ถ้ามีสถานะเดียวว่ากำลังทำ จะมองไม่ออกว่าค้างตรงไหน
-- และคลิปที่ถ่ายแล้วไม่ได้ตัดคือเงินที่จ่ายไปแล้วไม่ได้ใช้
-- ---------------------------------------------------------------------------
create type content.stage as enum (
  'ไอเดีย',
  'เขียนบท',
  'ถ่ายแล้วรอตัด',
  'ตัดเสร็จ',
  'รอตรวจ',
  'ตีกลับแก้',
  'พร้อมโพสต์',
  'โพสต์แล้ว',
  'พับไว้'
);

-- ---------------------------------------------------------------------------
-- ชิ้นงาน · คลิป 1 ตัว หรือหน้าเว็บ 1 หน้า
-- ---------------------------------------------------------------------------
create table content.items (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  format        content.format not null,
  stage         content.stage not null default 'ไอเดีย',

  brief         text,
  campaign_id   uuid references marketing.campaigns(id),

  -- ไฟล์งานอยู่ข้างนอก เก็บแค่ลิงก์ (คำตอบข้อ 4 ของ Bay)
  -- กราฟิกทำงานใน Figma/Premiere อยู่แล้ว ถ้าบังคับอัปซ้ำจะมีสองที่แล้วไม่ตรงกัน
  script_url    text,
  raw_url       text,
  edit_url      text,
  thumbnail_url text,

  owner_id      uuid references core.app_users(id),
  due_on        date,

  -- การอนุมัติ
  approved_by   uuid references core.app_users(id),
  approved_at   timestamptz,
  review_note   text,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  updated_by    uuid references core.app_users(id)
);

create index on content.items (stage);
create index on content.items (owner_id);
create index on content.items (campaign_id);

comment on table content.items is
  'ชิ้นงาน 1 ชิ้น = คลิป 1 ตัว หรือหน้าเว็บ 1 หน้า · ลงได้หลายช่องทาง ดูที่ content.placements';
comment on column content.items.edit_url is
  'ลิงก์ไฟล์ที่ตัดเสร็จแล้ว · แก้ลิงก์นี้หลังอนุมัติ = การอนุมัติเป็นโมฆะ ต้องตรวจใหม่';

-- ---------------------------------------------------------------------------
-- ★ ที่ลง · คลิปสั้น 1 ตัว → 3 แถว (TikTok · Reel · Shorts) แต่ละแถวมีลิงก์ของตัวเอง
-- ---------------------------------------------------------------------------
create table content.placements (
  id            uuid primary key default gen_random_uuid(),
  item_id       uuid not null references content.items(id),
  channel_id    text not null references marketing.channels(id),
  planned_on    date,
  published_at  timestamptz,
  published_url text,
  note          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  updated_by    uuid references core.app_users(id),
  unique (item_id, channel_id)
);

create index on content.placements (item_id);

comment on table content.placements is
  'ชิ้นงานนี้ลงที่ไหนบ้าง · ถามได้ว่าคลิปนี้ลงครบทุกที่แล้วยัง ซึ่งเป็นงานที่ตกหล่นบ่อยที่สุด';

-- สินค้าที่คลิปนี้พูดถึง · ใช้ตอนอยากรู้ว่ารุ่นไหนยังไม่เคยมีคอนเทนต์เลย
create table content.item_products (
  item_id    uuid not null references content.items(id),
  variant_id uuid not null references catalog.product_variants(id),
  primary key (item_id, variant_id)
);

select core.apply_standard_rules('content.items');
select core.apply_standard_rules('content.placements');

create trigger no_delete_content_item_products before delete on content.item_products
  for each row execute function core.prevent_delete();

-- ---------------------------------------------------------------------------
-- ★ แก้ไฟล์หลังอนุมัติ = การอนุมัติเป็นโมฆะ
--
-- ปัญหาคลาสสิกของงานคอนเทนต์คือ "ตัวที่อนุมัติ ไม่ใช่ตัวที่โพสต์"
-- อนุมัติคลิปไปแล้ว ตัดใหม่อีกรอบ แล้วโพสต์ตัวใหม่โดยไม่มีใครตรวจ
-- ถ้าในคลิปมีราคาหรือส่วนลด แล้วตัวใหม่ใส่ตัวเลขผิด ลูกค้าแคปไว้ = ต้องขายตามนั้น
-- ระบบจึงถอนการอนุมัติเองเมื่อไฟล์หรือบรีฟเปลี่ยน ไม่ต้องหวังให้คนจำ
-- ---------------------------------------------------------------------------
create or replace function content.void_approval_on_change()
returns trigger
language plpgsql
set search_path = content, core, public
as $$
begin
  if old.stage = 'พร้อมโพสต์'
     and new.stage = old.stage
     and (new.script_url is distinct from old.script_url
       or new.edit_url   is distinct from old.edit_url
       or new.brief      is distinct from old.brief
       or new.title      is distinct from old.title)
  then
    new.stage       := 'รอตรวจ';
    new.approved_by := null;
    new.approved_at := null;
    new.review_note := 'ไฟล์หรือบรีฟถูกแก้หลังอนุมัติแล้ว — ต้องตรวจใหม่';
  end if;
  return new;
end;
$$;

create trigger void_approval before update on content.items
  for each row execute function content.void_approval_on_change();

-- ---------------------------------------------------------------------------
-- ส่งตรวจ · ใครก็ได้ที่ทำงานอยู่
-- ---------------------------------------------------------------------------
create or replace function content.submit_for_review(p_item_id uuid)
returns content.items
language plpgsql security definer
set search_path = core, content, public
as $$
declare it content.items;
begin
  if not (core.has_capability('marketing.write') or core.has_capability('design.write')) then
    raise exception 'ต้องมีสิทธิ์ marketing.write หรือ design.write จึงจะส่งตรวจได้'
      using errcode = 'insufficient_privilege';
  end if;

  select * into it from content.items where id = p_item_id;
  if not found then raise exception 'ไม่พบชิ้นงาน'; end if;
  if it.stage in ('รอตรวจ', 'พร้อมโพสต์', 'โพสต์แล้ว') then
    raise exception 'ชิ้นนี้อยู่ขั้น "%" อยู่แล้ว ส่งตรวจซ้ำไม่ได้', it.stage;
  end if;

  update content.items
     set stage = 'รอตรวจ', review_note = null
   where id = p_item_id
  returning * into it;
  return it;
end;
$$;

-- ---------------------------------------------------------------------------
-- ★ อนุมัติ · ด่านจริงอยู่ตรงนี้ ไม่ใช่การซ่อนปุ่มในหน้าเว็บ
-- ---------------------------------------------------------------------------
create or replace function content.approve_item(
  p_item_id uuid,
  p_note    text default null
) returns content.items
language plpgsql security definer
set search_path = core, content, public
as $$
declare it content.items;
begin
  if not core.has_capability('content.approve') then
    raise exception 'ต้องมีสิทธิ์ content.approve จึงจะอนุมัติคอนเทนต์ได้'
      using errcode = 'insufficient_privilege';
  end if;

  select * into it from content.items where id = p_item_id;
  if not found then raise exception 'ไม่พบชิ้นงาน'; end if;
  if it.stage <> 'รอตรวจ' then
    raise exception 'อนุมัติได้เฉพาะชิ้นที่ส่งตรวจแล้ว · ตอนนี้อยู่ขั้น "%"', it.stage;
  end if;

  update content.items
     set stage       = 'พร้อมโพสต์',
         approved_by = auth.uid(),
         approved_at = now(),
         review_note = p_note
   where id = p_item_id
  returning * into it;
  return it;
end;
$$;

-- ตีกลับให้แก้ · ต้องบอกเหตุผล ไม่งั้นคนทำไม่รู้จะแก้อะไร
create or replace function content.bounce_item(
  p_item_id uuid,
  p_reason  text
) returns content.items
language plpgsql security definer
set search_path = core, content, public
as $$
declare it content.items;
begin
  if not core.has_capability('content.approve') then
    raise exception 'ต้องมีสิทธิ์ content.approve จึงจะตีกลับได้'
      using errcode = 'insufficient_privilege';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'ต้องบอกเหตุผลที่ตีกลับ ไม่งั้นคนทำไม่รู้ว่าต้องแก้อะไร';
  end if;

  select * into it from content.items where id = p_item_id;
  if not found then raise exception 'ไม่พบชิ้นงาน'; end if;

  update content.items
     set stage = 'ตีกลับแก้', review_note = trim(p_reason),
         approved_by = null, approved_at = null
   where id = p_item_id
  returning * into it;
  return it;
end;
$$;

-- ---------------------------------------------------------------------------
-- ★ บันทึกว่าโพสต์แล้ว · คนกด ไม่ใช่ระบบ (กฎชั้น AI ข้อ 4 ของ Bay)
-- โพสต์ได้เฉพาะชิ้นที่อนุมัติแล้ว
-- ---------------------------------------------------------------------------
create or replace function content.mark_posted(
  p_placement_id uuid,
  p_url          text
) returns content.placements
language plpgsql security definer
set search_path = core, content, public
as $$
declare pl content.placements; it content.items; v_left int;
begin
  if not (core.has_capability('marketing.write') or core.has_capability('design.write')) then
    raise exception 'ต้องมีสิทธิ์ marketing.write หรือ design.write จึงจะบันทึกการโพสต์ได้'
      using errcode = 'insufficient_privilege';
  end if;

  select * into pl from content.placements where id = p_placement_id;
  if not found then raise exception 'ไม่พบรายการที่ลง'; end if;

  select * into it from content.items where id = pl.item_id;
  if it.stage not in ('พร้อมโพสต์', 'โพสต์แล้ว') then
    raise exception 'ชิ้นนี้ยังไม่ผ่านการอนุมัติ (ตอนนี้ "%") โพสต์ไม่ได้', it.stage;
  end if;
  if coalesce(trim(p_url), '') = '' then
    raise exception 'ต้องใส่ลิงก์ที่โพสต์จริง จะได้ย้อนกลับไปดูได้';
  end if;

  update content.placements
     set published_url = trim(p_url), published_at = now(), updated_by = auth.uid()
   where id = p_placement_id
  returning * into pl;

  -- ลงครบทุกที่แล้ว ชิ้นงานถึงจะนับว่าโพสต์แล้ว
  -- ตรงนี้ระบบคิดเอง ไม่ใช่ช่องให้คนมาติ๊ก (เอกสารหัวข้อ 6)
  select count(*) into v_left from content.placements
   where item_id = pl.item_id and published_url is null;
  if v_left = 0 then
    update content.items set stage = 'โพสต์แล้ว' where id = pl.item_id;
  end if;

  return pl;
end;
$$;

-- ---------------------------------------------------------------------------
-- งานวันนี้ของคอนเทนต์ · หน้าจอคืองานที่ต้องลงมือ ไม่ใช่ตารางให้ไล่ดู
-- ---------------------------------------------------------------------------
create view content.v_today with (security_invoker = true) as
select 'รอคุณอนุมัติ'                as "หมวด",
       i.title                       as "เรื่อง",
       i.format::text                as "รูปแบบ",
       i.stage::text                 as "ขั้น",
       i.due_on                      as "กำหนด",
       i.id                          as ref_id
from content.items i
where i.stage = 'รอตรวจ'
union all
select 'ถูกตีกลับ ต้องแก้', i.title, i.format::text, i.stage::text, i.due_on, i.id
from content.items i where i.stage = 'ตีกลับแก้'
union all
select 'ถ่ายแล้วยังไม่ได้ตัด', i.title, i.format::text, i.stage::text, i.due_on, i.id
from content.items i where i.stage = 'ถ่ายแล้วรอตัด'
union all
select 'อนุมัติแล้ว รอโพสต์', i.title, i.format::text, i.stage::text, i.due_on, i.id
from content.items i where i.stage = 'พร้อมโพสต์';

comment on view content.v_today is
  'งานคอนเทนต์ที่ต้องลงมือ · รอคุณอนุมัติมาก่อน เพราะเป็นตัวที่บล็อกคนอื่นอยู่';

-- ---------------------------------------------------------------------------
-- ★ ลงครบทุกที่แล้วยัง · คำถามที่ตกหล่นบ่อยที่สุด
-- ---------------------------------------------------------------------------
create view content.v_placement_gaps with (security_invoker = true) as
select
  i.id                                                   as item_id,
  i.title                                                as "เรื่อง",
  i.format::text                                         as "รูปแบบ",
  i.stage::text                                          as "ขั้น",
  count(*)                                               as "ตั้งใจลงกี่ที่",
  count(*) filter (where p.published_url is not null)     as "ลงแล้ว",
  count(*) filter (where p.published_url is null)         as "ยังไม่ได้ลง",
  string_agg(ch.name_th, ' · ') filter (where p.published_url is null)
                                                         as "ที่ยังขาด"
from content.items i
join content.placements p       on p.item_id = i.id
join marketing.channels ch      on ch.id = p.channel_id
where i.stage in ('พร้อมโพสต์', 'โพสต์แล้ว')
group by i.id, i.title, i.format, i.stage
having count(*) filter (where p.published_url is null) > 0;

comment on view content.v_placement_gaps is
  'ชิ้นที่อนุมัติแล้วแต่ยังลงไม่ครบทุกช่องทาง · ถ่ายทีเดียวลงสามที่ แล้วลืมไปที่หนึ่ง';

-- ---------------------------------------------------------------------------
-- RLS · การตลาดกับกราฟิกทำงานได้ทั้งคู่ (Bay ตอบข้อ 2 ว่า "ได้หมด")
-- แต่อนุมัติเป็นสิทธิ์แยก และบังคับผ่านฟังก์ชันอีกชั้น
-- ---------------------------------------------------------------------------
alter table content.items         enable row level security;
alter table content.placements    enable row level security;
alter table content.item_products enable row level security;

create policy items_select on content.items for select to authenticated
  using (core.has_capability('marketing.write') or core.has_capability('design.write')
         or core.has_capability('content.approve'));
create policy items_write on content.items for all to authenticated
  using (core.has_capability('marketing.write') or core.has_capability('design.write'))
  with check (core.has_capability('marketing.write') or core.has_capability('design.write'));

create policy pl_select on content.placements for select to authenticated
  using (core.has_capability('marketing.write') or core.has_capability('design.write')
         or core.has_capability('content.approve'));
create policy pl_write on content.placements for all to authenticated
  using (core.has_capability('marketing.write') or core.has_capability('design.write'))
  with check (core.has_capability('marketing.write') or core.has_capability('design.write'));

create policy ip_select on content.item_products for select to authenticated
  using (core.has_capability('marketing.write') or core.has_capability('design.write')
         or core.has_capability('content.approve'));
create policy ip_write on content.item_products for all to authenticated
  using (core.has_capability('marketing.write') or core.has_capability('design.write'))
  with check (core.has_capability('marketing.write') or core.has_capability('design.write'));

grant usage on schema content to authenticated, service_role;
grant select, insert, update on all tables in schema content to authenticated;
grant usage, select on all sequences in schema content to authenticated;
alter default privileges in schema content
  grant select, insert, update on tables to authenticated;
alter default privileges in schema content
  grant usage, select on sequences to authenticated;

revoke all on schema content from anon;

revoke all on function content.submit_for_review(uuid)      from public, anon;
revoke all on function content.approve_item(uuid, text)     from public, anon;
revoke all on function content.bounce_item(uuid, text)      from public, anon;
revoke all on function content.mark_posted(uuid, text)      from public, anon;
revoke all on function content.void_approval_on_change()    from public, anon, authenticated;

grant execute on function content.submit_for_review(uuid)   to authenticated;
grant execute on function content.approve_item(uuid, text)  to authenticated;
grant execute on function content.bounce_item(uuid, text)   to authenticated;
grant execute on function content.mark_posted(uuid, text)   to authenticated;

-- ---------------------------------------------------------------------------
-- YouTube ยังไม่มีในรายการช่องทาง ทั้งที่เป็นอันดับหนึ่งของ Bay
-- ---------------------------------------------------------------------------
insert into marketing.channels (id, name_th, sort_order) values
  ('youtube', 'YouTube', 0)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- ของเดิมใน marketing ถูกแทนที่แล้ว · ว่างเปล่าทั้งคู่ ไม่มีข้อมูลเสียหาย
-- วิวของ marketing ต้องเลิกอ้างถึงก่อนถึงจะทิ้งตารางได้
-- ---------------------------------------------------------------------------
drop view if exists marketing.v_today;
drop view if exists marketing.v_campaign_summary;
drop table if exists marketing.content_items;
drop type if exists marketing.content_status;

create view marketing.v_today with (security_invoker = true) as
select 'โปรใกล้หมดอายุ' as "หมวด",
       pr.name          as "เรื่อง",
       (pr.ends_on - current_date) as "อีกกี่วัน",
       pr.id            as ref_id
from marketing.promotions pr
where pr.status = 'กำลังใช้' and pr.ends_on is not null
  and pr.ends_on between current_date and current_date + 7
union all
select 'แคมเปญใกล้จบ', c.name, (c.ends_on - current_date), c.id
from marketing.campaigns c
where c.status = 'กำลังทำ' and c.ends_on is not null
  and c.ends_on between current_date and current_date + 7
union all
select 'คอนเทนต์รออนุมัติ', i.title, null, i.id
from content.items i
where i.stage = 'รอตรวจ';

comment on view marketing.v_today is
  'งานการตลาดที่ต้องลงมือวันนี้ · คอนเทนต์ยกมาจากโมดูล content';

create view marketing.v_campaign_summary with (security_invoker = true) as
select
  c.id,
  c.name,
  ch.name_th                                              as "ช่องทาง",
  c.status::text,
  c.starts_on,
  c.ends_on,
  c.budget                                                as "งบที่ตั้ง",
  coalesce((select sum(s.amount) from marketing.campaign_spend s
             where s.campaign_id = c.id), 0)              as "ใช้จริง",
  c.budget - coalesce((select sum(s.amount) from marketing.campaign_spend s
                        where s.campaign_id = c.id), 0)   as "คงเหลือ",
  (select count(*) from marketing.promotions p where p.campaign_id = c.id)  as "จำนวนโปร",
  (select count(*) from content.items i where i.campaign_id = c.id)         as "จำนวนคอนเทนต์"
from marketing.campaigns c
left join marketing.channels ch on ch.id = c.channel_id;

-- ---------------------------------------------------------------------------
-- ลงทะเบียนโมดูล
-- ---------------------------------------------------------------------------
insert into core.modules
  (id, name_th, name_en, icon, db_schema, depends_on, required_capability,
   home_path, sort_order, is_core, description_th) values
  ('content', 'คอนเทนต์', 'Content', 'megaphone', 'content',
   '{core,marketing}', 'design.write', '/content', 7, false,
   'คลิปยาว คลิปสั้น หน้าเว็บ · ถ่ายทีเดียวลงหลายที่ · ต้องอนุมัติก่อนโพสต์');

-- ⚠️ ขาดบรรทัดนี้ = REST API มองไม่เห็น schema content ทั้งก้อน
alter role authenticator
  set pgrst.db_schemas = 'public, graphql_public, core, catalog, materials, pricing, cost, marketing, stock, content';

notify pgrst, 'reload config';
