-- ทดสอบ 0037 · รูปหลายรูปในคำสั่งเดียว · รันหลัง 17
do $$
declare n int; ids text[];
begin
  -- กลุ่มเช็คงาน (Gqc · เปิดรูป) · อัลบั้ม 3 รูป + รูปเดี่ยว 1 รูป
  perform line_agent.image_seen('Gqc', 'U1', 'a1', 'SET1', 1, 3);
  perform line_agent.image_seen('Gqc', 'U1', 'a3', 'SET1', 3, 3);
  perform line_agent.image_seen('Gqc', 'U1', 'a2', 'SET1', 2, 3);
  perform line_agent.image_seen('Gqc', 'U1', 's1', null, null, null);
  perform line_agent.image_seen('Gqc', 'U2', 'x1', null, null, null);
  -- กลุ่มที่ไม่ได้เปิดรูป/สลิป ไม่จำ
  perform line_agent.image_seen('Gprog', 'U1', 'p1', null, null, null);
  if exists (select 1 from line_agent.recent_images where message_id = 'p1') then raise exception '1 พัง: กลุ่มที่ไม่เปิดต้องไม่จำ'; end if;

  select array_agg(x) into ids from line_agent.images_for('Gqc', 'U1', 'a2') x;
  if ids <> array['a1','a2','a3'] then raise exception '2 พัง: Reply รูปในอัลบั้มต้องได้ทั้งอัลบั้มตามลำดับ %', ids; end if;
  select array_agg(x) into ids from line_agent.images_for('Gqc', 'U1', 's1') x;
  if ids <> array['s1'] then raise exception '3 พัง: Reply รูปเดี่ยวได้รูปเดียว %', ids; end if;
  select count(*) into n from line_agent.images_for('Gqc', 'U1', null);
  if n <> 4 then raise exception '4 พัง: ไม่ Reply = รูปของคนนี้ใน 10 นาที ได้ %', n; end if;
  select array_agg(x) into ids from line_agent.images_for('Gqc', 'U9', 'zzz') x;
  if ids <> array['zzz'] then raise exception '5 พัง: Reply รูปที่บอทไม่ได้จำ ต้องได้รูปนั้น %', ids; end if;
  update line_agent.recent_images set created_at = now() - interval '2 hours' where message_id = 'x1';
  perform line_agent.image_seen('Gqc', 'U1', 'a9', null, null, null);
  if exists (select 1 from line_agent.recent_images where message_id = 'x1') then raise exception '6 พัง: เกิน 1 ชม. ต้องลบเอง'; end if;
  raise notice '18 ผ่านทั้ง 6 ข้อ · ทั้งอัลบั้ม · รูปเดี่ยว · 10 นาทีล่าสุด · กลุ่มไม่เปิดไม่จำ · ลบเองเกิน 1 ชม.';
end $$;
