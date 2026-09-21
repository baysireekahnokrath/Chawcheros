# ชุดทดสอบ migration

ทดสอบกับ Postgres ในเครื่อง โดยไม่ต้องแตะโปรเจกต์จริงบน Supabase

- `00_supabase_stub.sql` — จำลอง `auth.users` / `auth.uid()` / role `authenticated` ที่ Supabase มีให้อยู่แล้ว
- `01_rules.sql` — ตรวจว่ากฎเหล็กบังคับใช้จริงในฐานข้อมูล ไม่ใช่แค่เขียนไว้

## รัน

```bash
export PATH=/usr/lib/postgresql/16/bin:$PATH
D=/var/lib/postgresql/cctest
su postgres -s /bin/bash -c "
  initdb -D $D/data -U postgres --auth=trust
  pg_ctl -D $D/data -o '-p 55432 -k $D -c listen_addresses=' -l $D/log start
  createdb -h $D -p 55432 -U postgres t1
  psql -h $D -p 55432 -U postgres -d t1 -1 -v ON_ERROR_STOP=1 -f supabase/tests/00_supabase_stub.sql
  for f in supabase/migrations/*.sql; do
    psql -h $D -p 55432 -U postgres -d t1 -1 -v ON_ERROR_STOP=1 -f \$f
  done
  psql -h $D -p 55432 -U postgres -d t1 -f supabase/tests/01_rules.sql
"
```

**ใช้ `-1` เสมอ** เพื่อให้แต่ละ migration รันในทรานแซกชันเดียว — ล้มกลางคันแล้วถอยกลับหมด
ไม่ทิ้งสถานะค้าง (เจอปัญหานี้จริงตอนทดสอบครั้งแรก)

## ผลที่ต้องได้

| ข้อ | ตรวจอะไร | ผลที่ถูก |
|---|---|---|
| 1 | เลขตรวจสอบ Luhn | จับพิมพ์ผิด · จับสลับเลข · ปฏิเสธเลขขึ้นต้นด้วย 0 |
| 2 | ออก SKU 2,000 ตัว | ไม่ซ้ำเลย · ผ่านเลขตรวจสอบทุกตัว · ไม่มีตัวไหนขึ้นต้นด้วย 0 |
| 3 | รูปแบบแสดงผล | `23722051` → `237.220.51` |
| 4 | กฎ A7 ห้ามลบ | DELETE ต้องโยน error |
| 6 | กฎ A3 SKU ห้ามเปลี่ยน | UPDATE sku ต้องโยน error |
| 7 | แก้ช่องอื่น | ทำได้ปกติ และ `updated_at` ขยับเอง |
| 8 | SKU นอกทะเบียน | ใส่ไม่ได้ |
| 9 | ประวัติการแก้ | `audit_log` บันทึกเองทุกตาราง |
