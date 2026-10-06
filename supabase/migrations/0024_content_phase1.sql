-- ============================================================================
-- 0024 · โมดูลคอนเทนต์ เฟส 1 · รอบ R1 ชิ้นงาน
-- ============================================================================
-- ที่มา: docs/modules/content/2-requirements.md · 4-build-plan.md รอบ R1
--
--   Q-01–04   ประเภท ข้อความ/ภาพ/อัลบั้ม · ช่องทาง FB IG เว็บ · ข้อความลง IG ไม่ได้
--   Q-10–13   ธีม (คร่อมเดือนได้) · pillar · ผูกชิ้นงานกับ ธีม pillar แคมเปญ สินค้า คนทำ
--   Q-30–36   brief = hook · เนื้อหา · visual · ข้อความแยกต่อช่องทาง · ภาพหลายภาพเรียงได้
--             คอมเมนต์แรก · ลิงก์ต้นทาง
--   Q-110–112 แบรนด์เป็นตัวแยกหลัก · ตั้งงานต้องเลือกแบรนด์
--   Q-116–118 pillar ธีม แคมเปญ ไม่บังคับ · นอกแผน
--   C3        แก้ของที่อนุมัติแล้ว = อนุมัติเป็นโมฆะ · ขยายให้ครอบข้อความต่อช่องทางและภาพ
-- ============================================================================

-- ---------------------------------------------------------------------------
-- HOF เป็นแบรนด์ของเรา (B8, D6) แต่ยังไม่เคยมีสินค้า HOF เข้าแคตตาล็อก
-- ทำให้ตั้งงานคอนเทนต์ของ HOF ไม่ได้ · เพิ่มไว้ ไม่กระทบสินค้าเดิม
-- ---------------------------------------------------------------------------
insert into catalog.brands (name) values ('HOF') on conflict (name) do nothing;

-- ---------------------------------------------------------------------------
-- Pillar · หมวดประจำของแต่ละแบรนด์ (P4 · K6 ใช้ระบายสีการ์ด)
-- เลิกใช้ = active false ไม่ลบ (A7)
-- ---------------------------------------------------------------------------
create table content.pillars (
  id          uuid primary key default gen_random_uuid(),
  brand_id    uuid not null references catalog.brands(id),
  name        text not null check (trim(name) <> ''),
  color       text not null default '#a8a29e' check (color ~ '^#[0-9a-fA-F]{6}$'),
  sort_order  int  not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references core.app_users(id),
  unique (brand_id, name)
);
comment on table content.pillars is
  'หมวดประจำของแบรนด์ เช่น สินค้า · งานช่าง · ใช้กรองและระบายสีปฏิทิน · แยกต่อแบรนด์ (Q-110)';

-- ---------------------------------------------------------------------------
-- ธีม · มีวันเริ่มวันจบของตัวเอง คร่อมหลายเดือนได้ (P3)
-- ธีมกับแคมเปญเป็นคนละอัน: ธีมคือเรื่องที่เล่า แคมเปญคือโปร/งบ
-- ---------------------------------------------------------------------------
create table content.themes (
  id          uuid primary key default gen_random_uuid(),
  brand_id    uuid not null references catalog.brands(id),
  name        text not null check (trim(name) <> ''),
  goal        text,
  starts_on   date not null,
  ends_on     date not null,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references core.app_users(id),
  check (ends_on >= starts_on)
);
create index on content.themes (brand_id, starts_on);
comment on table content.themes is
  'เรื่องที่เล่าช่วงหนึ่ง · คร่อมเดือนได้ (P3) · ในธีมเดียวมีได้หลายแคมเปญ';

-- ---------------------------------------------------------------------------
-- ชิ้นงาน · ช่องใหม่
-- brand_id ยอมให้ว่างได้ในฐานข้อมูล เพราะงานคลิปเดิมไม่มีแบรนด์
-- แต่ทุกงานเฟส 1 ต้องมี · บังคับที่ trigger ด้านล่าง
-- ---------------------------------------------------------------------------
alter table content.items
  add column brand_id    uuid references catalog.brands(id),
  add column hook        text,
  add column key_message text,
  add column visual      text,
  add column pillar_id   uuid references content.pillars(id),
  add column theme_id    uuid references content.themes(id),
  add column off_plan    boolean not null default true,
  add column source_url  text;

create index on content.items (brand_id);
create index on content.items (pillar_id);
create index on content.items (theme_id);

comment on column content.items.hook is 'ประโยคหรือภาพที่ทำให้หยุดดู · ตั้งต้นของทุกช่องทาง (hook แยกต่อช่องทางอยู่ที่ placements)';
comment on column content.items.key_message is 'เนื้อหา · ข้อความหลักข้อเดียว';
comment on column content.items.visual is 'ภาพที่ต้องได้';
comment on column content.items.off_plan is
  'ไม่ได้มาจากแผนเดือน · ขึ้นป้าย "นอกแผน" (Q-118) · แผนเดือน (R6) จะสร้างงานด้วยค่า false';
comment on column content.items.source_url is 'ไอเดียมาจากไหน เช่น สรุปของเลขา AI หรือบันทึกประชุม (Q-36)';

-- สินค้าที่พูดถึง · ระดับรุ่น (Collection) ไม่ใช่ SKU
-- ตาราง item_products เดิมผูกระดับ SKU ซึ่งละเอียดเกินไปสำหรับคอนเทนต์
-- โพสต์ "Emu Sofa" ไม่ได้หมายถึงผ้าสีไหนขนาดไหน · ถามว่ารุ่นไหนไม่ได้พูดถึงนาน (H10) ต้องนับระดับรุ่น
create table content.item_models (
  item_id    uuid not null references content.items(id),
  product_id uuid not null references catalog.products(id),
  created_at timestamptz not null default now(),
  primary key (item_id, product_id)
);
comment on table content.item_models is
  'ชิ้นงานนี้พูดถึงรุ่นไหน · ไม่บังคับ (D2) · ถอดออกได้ เพราะเป็นป้ายกำกับ ไม่ใช่ข้อมูลธุรกิจ';

-- ---------------------------------------------------------------------------
-- ภาพ · แปะลิงก์ทีละภาพ เรียงลำดับได้ ภาพแรก = key visual (Q4 · Q-33)
-- เอาภาพออก = removed_at ไม่ลบแถว (A7) ตามรอยได้ว่าเคยมีภาพอะไร
-- ---------------------------------------------------------------------------
create table content.item_images (
  id          uuid primary key default gen_random_uuid(),
  item_id     uuid not null references content.items(id),
  position    int  not null default 0,
  url         text not null check (trim(url) <> ''),
  removed_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references core.app_users(id)
);
create index on content.item_images (item_id, position) where removed_at is null;
comment on table content.item_images is
  'ภาพของชิ้นงาน · ลิงก์ Drive/Figma (A5) · เรียงตาม position · ภาพแรก = key visual · IG รับสูงสุด 20';

-- ---------------------------------------------------------------------------
-- ข้อความแยกต่อช่องทาง · อยู่บน "ที่ลง" เพราะเป็น 1 แถวต่อ 1 ช่องทางอยู่แล้ว
-- FB/IG ใช้ copy_text · เว็บเป็นบทความบล็อก SEO ใช้ web_* + copy_text เป็นเนื้อบทความ
-- human_edited = คนแก้แล้ว · agent (R3) จะไม่เขียนทับ (C1.3 · Q-38)
-- skipped = ไม่ลงที่นี่แล้ว (R-18) · ไม่นับว่าขาด
-- ---------------------------------------------------------------------------
alter table content.placements
  add column hook           text,
  add column copy_text      text,
  add column first_comment  text,
  add column web_title      text,
  add column web_keyword    text,
  add column web_meta       text,
  add column human_edited   boolean not null default false,
  add column skipped_reason text;

comment on column content.placements.copy_text is
  'ข้อความที่จะโพสต์ของช่องทางนี้ · เว็บ = เนื้อบทความ · แต่ละช่องคิดแยกตามแพลตฟอร์ม (Q3)';
comment on column content.placements.skipped_reason is
  'ไม่ลงที่นี่แล้ว เพราะอะไร (R-18) · มีค่า = ไม่นับว่ายังขาด';

-- ---------------------------------------------------------------------------
-- กฎของชิ้นงาน · อยู่ในฐานข้อมูล ไม่ใช่แค่หน้าเว็บ
-- ---------------------------------------------------------------------------
create or replace function content.check_item_rules()
returns trigger
language plpgsql
set search_path = content, catalog, public
as $$
declare b uuid;
begin
  -- งานเฟส 1 ต้องมีแบรนด์ (Q-110)
  if new.format in ('ข้อความล้วน', 'ภาพเดี่ยว', 'อัลบั้มภาพ') and new.brand_id is null then
    raise exception 'ต้องเลือกแบรนด์ก่อน agent จะได้รู้ว่าต้องเขียนในน้ำเสียงของแบรนด์ไหน';
  end if;

  -- pillar กับธีมต้องเป็นของแบรนด์เดียวกับชิ้นงาน
  if new.pillar_id is not null then
    select brand_id into b from content.pillars where id = new.pillar_id;
    if b is distinct from new.brand_id then
      raise exception 'pillar นี้เป็นของแบรนด์อื่น';
    end if;
  end if;
  if new.theme_id is not null then
    select brand_id into b from content.themes where id = new.theme_id;
    if b is distinct from new.brand_id then
      raise exception 'ธีมนี้เป็นของแบรนด์อื่น';
    end if;
  end if;

  -- เปลี่ยนเป็นข้อความล้วนทั้งที่ยังตั้งใจลง IG อยู่ ไม่ได้
  if tg_op = 'UPDATE' and new.format = 'ข้อความล้วน' and new.format is distinct from old.format
     and exists (select 1 from content.placements
                  where item_id = new.id and channel_id = 'instagram' and skipped_reason is null) then
    raise exception 'ข้อความล้วนลง Instagram ไม่ได้ เพราะ IG ต้องมีภาพ · ถอด Instagram ออกก่อน';
  end if;
  return new;
end;
$$;

create trigger check_item_rules before insert or update on content.items
  for each row execute function content.check_item_rules();

-- ข้อความล้วนลง Instagram ไม่ได้ (Q-03)
create or replace function content.check_placement_rules()
returns trigger
language plpgsql
set search_path = content, public
as $$
declare f content.format;
begin
  select format into f from content.items where id = new.item_id;
  if new.channel_id = 'instagram' and f = 'ข้อความล้วน' and new.skipped_reason is null then
    raise exception 'ข้อความล้วนลง Instagram ไม่ได้ เพราะ IG ต้องมีภาพ';
  end if;
  return new;
end;
$$;

create trigger check_placement_rules before insert or update on content.placements
  for each row execute function content.check_placement_rules();

-- อัลบั้ม IG รับได้สูงสุด 20 ภาพ · ภาพเดี่ยวมีได้ภาพเดียว
create or replace function content.check_image_rules()
returns trigger
language plpgsql
set search_path = content, public
as $$
declare f content.format; n int;
begin
  if new.removed_at is not null then return new; end if;
  select format into f from content.items where id = new.item_id;
  select count(*) into n from content.item_images
   where item_id = new.item_id and removed_at is null and id <> new.id;
  if f = 'ข้อความล้วน' then
    raise exception 'ข้อความล้วนไม่มีภาพ · เปลี่ยนประเภทเป็นภาพเดี่ยวหรืออัลบั้มก่อน';
  elsif f = 'ภาพเดี่ยว' and n >= 1 then
    raise exception 'ภาพเดี่ยวมีได้ภาพเดียว · ถ้ามีหลายภาพให้เปลี่ยนเป็นอัลบั้ม';
  elsif n >= 20 then
    raise exception 'อัลบั้มมีได้สูงสุด 20 ภาพ ตามที่ Instagram รับ';
  end if;
  return new;
end;
$$;

create trigger check_image_rules before insert or update on content.item_images
  for each row execute function content.check_image_rules();

-- ---------------------------------------------------------------------------
-- ★ C3 · แก้ของที่อนุมัติแล้ว = อนุมัติเป็นโมฆะ
-- ของเดิมดูแค่ลิงก์ไฟล์วิดีโอกับบรีฟ · เฟส 1 ของที่ตรวจคือ brief ใหม่ ข้อความต่อช่องทาง และภาพ
-- ---------------------------------------------------------------------------
create or replace function content.void_approval_on_change()
returns trigger
language plpgsql
set search_path = content, core, public
as $$
begin
  if old.stage = 'พร้อมโพสต์'
     and new.stage = old.stage
     and (new.script_url  is distinct from old.script_url
       or new.edit_url    is distinct from old.edit_url
       or new.brief       is distinct from old.brief
       or new.title       is distinct from old.title
       or new.hook        is distinct from old.hook
       or new.key_message is distinct from old.key_message
       or new.visual      is distinct from old.visual)
  then
    new.stage       := 'รอตรวจ';
    new.approved_by := null;
    new.approved_at := null;
    new.review_note := 'ไฟล์หรือบรีฟถูกแก้หลังอนุมัติแล้ว — ต้องตรวจใหม่';
  end if;
  return new;
end;
$$;

-- ถอนอนุมัติของชิ้นงานจากการแก้ตารางลูก (ข้อความต่อช่องทาง · ภาพ)
create or replace function content.void_item_approval(p_item_id uuid, p_what text)
returns void
language plpgsql
set search_path = content, public
as $$
begin
  update content.items
     set stage = 'รอตรวจ', approved_by = null, approved_at = null,
         review_note = p_what || 'ถูกแก้หลังอนุมัติแล้ว — ต้องตรวจใหม่'
   where id = p_item_id and stage = 'พร้อมโพสต์';
end;
$$;

create or replace function content.void_on_copy_change()
returns trigger
language plpgsql
set search_path = content, public
as $$
begin
  if new.hook          is distinct from old.hook
     or new.copy_text  is distinct from old.copy_text
     or new.web_title  is distinct from old.web_title
     or new.web_keyword is distinct from old.web_keyword
     or new.web_meta   is distinct from old.web_meta then
    perform content.void_item_approval(new.item_id, 'ข้อความ ' || new.channel_id || ' ');
  end if;
  return new;
end;
$$;

create trigger void_on_copy_change after update on content.placements
  for each row execute function content.void_on_copy_change();

create or replace function content.void_on_image_change()
returns trigger
language plpgsql
set search_path = content, public
as $$
begin
  if tg_op = 'INSERT'
     or new.url is distinct from old.url
     or new.position is distinct from old.position
     or new.removed_at is distinct from old.removed_at then
    perform content.void_item_approval(new.item_id, 'ภาพ');
  end if;
  return new;
end;
$$;

create trigger void_on_image_change after insert or update on content.item_images
  for each row execute function content.void_on_image_change();

-- ---------------------------------------------------------------------------
-- ลงครบทุกที่ · ช่องทางที่ "ไม่ลงที่นี่แล้ว" ไม่นับว่าขาด (R-18)
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

  select count(*) into v_left from content.placements
   where item_id = pl.item_id and published_url is null and skipped_reason is null;
  if v_left = 0 then
    update content.items set stage = 'โพสต์แล้ว' where id = pl.item_id;
  end if;

  return pl;
end;
$$;

create or replace view content.v_placement_gaps with (security_invoker = true) as
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
join content.placements p       on p.item_id = i.id and p.skipped_reason is null
join marketing.channels ch      on ch.id = p.channel_id
where i.stage in ('พร้อมโพสต์', 'โพสต์แล้ว')
group by i.id, i.title, i.format, i.stage
having count(*) filter (where p.published_url is null) > 0;

-- ---------------------------------------------------------------------------
-- กฎเหล็ก · ห้ามลบ + updated_at เอง
-- item_models ถอดป้ายได้ (เป็นป้ายกำกับ ไม่ใช่ข้อมูลธุรกิจ) จึงไม่ใส่ห้ามลบ
-- ---------------------------------------------------------------------------
select core.apply_standard_rules('content.pillars');
select core.apply_standard_rules('content.themes');
select core.apply_standard_rules('content.item_images');

-- ---------------------------------------------------------------------------
-- RLS · คนทำงานคอนเทนต์ทุกคนเห็นและแก้ได้ · คนอนุมัติเห็นได้
-- ---------------------------------------------------------------------------
alter table content.pillars     enable row level security;
alter table content.themes      enable row level security;
alter table content.item_images enable row level security;
alter table content.item_models enable row level security;

do $$
declare t text;
begin
  foreach t in array array['pillars', 'themes', 'item_images', 'item_models'] loop
    execute format(
      'create policy %I on content.%I for select to authenticated using ('
      'core.has_capability(''marketing.write'') or core.has_capability(''design.write'') '
      'or core.has_capability(''content.approve''))', t || '_select', t);
    execute format(
      'create policy %I on content.%I for all to authenticated '
      'using (core.has_capability(''marketing.write'') or core.has_capability(''design.write'')) '
      'with check (core.has_capability(''marketing.write'') or core.has_capability(''design.write''))',
      t || '_write', t);
  end loop;
end $$;

grant select, insert, update on content.pillars, content.themes, content.item_images to authenticated;
grant select, insert, update, delete on content.item_models to authenticated;

revoke all on function content.check_item_rules()                from public, anon, authenticated;
revoke all on function content.check_placement_rules()           from public, anon, authenticated;
revoke all on function content.check_image_rules()               from public, anon, authenticated;
-- void_item_approval ถูกเรียกจาก trigger ในสิทธิ์ของคนที่แก้ จึงต้องให้ authenticated เรียกได้
-- เรียกตรงๆ ก็ทำได้แค่ถอนอนุมัติ ซึ่งไม่ได้ข้ามด่านอะไร
revoke all on function content.void_item_approval(uuid, text)    from public, anon;
grant execute on function content.void_item_approval(uuid, text) to authenticated;
revoke all on function content.void_on_copy_change()             from public, anon, authenticated;
revoke all on function content.void_on_image_change()            from public, anon, authenticated;
revoke all on function content.mark_posted(uuid, text)           from public, anon;
grant execute on function content.mark_posted(uuid, text)        to authenticated;

comment on table content.items is
  'ชิ้นงาน 1 ชิ้น · เฟส 1 = ข้อความล้วน ภาพเดี่ยว อัลบั้มภาพ · ลงได้หลายช่องทาง ดูที่ content.placements';

update core.modules
   set description_th = 'ข้อความ ภาพ อัลบั้ม · Facebook Instagram บล็อก SEO · ต้องอนุมัติก่อนโพสต์'
 where id = 'content';
