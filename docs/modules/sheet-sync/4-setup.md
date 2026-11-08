# ดึง Google Sheet · ขั้นตอนที่ Bay ต้องกดเอง

**2026-11-02** · โค้ดเสร็จ ทดสอบผ่าน · ใช้เวลารวม ~15 นาที

## 1 · ลงตารางใน Supabase (2 นาที)

Supabase → SQL Editor → New query → วางไฟล์ `supabase/migrations/0035_sheets.sql` ทั้งไฟล์ → Run
https://github.com/baysireekahnokrath/Chawcheros/blob/claude/lucid-carson-uely21/supabase/migrations/0035_sheets.sql

## 2 · สร้างบัญชีโปรแกรมใน Google Cloud (8 นาที · ฟรี)

1. เปิด https://console.cloud.google.com → มุมบนซ้าย **เลือกโปรเจกต์ → New Project** → ชื่อ `chawcher-os` → Create
2. ช่องค้นหาบนสุด พิมพ์ **Google Sheets API** → กด **Enable**
3. เมนูซ้าย **IAM & Admin → Service Accounts → Create service account**
   - ชื่อ `chawcher-sheets` → **Create and continue** → ข้ามขั้นสิทธิ์ (ไม่ต้องเลือก role) → **Done**
4. กดเข้าบัญชีที่เพิ่งสร้าง → แท็บ **Keys → Add key → Create new key → JSON → Create**
   → ได้ไฟล์ `.json` ลงเครื่อง · **ไฟล์นี้คือกุญแจ ห้ามส่งในแชท**
5. จดอีเมลของบัญชี (หน้าตาแบบ `chawcher-sheets@chawcher-os.iam.gserviceaccount.com`)

> ถ้าองค์กร Google บังคับห้ามสร้าง key (ขึ้นข้อความเรื่อง organization policy) แคปส่งมา · มีทางอื่น

## 3 · แชร์ 4 ไฟล์ให้บัญชีนั้น · **ผู้ดู (Viewer) เท่านั้น**

เปิดแต่ละไฟล์ → **Share** → วางอีเมลจากข้อ 2.5 → เลือก **Viewer** → ติ๊กเอา "Notify people" ออก → Share

- Chaw Cher Order Tracking
- PO template 2026
- Chaw Cher Stock
- Clearance Sales 2026

> Viewer = Google ไม่ยอมให้บัญชีนี้แก้ชีต ต่อให้โค้ดผิด (B40)

## 4 · ใส่กุญแจใน Vercel

Vercel → chawcher-os → Settings → Environment Variables → Add

| Key | Value |
|---|---|
| `GOOGLE_SERVICE_ACCOUNT_JSON` | เปิดไฟล์ `.json` จากข้อ 2.4 ด้วย Notepad → ก๊อป**ทั้งไฟล์**มาวาง |
| `CRON_SECRET` | พิมพ์ตัวอักษรมั่วๆ ยาว 30 ตัวขึ้นไป (ใช้ให้ Vercel ดึงชีตเองทุกเช้า 6 โมง) |

## 5 · เอาโค้ดขึ้นเว็บ

GitHub → https://github.com/baysireekahnokrath/Chawcheros/compare/claude/chaw-cher-os-setup-9k21w6...claude/lucid-carson-uely21
→ Create pull request (2 ครั้ง) → Merge pull request → Confirm merge → รอ Vercel ขึ้น Ready

## 6 · เช็ก

เปิด `/line` → หัวข้อ **ข้อมูลจาก Google Sheet** → กด **ดึงตอนนี้**
ต้องขึ้นสีเขียวทั้ง 5 แถว พร้อมจำนวนแถว · ถ้าแดง ข้อความสีแดงบอกสาเหตุ (ส่วนใหญ่คือยังไม่ได้แชร์ไฟล์)

แล้วลองในกลุ่มทดสอบ:
- `@Team Bay bls3230 รายละเอียด`
- `@Team Bay สัปดาห์นี้ต้องส่งอะไรบ้าง`
- `@Team Bay koontong sideboard มีในสต็อกไหม`
- `@Team Bay หนัง SM-Wheat เหลือเท่าไหร่`
- `@Team Bay ราคา clearance ขุนทอง`
- `@Team Bay ผลิตกี่วัน ลูกค้ารีบ`
- `@Team Bay ทำอะไรได้บ้าง และ 3230 ส่งวันไหน`

---

## สิ่งที่รู้ไว้

| เรื่อง | |
|---|---|
| ดึงบ่อยแค่ไหน | ตอนมีคนถามบอทแล้วข้อมูลเก่ากว่า 10 นาที · ปุ่มดึงตอนนี้ · ทุกเช้า 6 โมง (Vercel Hobby ตั้งเวลาได้วันละครั้ง) |
| ไม่ดึงอะไร | ชื่อ เบอร์ ที่อยู่ลูกค้า · ยอดเงิน · ต้นทุน · Landing Cost · Inventory Value · ไม่ขอคอลัมน์พวกนี้จาก Google เลย |
| กำหนดส่ง | ช่อง "วันที่ต้องการให้ผลิตเสร็จ" ในชีตว่างทั้งปี 2569 · บอทใช้ "กำหนดส่งของ" แทน · ข้อความลอยๆ เช่น "ปลายเดือน" แปลงเป็นวันไม่ได้ จะบอกจำนวนแยกไว้ |
| กำหนดส่งที่มีชื่อคนรับ | ไม่ส่งเข้าห้อง · ขึ้นว่า "ดูในชีต" |
| สต็อกทำแท็บใหม่ | ใช้แท็บที่วันที่ในชื่อใหม่สุดเอง (เช่น `CHAW CHER STOCK 2-11-69`) · ต้องตั้งชื่อรูปแบบเดิม |
| Clearance หมดอายุ | 30 พ.ย. 2569 · เลยวันบอทไม่ตอบราคา · ราคาชุดใหม่ แก้วันหมดอายุใน `sheets.sources` |
| ทดสอบ | `supabase/tests/16_sheets.sql` (8 ข้อ) · `web/scripts/sheets-parse.test.mts` (ตัวแปลงชีต) |
