-- ============================================================================
-- 0037 · Team Bay · รูปหลายรูปในคำสั่งเดียว
-- ============================================================================
-- Bay ลองจริง 2026-11-02: "ได้ทีละรูป ไม่ work"
--   ส่งรูปหลายรูปพร้อมกัน (อัลบั้ม) แล้ว Reply รูปเดียว → บอทได้แค่รูปนั้น
--
-- ทางแก้: จำ "เลขรูป" ที่ส่งในกลุ่มที่เปิดสลิป/รูปงาน ไว้ชั่วคราว 1 ชั่วโมง
--   · จำแค่เลขรูป · คนส่ง · ชุดอัลบั้ม · เวลา · ไม่ดึงตัวรูป ไม่อ่าน ไม่เก็บข้อความ
--   · ลบเองเมื่อเกิน 1 ชั่วโมง · เฉพาะกลุ่มที่อนุมัติและเปิดสลิปหรือรูปงานเสร็จ
--   (ปรับจาก D3 "ไม่เก็บอะไรที่ไม่ได้ทักบอท" · ยกเว้นเลขรูปชั่วคราวเท่านั้น)
--
-- คำสั่ง "งานเสร็จ BLS…" / "สลิป" จะได้ทุกรูปใน:
--   · อัลบั้มเดียวกับรูปที่ Reply   หรือ
--   · ไม่ได้ Reply → รูปทั้งหมดที่คนเดียวกันส่งใน 10 นาทีล่าสุด
-- ============================================================================

create table line_agent.recent_images (
  message_id    text primary key,
  room_id       uuid not null references line_agent.rooms(id),
  line_user_id  text,
  image_set_id  text,
  set_index     int,
  set_total     int,
  created_at    timestamptz not null default now()
);
create index recent_images_user_idx on line_agent.recent_images (room_id, line_user_id, created_at desc);
create index recent_images_set_idx on line_agent.recent_images (image_set_id) where image_set_id is not null;
alter table line_agent.recent_images enable row level security;

comment on table line_agent.recent_images is
  'เลขรูปที่ส่งในกลุ่ม (ไม่มีตัวรูป) · เก็บ 1 ชั่วโมงเพื่อให้คำสั่งเดียวได้ทั้งอัลบั้ม · ลบเองอัตโนมัติ';

create or replace function line_agent.image_seen(p_group_id text, p_line_user_id text, p_message_id text,
                                                 p_set_id text, p_index int, p_total int)
returns void
language plpgsql security definer
set search_path = line_agent, public
as $$
declare f line_agent.rooms;
begin
  delete from line_agent.recent_images where created_at < now() - interval '1 hour';
  f := line_agent.room_flags(p_group_id);
  if f.id is null or not (f.can_photo or f.can_slip) then return; end if;
  insert into line_agent.recent_images (message_id, room_id, line_user_id, image_set_id, set_index, set_total)
  values (p_message_id, f.id, p_line_user_id, p_set_id, p_index, p_total)
  on conflict (message_id) do nothing;
end;
$$;

-- รูปที่คำสั่งนี้หมายถึง · เรียงตามลำดับในอัลบั้ม/เวลาที่ส่ง · ไม่เกิน 20 รูป
create or replace function line_agent.images_for(p_group_id text, p_line_user_id text, p_quoted text)
returns setof text
language sql stable security definer
set search_path = line_agent, public
as $$
  with f as (select id from line_agent.room_flags(p_group_id) where id is not null),
  q as (select * from line_agent.recent_images where message_id = p_quoted)
  select message_id from (
    -- Reply รูปที่อยู่ในอัลบั้ม → ทั้งอัลบั้ม
    select r.message_id, r.set_index, r.created_at from line_agent.recent_images r, q
     where q.image_set_id is not null and r.image_set_id = q.image_set_id
    union
    -- Reply รูปเดี่ยว (หรือรูปที่บอทไม่ได้จำ) → รูปนั้น
    select p_quoted, 0, now() where p_quoted is not null
      and not exists (select 1 from q where q.image_set_id is not null)
    union
    -- ไม่ได้ Reply → รูปของคนนี้ใน 10 นาทีล่าสุด
    select r.message_id, r.set_index, r.created_at from line_agent.recent_images r, f
     where p_quoted is null and r.room_id = f.id and r.line_user_id = p_line_user_id
       and r.created_at > now() - interval '10 minutes'
  ) x
  order by created_at, set_index nulls last, message_id
  limit 20
$$;

revoke all on function line_agent.image_seen(text, text, text, text, int, int),
  line_agent.images_for(text, text, text) from public, anon, authenticated;
grant execute on function line_agent.image_seen(text, text, text, text, int, int),
  line_agent.images_for(text, text, text) to service_role;

notify pgrst, 'reload schema';
