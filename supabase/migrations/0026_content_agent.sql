-- ============================================================================
-- 0026 · โมดูลคอนเทนต์ เฟส 1 · รอบ R3 Content agent
-- ============================================================================
-- ที่มา: docs/modules/content/2-requirements.md หมวด ก2 · ก3 · ก4 · ง · จ2
--
--   Q-05–09b  agent ตัวเดียวเขียนทุกช่องทาง · ร่างเสร็จส่งถึง Bay ตรวจเลย
--   Q-37–39   คิดแยกตามแพลตฟอร์ม · ไม่เขียนทับช่องที่คนแก้ · บันทึกทุกครั้งที่ AI ทำ
--   Q-100–109 brand model · brand book · สมุดความคิด Bay (ยืนยันก่อนใช้) · คู่มือแพลตฟอร์ม · สัมภาษณ์
--   Q-113–120 ไอเดียด่วน
--   Q-49f     @AI ในแชท
--   งบ AI เดือนละ 300 บาท (Bay 2026-09-23) · ตั้งเพดานในระบบ เกินแล้ว agent หยุดเอง
--
-- "Bay" ในฐานข้อมูลคือคนที่มีสิทธิ์ admin · ไม่ผูกกับชื่อคน
-- ค่าใช้จ่ายไม่เก็บเป็นตัวเลขสำเร็จ (A10) · เก็บ token กับราคาต่อหน่วย ณ ตอนเรียก แล้วคำนวณในวิว
-- ============================================================================

-- ---------------------------------------------------------------------------
-- ตั้งค่า AI · แถวเดียว · Bay แก้ได้คนเดียว
-- ---------------------------------------------------------------------------
create table content.ai_settings (
  id                 int primary key default 1 check (id = 1),
  model              text    not null default 'claude-opus-5',
  monthly_budget_thb numeric not null default 300 check (monthly_budget_thb >= 0),
  thb_per_usd        numeric not null default 35  check (thb_per_usd > 0),
  paused             boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  updated_by         uuid references core.app_users(id)
);
insert into content.ai_settings (id) values (1);

comment on table content.ai_settings is 'ตั้งค่า agent · รุ่นโมเดล · งบต่อเดือน (บาท) · อัตราแลกเปลี่ยนที่ใช้คิดงบ';
comment on column content.ai_settings.thb_per_usd is 'ตั้งสูงกว่าอัตราจริงเล็กน้อย เพื่อให้งบที่ระบบคิดไม่ต่ำกว่าที่จ่ายจริง';

-- ---------------------------------------------------------------------------
-- ★ บันทึกทุกครั้งที่เรียก AI (กฎ AI 3 · Q-39) · เพิ่มได้อย่างเดียว ไม่แก้ ไม่ลบ
-- ---------------------------------------------------------------------------
create table content.ai_requests (
  id                 uuid primary key default gen_random_uuid(),
  requested_by       uuid not null references core.app_users(id) default auth.uid(),
  kind               text not null check (kind in ('เขียนข้อความ', 'ไอเดียด่วน', 'สัมภาษณ์', 'แชท @AI')),
  item_id            uuid references content.items(id),
  brand_id           uuid references catalog.brands(id),
  model              text not null,
  status             text not null check (status in ('สำเร็จ', 'ถามก่อน', 'ล้มเหลว', 'ถูกปฏิเสธ')),
  instruction        text,
  used_refs          jsonb not null default '{}',
  output             jsonb,
  error              text,
  input_tokens       int not null default 0 check (input_tokens >= 0),
  output_tokens      int not null default 0 check (output_tokens >= 0),
  usd_per_mtok_in    numeric not null check (usd_per_mtok_in >= 0),
  usd_per_mtok_out   numeric not null check (usd_per_mtok_out >= 0),
  thb_per_usd        numeric not null check (thb_per_usd > 0),
  created_at         timestamptz not null default now()
);
create index on content.ai_requests (created_at);
create index on content.ai_requests (item_id);

comment on table content.ai_requests is
  'ทุกครั้งที่ agent ทำงาน: ใครขอ · ใช้ข้อมูลอะไร (used_refs) · ได้อะไร (output) · token และราคาต่อหน่วย ณ ตอนนั้น';

create trigger no_delete_content_ai_requests before delete on content.ai_requests
  for each row execute function core.prevent_delete();

-- ค่าใช้จ่ายต่อครั้ง (บาท) · คำนวณ ไม่เก็บ (A10)
create view content.v_ai_requests with (security_invoker = true) as
select r.*,
       round((r.input_tokens * r.usd_per_mtok_in + r.output_tokens * r.usd_per_mtok_out)
             / 1e6 * r.thb_per_usd, 4) as cost_thb
  from content.ai_requests r;

-- ใช้ไปเดือนนี้ (เวลาไทย) เทียบงบ
create view content.v_ai_budget with (security_invoker = true) as
select s.model, s.monthly_budget_thb, s.thb_per_usd, s.paused,
       coalesce(sum(v.cost_thb), 0)                             as spent_thb,
       s.monthly_budget_thb - coalesce(sum(v.cost_thb), 0)     as remaining_thb,
       count(v.id)                                              as requests
  from content.ai_settings s
  left join content.v_ai_requests v
    on date_trunc('month', v.created_at at time zone 'Asia/Bangkok')
     = date_trunc('month', now() at time zone 'Asia/Bangkok')
 group by s.model, s.monthly_budget_thb, s.thb_per_usd, s.paused;

-- ---------------------------------------------------------------------------
-- ★ Brand model + Brand book · แยกต่อแบรนด์ · หัวข้อเพิ่ม/เลิกใช้ได้ (Q-100 Q-108 Q-109 Q-110)
-- ---------------------------------------------------------------------------
create table content.brand_sections (
  id          uuid primary key default gen_random_uuid(),
  brand_id    uuid not null references catalog.brands(id),
  kind        text not null check (kind in ('model', 'book')),
  topic       text not null,
  guide       text,
  body        text,
  sort_order  int  not null default 0,
  active      boolean not null default true,
  confirmed_at timestamptz,
  confirmed_by uuid references core.app_users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references core.app_users(id),
  unique (brand_id, kind, topic)
);
comment on table content.brand_sections is
  'brand model (แบรนด์คือใคร) และ brand book (แสดงออกยังไง) · หนึ่งแถว = หนึ่งหัวข้อ · agent อ่านเฉพาะหัวข้อที่ Bay ยืนยันแล้ว';
comment on column content.brand_sections.guide is 'หัวข้อนี้ถามเรื่องอะไร · ใช้ตอนสัมภาษณ์';

-- บทสัมภาษณ์ · เก็บไว้ต่อทีหลังได้ (Q-107)
create table content.interview_turns (
  id          uuid primary key default gen_random_uuid(),
  section_id  uuid not null references content.brand_sections(id),
  role        text not null check (role in ('AI', 'Bay')),
  body        text not null,
  choices     text[] not null default '{}',
  request_id  uuid references content.ai_requests(id),
  created_by  uuid references core.app_users(id) default auth.uid(),
  created_at  timestamptz not null default now()
);
create index on content.interview_turns (section_id, created_at);
create trigger no_delete_content_interview_turns before delete on content.interview_turns
  for each row execute function core.prevent_delete();

-- ---------------------------------------------------------------------------
-- ★ สมุดความคิด Bay (Q-102–105 Q-111) · agent เสนอ Bay ยืนยัน · ไม่มีความจำลับ
-- ---------------------------------------------------------------------------
create table content.notebook (
  id           uuid primary key default gen_random_uuid(),
  brand_id     uuid references catalog.brands(id),
  body         text not null check (length(trim(body)) > 0),
  source       text not null check (source in ('Bay เขียน', 'agent เสนอ')),
  status       text not null default 'รอยืนยัน' check (status in ('รอยืนยัน', 'ใช้อยู่', 'เลิกใช้')),
  reason       text,
  from_item_id uuid references content.items(id),
  request_id   uuid references content.ai_requests(id),
  confirmed_at timestamptz,
  confirmed_by uuid references core.app_users(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  updated_by   uuid references core.app_users(id)
);
comment on column content.notebook.brand_id is 'ว่าง = ใช้ทุกแบรนด์ (Q-111)';
comment on column content.notebook.reason is 'agent เสนอเพราะอะไร เช่น มาจากคำตอบ มาจากเหตุผลตีกลับ มาจากที่คนแก้';

-- ---------------------------------------------------------------------------
-- ★ คู่มือแพลตฟอร์ม · ต่อแบรนด์ ต่อช่องทาง (Q-37 Q-110)
-- ---------------------------------------------------------------------------
create table content.playbooks (
  id          uuid primary key default gen_random_uuid(),
  brand_id    uuid not null references catalog.brands(id),
  channel_id  text not null references marketing.channels(id),
  body        text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references core.app_users(id),
  unique (brand_id, channel_id)
);

-- ---------------------------------------------------------------------------
-- ★ คำถามของ agent ก่อนเขียน (Q-101 Q-119) · ตอบด้วยการแตะหรือพิมพ์
-- ---------------------------------------------------------------------------
create table content.agent_questions (
  id           uuid primary key default gen_random_uuid(),
  item_id      uuid not null references content.items(id),
  request_id   uuid references content.ai_requests(id),
  question     text not null,
  choices      text[] not null default '{}',
  answer       text,
  answered_at  timestamptz,
  answered_by  uuid references core.app_users(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  updated_by   uuid references core.app_users(id)
);
create index on content.agent_questions (item_id) where answered_at is null;

-- ---------------------------------------------------------------------------
-- ร่องรอยของ AI ต่อช่องทาง (Q-38 Q-103 Q-106)
-- ai_copy_text = ร่างล่าสุดของ AI · เทียบกับ copy_text เพื่อเรียนว่าคนแก้อะไร
-- ---------------------------------------------------------------------------
alter table content.placements
  add column ai_request_id uuid references content.ai_requests(id),
  add column ai_copy_text  text;

comment on column content.placements.ai_request_id is 'ร่างนี้มาจาก AI ครั้งไหน · ตามรอยได้ว่าใช้ข้อไหน (Q-106)';
comment on column content.placements.ai_copy_text is 'ข้อความที่ AI ร่างครั้งล่าสุด · คนแก้ทับแล้ว agent ใช้เทียบเพื่อเรียน (Q-103)';

-- ---------------------------------------------------------------------------
-- ข้อความจาก agent ในแชท · ผ่านฟังก์ชันเท่านั้น
-- ---------------------------------------------------------------------------
create or replace function content.post_ai_message(p_item_id uuid, p_body text, p_part text default null)
returns void
language plpgsql
security definer
set search_path = core, content, public
as $$
begin
  if not (core.has_capability('marketing.write') or core.has_capability('design.write')
          or core.has_capability('content.approve')) then
    raise exception 'ไม่มีสิทธิ์' using errcode = 'insufficient_privilege';
  end if;
  insert into content.messages (item_id, kind, body, part_label) values (p_item_id, 'AI', p_body, p_part);
end;
$$;

-- ---------------------------------------------------------------------------
-- ตอบคำถาม agent · Bay หรือคนที่อนุมัติคอนเทนต์ได้ (Q-93)
-- ---------------------------------------------------------------------------
create or replace function content.answer_question(p_id uuid, p_answer text)
returns void
language plpgsql
security definer
set search_path = core, content, public
as $$
declare q content.agent_questions;
begin
  if not (core.has_capability('admin') or core.has_capability('content.approve')) then
    raise exception 'ตอบคำถาม agent ได้เฉพาะ Bay หรือคนที่อนุมัติคอนเทนต์ได้'
      using errcode = 'insufficient_privilege';
  end if;
  if coalesce(trim(p_answer), '') = '' then raise exception 'ใส่คำตอบก่อน'; end if;
  update content.agent_questions
     set answer = trim(p_answer), answered_at = now(), answered_by = auth.uid()
   where id = p_id
  returning * into q;
  if not found then raise exception 'ไม่พบคำถาม'; end if;
  perform content.post_system_message(q.item_id, 'ตอบ agent: ' || q.question || ' → ' || q.answer);
end;
$$;

-- ---------------------------------------------------------------------------
-- สมุด · agent เสนอได้แค่ "รอยืนยัน" · ยืนยัน/แก้/เลิกใช้ = Bay (Q-104)
-- ---------------------------------------------------------------------------
create or replace function content.check_notebook_rules()
returns trigger
language plpgsql
set search_path = core, content, public
as $$
begin
  if core.has_capability('admin') then
    if new.status = 'ใช้อยู่' and (tg_op = 'INSERT' or old.status is distinct from 'ใช้อยู่') then
      new.confirmed_at := now(); new.confirmed_by := auth.uid();
    end if;
    return new;
  end if;
  if tg_op = 'INSERT' and new.status = 'รอยืนยัน' and new.source = 'agent เสนอ' then
    return new;
  end if;
  raise exception 'สมุดความคิดแก้หรือยืนยันได้เฉพาะ Bay · agent เสนอได้อย่างเดียว'
    using errcode = 'insufficient_privilege';
end;
$$;
create trigger check_notebook_rules before insert or update on content.notebook
  for each row execute function content.check_notebook_rules();

-- brand model / book · ยืนยันเมื่อ Bay บันทึกเนื้อหา
create or replace function content.stamp_section_confirm()
returns trigger
language plpgsql
set search_path = content, public
as $$
begin
  if new.body is distinct from old.body then
    if coalesce(trim(new.body), '') = '' then
      new.confirmed_at := null; new.confirmed_by := null;
    else
      new.confirmed_at := now(); new.confirmed_by := auth.uid();
    end if;
  end if;
  return new;
end;
$$;
create trigger stamp_section_confirm before update on content.brand_sections
  for each row execute function content.stamp_section_confirm();

-- ---------------------------------------------------------------------------
-- หัวข้อตั้งต้นของแบรนด์ + คู่มือแพลตฟอร์มตั้งต้น · แบรนด์ใหม่กดสร้างได้จากหน้าสมอง agent
-- ---------------------------------------------------------------------------
create or replace function content.seed_brand_brain(p_brand_id uuid)
returns void
language plpgsql
security definer
set search_path = core, content, public
as $$
begin
  if auth.uid() is not null and not core.has_capability('admin') then
    raise exception 'ตั้งสมองของแบรนด์ได้เฉพาะ Bay' using errcode = 'insufficient_privilege';
  end if;

  insert into content.brand_sections (brand_id, kind, topic, guide, sort_order)
  select p_brand_id, v.kind, v.topic, v.guide, v.ord
    from (values
      ('model', 'Purpose',        'แบรนด์นี้มีอยู่เพื่ออะไร ถ้าวันหนึ่งแบรนด์หายไป ลูกค้าจะเสียอะไร', 1),
      ('model', 'Vision',         'อีก 5-10 ปีอยากเห็นแบรนด์อยู่ตรงไหน', 2),
      ('model', 'Mission',        'ทุกวันแบรนด์ทำอะไรเพื่อไปถึง vision', 3),
      ('model', 'Values',         'ความเชื่อ 3-5 ข้อที่แบรนด์ไม่ยอมทิ้ง', 4),
      ('model', 'ลูกค้าเป้าหมาย',   'ใคร อายุ ไลฟ์สไตล์ บ้านแบบไหน ซื้อเพราะอะไร กังวลอะไร', 5),
      ('model', 'Positioning',    'ต่างจากคู่แข่งยังไง คู่แข่งหลักคือใคร', 6),
      ('model', 'Personality',    'ถ้าแบรนด์เป็นคน จะเป็นคนแบบไหน', 7),
      ('model', 'Brand promise',  'สัญญาอะไรกับลูกค้าทุกครั้ง', 8),
      ('model', 'น้ำเสียง',          'พูดกับลูกค้ายังไง ทางการแค่ไหน ใช้ครับ/ค่ะ หรือไม่ ใช้ emoji ไหม', 9),
      ('book',  'คำที่ใช้',          'คำหรือวลีที่อยากให้ใช้บ่อย', 1),
      ('book',  'คำที่ไม่ใช้',        'คำที่ห้ามใช้ หรือไม่ชอบ', 2),
      ('book',  'สไตล์ภาพ',         'ภาพแบบไหนใช่ แสง มุม ฉาก สี', 3),
      ('book',  'ตัวอย่างที่ใช่',     'โพสต์ของเราหรือของคนอื่นที่ "ใช่" และเพราะอะไร', 4),
      ('book',  'ตัวอย่างที่ไม่ใช่',   'โพสต์ที่ "ไม่ใช่" และเพราะอะไร', 5)
    ) as v(kind, topic, guide, ord)
  on conflict (brand_id, kind, topic) do nothing;

  insert into content.playbooks (brand_id, channel_id, body) values
  (p_brand_id, 'facebook',
$fb$- เปิดด้วย hook บรรทัดแรก คนเห็นแค่ 2-3 บรรทัดก่อนกด "ดูเพิ่มเติม"
- เล่าเรื่องได้ยาวกว่า IG · ย่อหน้าสั้น 1-3 บรรทัด เว้นบรรทัดให้อ่านง่ายบนมือถือ
- ใส่รายละเอียดสินค้าที่มีในระบบเท่านั้น (ขนาด วัสดุ ราคา) · ไม่มีข้อมูลห้ามแต่ง
- ปิดด้วยสิ่งที่อยากให้คนทำต่อ 1 อย่าง เช่น ทักแชท หรือแวะโชว์รูม
- hashtag 0-3 อัน ไม่จำเป็น
- ลิงก์ใส่ในคอมเมนต์แรกได้ (first_comment) ถ้ามี$fb$),
  (p_brand_id, 'instagram',
$ig$- ภาพเป็นพระเอก ข้อความสั้นกว่า Facebook · บรรทัดแรกต้องหยุดนิ้วได้ (ไม่เกิน ~125 ตัวอักษรก่อนถูกตัด)
- เนื้อหา 3-6 บรรทัด เน้นความรู้สึก บรรยากาศ การใช้ชีวิตกับเฟอร์นิเจอร์
- ลิงก์ในแคปชันกดไม่ได้ · ชวนไปที่ลิงก์ใน bio หรือทัก DM
- hashtag 5-10 อัน ท้ายแคปชัน ผสมไทย/อังกฤษ เฉพาะที่เกี่ยวจริง
- รวมทั้งหมดไม่เกิน 2,200 ตัวอักษร$ig$),
  (p_brand_id, 'website',
$web$- บทความบล็อกเพื่อ SEO · คนอ่านมาจาก Google ค้นหาคำถามหรือปัญหา
- เลือก keyword หลัก 1 คำ ที่คนค้นจริง (เช่น "โซฟาสไตล์ mid century") ใส่ใน title ย่อหน้าแรก และหัวข้อย่อยอย่างน้อย 1 ที่
- web_title ไม่เกิน 60 ตัวอักษร · web_meta ไม่เกิน 155 ตัวอักษร สรุปว่าอ่านแล้วได้อะไร
- เนื้อหา 600-1,000 คำ · ใช้หัวข้อย่อย (## ) · ตอบคำถามคนอ่านก่อนขายของ
- อ้างสเปกสินค้าจากระบบเท่านั้น · ปิดท้ายด้วยสินค้าที่เกี่ยวและชวนติดต่อ
- เขียนเป็น Markdown$web$)
  on conflict (brand_id, channel_id) do nothing;
end;
$$;

select content.seed_brand_brain(b.id) from catalog.brands b;

-- ---------------------------------------------------------------------------
-- กฎเหล็ก + RLS
-- ---------------------------------------------------------------------------
select core.apply_standard_rules('content.ai_settings');
select core.apply_standard_rules('content.brand_sections');
select core.apply_standard_rules('content.notebook');
select core.apply_standard_rules('content.playbooks');
select core.apply_standard_rules('content.agent_questions');

alter table content.ai_settings     enable row level security;
alter table content.ai_requests     enable row level security;
alter table content.brand_sections  enable row level security;
alter table content.interview_turns enable row level security;
alter table content.notebook        enable row level security;
alter table content.playbooks       enable row level security;
alter table content.agent_questions enable row level security;

do $$
declare t text;
begin
  -- ทีมคอนเทนต์อ่านได้ทุกอย่าง · agent อ่านสิ่งเดียวกับคน (กฎ AI 5)
  foreach t in array array['ai_settings', 'ai_requests', 'brand_sections', 'interview_turns',
                           'notebook', 'playbooks', 'agent_questions'] loop
    execute format(
      'create policy %I on content.%I for select to authenticated using ('
      'core.has_capability(''marketing.write'') or core.has_capability(''design.write'') '
      'or core.has_capability(''content.approve'') or core.has_capability(''admin''))', t || '_select', t);
  end loop;
  -- สมองของ agent + ตั้งค่า = Bay เท่านั้น (Q-93)
  foreach t in array array['ai_settings', 'brand_sections', 'playbooks'] loop
    execute format(
      'create policy %I on content.%I for all to authenticated '
      'using (core.has_capability(''admin'')) with check (core.has_capability(''admin''))', t || '_write', t);
  end loop;
end $$;

-- บันทึก AI · เขียนในชื่อตัวเองเท่านั้น
create policy ai_requests_insert on content.ai_requests for insert to authenticated
  with check (requested_by = auth.uid()
    and (core.has_capability('marketing.write') or core.has_capability('design.write')
         or core.has_capability('content.approve') or core.has_capability('admin')));
-- สัมภาษณ์ = Bay
create policy interview_turns_insert on content.interview_turns for insert to authenticated
  with check (core.has_capability('admin'));
-- สมุด · กฎละเอียดอยู่ใน check_notebook_rules
create policy notebook_write on content.notebook for all to authenticated
  using (core.has_capability('admin'))
  with check (core.has_capability('admin')
    or (status = 'รอยืนยัน' and (core.has_capability('marketing.write') or core.has_capability('design.write')
                                 or core.has_capability('content.approve'))));
-- คำถามของ agent · สร้างได้โดยทีม (ตอนสั่ง agent) · ตอบผ่าน answer_question
create policy agent_questions_insert on content.agent_questions for insert to authenticated
  with check (answered_at is null
    and (core.has_capability('marketing.write') or core.has_capability('design.write')
         or core.has_capability('content.approve') or core.has_capability('admin')));

grant select, update on content.ai_settings to authenticated;
grant select, insert on content.ai_requests, content.interview_turns to authenticated;
grant select, insert, update on content.brand_sections, content.notebook, content.playbooks to authenticated;
grant select, insert on content.agent_questions to authenticated;
grant select on content.v_ai_requests, content.v_ai_budget to authenticated;

revoke all on function content.post_ai_message(uuid, text, text)   from public, anon;
grant execute on function content.post_ai_message(uuid, text, text) to authenticated;
revoke all on function content.answer_question(uuid, text)          from public, anon;
grant execute on function content.answer_question(uuid, text)       to authenticated;
revoke all on function content.seed_brand_brain(uuid)               from public, anon;
grant execute on function content.seed_brand_brain(uuid)            to authenticated;
revoke all on function content.check_notebook_rules()               from public, anon, authenticated;
revoke all on function content.stamp_section_confirm()              from public, anon, authenticated;
