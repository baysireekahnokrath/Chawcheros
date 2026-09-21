-- จำลองสิ่งที่ Supabase มีให้อยู่แล้ว เพื่อทดสอบ migration นอก Supabase
create schema if not exists auth;
create table auth.users (id uuid primary key);
create or replace function auth.uid() returns uuid
  language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated;
  end if;
end $$;
