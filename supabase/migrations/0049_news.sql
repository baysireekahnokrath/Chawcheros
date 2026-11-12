-- ============================================================================
-- 0049 · ข่าว Chaw Cher / ASE (หน้า /news)
-- ============================================================================
-- ที่มา: docs/modules/news/0-idea.md · Bay สั่ง 2026-11-11
--   1. ทุกเช้า 08:00 ไปเช็กข่าว Chaw Cher + ASE · ข่าวซ้ำไม่เอา
--   2. ทำเป็นร่างโพสต์ chawcher.com + ข้อความสั้นพร้อมภาพสำหรับ LINE
--   3. หน้าสรุปให้ Bay กด preview → ok กด publish หรือส่ง LINE
--   2026-11-12 Bay: "ไม่เสียตังค์" → ไม่เรียก Claude API · ข่าวเข้า Google Sheet "Chaw Cher News"
--     Claude (แพ็กเกจของ Bay) ร่างลงแท็บ "ร่าง" ทุกเช้า 08:00 → ระบบดึงแท็บนั้น 09:00 → Bay approve ที่ /news
--
-- กฎที่ไฟล์นี้บังคับในฐานข้อมูล
--   กันซ้ำ   : ลิงก์ต้นทาง (ตัด http/www/? ท้าย) ซ้ำไม่ได้ · ข่าวที่ "ไม่ใช้" ก็ยังกันซ้ำ (ไม่เด้งกลับมาอีก)
--   ห้ามลบ  : A7 (apply_standard_rules) · ไม่เอา = เปลี่ยนเป็น "ไม่ใช้"
--   ของออกนอก : publish / ส่ง LINE ต้องมีคนกด (reviewed_by) · บอทตั้งเวลาทำได้แค่ "ร่าง"
--   สิทธิ์   : Bay (admin) เท่านั้น · ตัวดึงชีตเขียนผ่านฟังก์ชัน content.news_import ด้วย service_role
-- ============================================================================

create table content.news_items (
  id            uuid primary key default gen_random_uuid(),
  brand         text not null check (brand in ('Chaw Cher', 'ASE')),
  source        text not null check (source in ('ชีตข่าว', 'Bay ส่งเอง')),
  sheet_ref     text unique,                           -- ช่อง "รหัส" ในแท็บ "ร่าง" · กันดึงแถวเดิมซ้ำ
  source_url    text,                                  -- ลิงก์ข่าวต้นทาง
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

  constraint news_sheet_has_ref check (source <> 'ชีตข่าว' or sheet_ref is not null),
  constraint news_published_has_reviewer check (status <> 'เผยแพร่แล้ว' or (reviewed_by is not null and wp_post_id is not null)),
  constraint news_line_has_reviewer check (line_sent_at is null or reviewed_by is not null),
  constraint news_images_array check (jsonb_typeof(images) = 'array' and jsonb_array_length(images) <= 10)
);
create unique index news_items_source_key_uq on content.news_items (source_key) where source_key is not null;
create index news_items_status_idx on content.news_items (status, created_at desc);

comment on table content.news_items is
  'ข่าว Chaw Cher / ASE · ตัวดึงชีตสร้างได้แค่ร่าง · ขึ้นเว็บ/ส่ง LINE ต้องมีคนกด (reviewed_by) · sheet_ref + source_key กันข่าวซ้ำ';

create table content.news_runs (
  id             uuid primary key default gen_random_uuid(),
  run_by         text not null check (run_by in ('ตั้งเวลา', 'กดเอง')),
  rows_read      int not null default 0,
  created        int not null default 0,
  skipped_dupes  int not null default 0,
  error          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  updated_by     uuid references core.app_users(id)
);
comment on table content.news_runs is 'รอบดึงแท็บ "ร่าง" จากชีต Chaw Cher News · 1 แถว = 1 รอบ';

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
-- ตัวดึงชีต (ไม่มีคนล็อกอิน · service_role) ใช้ได้แค่ฟังก์ชันนี้
-- แถวที่รหัสซ้ำ หรือลิงก์ต้นทางซ้ำกับข่าวที่มีแล้ว (รวมที่ "ไม่ใช้") = ข้าม
-- ---------------------------------------------------------------------------
create or replace function content.news_import(p jsonb)
returns int
language plpgsql security definer
set search_path = content, public
as $$
declare it jsonb; n int := 0; dup int := 0; total int := 0;
begin
  for it in select * from jsonb_array_elements(coalesce(p->'items', '[]'::jsonb)) loop
    total := total + 1;
    insert into content.news_items (brand, source, sheet_ref, source_url, source_title, source_date, note,
                                    post_title, post_body, line_text, images)
    values (case when it->>'brand' ilike 'ase%' then 'ASE' else 'Chaw Cher' end, 'ชีตข่าว', it->>'sheet_ref',
            nullif(btrim(it->>'source_url'), ''), left(nullif(it->>'source_title', ''), 300),
            case when it->>'source_date' ~ '^\d{4}-\d{2}-\d{2}' then left(it->>'source_date', 10)::date end,
            left(nullif(it->>'summary', ''), 2000),
            left(it->>'post_title', 200), left(coalesce(it->>'post_body', ''), 8000), left(coalesce(it->>'line_text', ''), 1000),
            coalesce(it->'images', '[]'::jsonb))
    on conflict do nothing;
    if found then n := n + 1; else dup := dup + 1; end if;
  end loop;
  insert into content.news_runs (run_by, rows_read, created, skipped_dupes, error)
  values (coalesce(p->>'run_by', 'ตั้งเวลา'), total, n, dup, nullif(p->>'error', ''));
  return n;
end;
$$;

revoke all on function content.news_import(jsonb) from public, anon, authenticated;
grant execute on function content.news_import(jsonb) to service_role;

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
   'ข่าว Chaw Cher + ASE · Claude ร่างในชีตทุกเช้า · Bay กด preview / publish chawcher.com / ส่ง LINE');
