-- ============================================================================
-- 0049 · ข่าว Chaw Cher / ASE (หน้า /news)
-- ============================================================================
-- ที่มา: docs/modules/news/0-idea.md · Bay สั่ง 2026-11-11
--   1. ทุกเช้า 08:00 ไปเช็กข่าว Chaw Cher + ASE · ข่าวซ้ำไม่เอา
--   2. ทำเป็นร่างโพสต์ chawcher.com + ข้อความสั้นพร้อมภาพสำหรับ LINE
--   3. หน้าสรุปให้ Bay กด preview → ok กด publish หรือส่ง LINE
--
-- กฎที่ไฟล์นี้บังคับในฐานข้อมูล
--   กันซ้ำ   : ลิงก์ต้นทาง (ตัด http/www/? ท้าย) ซ้ำไม่ได้ · ข่าวที่ "ไม่ใช้" ก็ยังกันซ้ำ (ไม่เด้งกลับมาอีก)
--   ห้ามลบ  : A7 (apply_standard_rules) · ไม่เอา = เปลี่ยนเป็น "ไม่ใช้"
--   ของออกนอก : publish / ส่ง LINE ต้องมีคนกด (reviewed_by) · บอทตั้งเวลาทำได้แค่ "ร่าง"
--   สิทธิ์   : Bay (admin) เท่านั้น · ตัวตั้งเวลาเขียนผ่านฟังก์ชัน 2 ตัวด้วย service_role
-- ============================================================================

create table content.news_items (
  id            uuid primary key default gen_random_uuid(),
  brand         text not null check (brand in ('Chaw Cher', 'ASE')),
  source        text not null check (source in ('ค้นอัตโนมัติ', 'Bay ส่งเอง')),
  source_url    text,                                  -- ลิงก์ข่าวต้นทาง (ค้นอัตโนมัติ)
  source_key    text generated always as (
                  nullif(regexp_replace(regexp_replace(lower(btrim(source_url)), '^https?://(www\.|m\.)?', ''),
                                        '[/?#]+$', ''), '')) stored,
  source_title  text,
  source_date   date,
  note          text,                                  -- ข้อความที่ Bay พิมพ์มา / สรุปต้นทาง
  post_title    text not null check (btrim(post_title) <> ''),
  post_body     text not null default '',              -- ย่อหน้าคั่นด้วยบรรทัดว่าง
  line_text     text not null default '',
  images        jsonb not null default '[]'::jsonb,    -- [{url, preview, wp_id, alt}] · รูปแรก = รูปหลัก / รูปที่ส่ง LINE
  status        text not null default 'ร่าง' check (status in ('ร่าง', 'เผยแพร่แล้ว', 'ไม่ใช้')),
  wp_post_id    int unique,
  wp_link       text,
  published_at  timestamptz,
  line_sent_at  timestamptz,
  line_sent_to  jsonb not null default '[]'::jsonb,    -- [{room_id, name, at}]
  reviewed_by   uuid references core.app_users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  updated_by    uuid references core.app_users(id),

  constraint news_auto_has_url check (source <> 'ค้นอัตโนมัติ' or source_key is not null),
  constraint news_published_has_reviewer check (status <> 'เผยแพร่แล้ว' or (reviewed_by is not null and wp_post_id is not null)),
  constraint news_line_has_reviewer check (line_sent_at is null or reviewed_by is not null),
  constraint news_images_array check (jsonb_typeof(images) = 'array' and jsonb_array_length(images) <= 10)
);
create unique index news_items_source_key_uq on content.news_items (source_key) where source_key is not null;
create index news_items_status_idx on content.news_items (status, created_at desc);

comment on table content.news_items is
  'ข่าว Chaw Cher / ASE · ระบบตั้งเวลาร่างได้อย่างเดียว · ขึ้นเว็บ/ส่ง LINE ต้องมีคนกด (reviewed_by) · source_key กันข่าวซ้ำ';

create table content.news_runs (
  id                   uuid primary key default gen_random_uuid(),
  run_by               text not null check (run_by in ('ตั้งเวลา', 'กดเอง')),
  found                int not null default 0,
  created              int not null default 0,
  skipped_dupes        int not null default 0,
  model                text,
  input_tokens         int,
  output_tokens        int,
  web_searches         int,
  usd_per_mtok_in      numeric(8,3),
  usd_per_mtok_out     numeric(8,3),
  usd_per_search       numeric(8,4),
  thb_per_usd          numeric(8,2),
  error                text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  updated_by           uuid references core.app_users(id)
);

select core.apply_standard_rules('content.news_items');
select core.apply_standard_rules('content.news_runs');
create trigger audit_content_news_items after insert or update on content.news_items
  for each row execute function core.write_audit();

alter table content.news_items enable row level security;
alter table content.news_runs enable row level security;
create policy news_admin on content.news_items for all to authenticated
  using (core.has_capability('admin')) with check (core.has_capability('admin'));
create policy news_runs_read on content.news_runs for select to authenticated
  using (core.has_capability('admin'));
grant select, insert, update on content.news_items to authenticated;
grant select on content.news_runs to authenticated;

-- ---------------------------------------------------------------------------
-- ตัวตั้งเวลา (ไม่มีคนล็อกอิน · service_role) ใช้ได้แค่ 2 ฟังก์ชันนี้
-- ---------------------------------------------------------------------------

-- สิ่งที่ AI ต้องรู้ก่อนค้น: ข่าวที่มีแล้ว 90 วัน (กันซ้ำ) + ค่าใช้จ่ายเดือนนี้
create or replace function content.news_run_input()
returns jsonb
language sql stable security definer
set search_path = content, line_agent, public
as $$
  select jsonb_build_object(
    'seen', coalesce((select jsonb_agg(jsonb_build_object('url', coalesce(n.source_url, n.wp_link), 'title', coalesce(n.source_title, n.post_title)))
                      from (select * from content.news_items
                             where created_at > now() - interval '90 days'
                             order by created_at desc limit 200) n), '[]'::jsonb),
    'spent_thb_month', coalesce((select sum(((r.input_tokens * r.usd_per_mtok_in + r.output_tokens * r.usd_per_mtok_out) / 1e6
                                            + coalesce(r.web_searches, 0) * r.usd_per_search) * r.thb_per_usd)
                                 from content.news_runs r
                                 where (r.created_at at time zone 'Asia/Bangkok') >= date_trunc('month', now() at time zone 'Asia/Bangkok')), 0),
    'thb_per_usd', coalesce((select thb_per_usd from line_agent.settings limit 1), 36),
    'ran_today', exists (select 1 from content.news_runs r
                          where r.run_by = 'ตั้งเวลา' and r.error is null
                            and (r.created_at at time zone 'Asia/Bangkok')::date = (now() at time zone 'Asia/Bangkok')::date))
$$;

-- บันทึกผลรอบ · ข่าวซ้ำ (ลิงก์เดิม) ข้ามเงียบๆ · คืนจำนวนที่สร้างจริง
create or replace function content.news_run_save(p jsonb)
returns int
language plpgsql security definer
set search_path = content, public
as $$
declare it jsonb; n int := 0; dup int := 0; rid uuid;
begin
  for it in select * from jsonb_array_elements(coalesce(p->'items', '[]'::jsonb)) loop
    insert into content.news_items (brand, source, source_url, source_title, source_date, note, post_title, post_body, line_text, images)
    values (it->>'brand', 'ค้นอัตโนมัติ', it->>'source_url', left(it->>'source_title', 300),
            nullif(it->>'source_date', '')::date, left(it->>'summary', 2000),
            left(it->>'post_title', 200), left(coalesce(it->>'post_body', ''), 8000), left(coalesce(it->>'line_text', ''), 1000),
            coalesce(it->'images', '[]'::jsonb))
    on conflict (source_key) where source_key is not null do nothing;
    if found then n := n + 1; else dup := dup + 1; end if;
  end loop;
  insert into content.news_runs (run_by, found, created, skipped_dupes, model, input_tokens, output_tokens, web_searches,
                                 usd_per_mtok_in, usd_per_mtok_out, usd_per_search, thb_per_usd, error)
  values (coalesce(p->>'run_by', 'ตั้งเวลา'), jsonb_array_length(coalesce(p->'items', '[]'::jsonb)), n, dup, p->>'model',
          (p->>'input_tokens')::int, (p->>'output_tokens')::int, (p->>'web_searches')::int,
          (p->>'usd_per_mtok_in')::numeric, (p->>'usd_per_mtok_out')::numeric, (p->>'usd_per_search')::numeric,
          (p->>'thb_per_usd')::numeric, nullif(p->>'error', ''))
  returning id into rid;
  return n;
end;
$$;

revoke all on function content.news_run_input(), content.news_run_save(jsonb) from public, anon, authenticated;
grant execute on function content.news_run_input(), content.news_run_save(jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- ข่าวแรก (ทำมือ 2026-11-11 · WordPress draft 18153) · ให้หน้า /news มีของให้ลองกด
-- ---------------------------------------------------------------------------
insert into content.news_items (brand, source, note, post_title, post_body, line_text, images, wp_post_id, wp_link)
values ('Chaw Cher', 'Bay ส่งเอง',
  'ทีมงานของเราได้พบกับ คุณกรกช ที่ dior gold house เพื่อคุยกันเกี่ยวกับ collaboration',
  'Chaw Cher เยือน Dior Gold House · พูดคุยแนวทาง Collaboration กับคุณกรกช',
  E'เมื่อวันที่ 11 พฤศจิกายน 2569 ทีมงาน Chaw Cher (ฌ เฌอ) ได้เข้าพบคุณกรกช ที่ Dior Gold House กรุงเทพฯ เพื่อพูดคุยแลกเปลี่ยนแนวทางความร่วมมือ (collaboration) ระหว่างกัน\n\nบรรยากาศภายใน Café Dior ห้อมล้อมด้วยผนังงานจักสานขนาดใหญ่เป็นลวดลายต้นไม้ ดอกไม้ และนก งานฝีมือที่สะท้อนความละเอียดของช่างไทย ซึ่งเป็นคุณค่าเดียวกับที่ Chaw Cher ให้ความสำคัญมาตลอด ตั้งแต่การเลือกวัสดุ งานเย็บ ไปจนถึงการทำเฟอร์นิเจอร์ให้ใช้ได้ยาวนาน\n\nการพูดคุยครั้งนี้เป็นจุดเริ่มต้นของการแลกเปลี่ยนมุมมองด้านงานคราฟต์และการออกแบบ ขอขอบคุณคุณกรกชที่ให้การต้อนรับอย่างอบอุ่น แล้วติดตามความคืบหน้าจาก Chaw Cher ได้ที่นี่ครับ',
  E'✨ Chaw Cher News\nทีม Chaw Cher เข้าพบคุณกรกช ที่ Dior Gold House\nคุยแนวทาง collaboration ด้านงานคราฟต์และการออกแบบ\nท่ามกลางผนังงานจักสานฝีมือช่างไทยใน Café Dior 🌿',
  '[{"url":"https://chawcher.com/wp-content/uploads/2026/11/chawcher-dior-gold-house-team-2026-11-11.jpg","preview":"https://chawcher.com/wp-content/uploads/2026/11/chawcher-dior-gold-house-team-2026-11-11-768x1024.jpg","wp_id":18151,"alt":"ทีม Chaw Cher และคุณกรกช หน้าผนังงานจักสาน Café Dior"},
    {"url":"https://chawcher.com/wp-content/uploads/2026/11/chawcher-dior-gold-house-cafe-2026-11-11.jpg","preview":"https://chawcher.com/wp-content/uploads/2026/11/chawcher-dior-gold-house-cafe-2026-11-11-1024x768.jpg","wp_id":18150,"alt":"ผนังงานจักสานใน Café Dior"},
    {"url":"https://chawcher.com/wp-content/uploads/2026/11/chawcher-dior-gold-house-team-2-2026-11-11.jpg","preview":"https://chawcher.com/wp-content/uploads/2026/11/chawcher-dior-gold-house-team-2-2026-11-11-768x1024.jpg","wp_id":18152,"alt":"ทีม Chaw Cher ที่ Dior Gold House"}]'::jsonb,
  18153, 'https://chawcher.com/?p=18153');

-- ทะเบียนโมดูล · เมนู "ข่าว" (Bay เห็น)
insert into core.modules
  (id, name_th, name_en, icon, db_schema, depends_on, required_capability, home_path, sort_order, is_core, description_th)
values
  ('news', 'ข่าว Chaw Cher', 'News', 'newspaper', 'content',
   '{core,content}', 'admin', '/news', 92, false,
   'ข่าว Chaw Cher + ASE ทุกเช้า 08:00 · AI ร่าง · Bay กด preview / publish chawcher.com / ส่ง LINE');
