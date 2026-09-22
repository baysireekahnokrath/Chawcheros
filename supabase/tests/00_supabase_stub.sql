-- จำลองสิ่งที่ Supabase มีให้อยู่แล้ว เพื่อทดสอบ migration นอก Supabase
create schema if not exists auth;
create table auth.users (id uuid primary key);
create or replace function auth.uid() returns uuid
  language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
do $$
declare r text;
begin
  foreach r in array array['authenticated','anon','service_role','authenticator'] loop
    if not exists (select 1 from pg_roles where rolname = r) then
      execute format('create role %I', r);
    end if;
  end loop;
end $$;

-- Supabase ของจริงเปิดให้ทุก role เรียก auth.uid() ได้ ถ้า stub ไม่เปิดด้วย
-- trigger touch_updated_at จะ error เฉพาะตอนทดสอบในเครื่อง แล้วเราจะไล่ผิดที่
grant usage on schema auth to authenticated, anon, service_role;
grant execute on function auth.uid() to authenticated, anon, service_role;
