# นับคนมาถึงโชว์รูม · ขั้นตอนที่ Bay ต้องกดเอง

**2026-11-08** · โค้ด + ฐานข้อมูลเขียนเสร็จ ทดสอบผ่านแล้ว · เหลือขั้นที่ต้องใช้บัญชีของ Bay · รวม ~20 นาที

## ระบบทำอะไร

```
ลูกค้าสแกนป้าย A4 → แชท @chawcher เปิดพร้อม "สวัสดี มาถึงโชว์รูมแล้ว" → กดส่ง
   → LINE ส่งต่อมาที่ chawcher-os (webhook) → เก็บเฉพาะข้อความแจ้งมาถึง → หน้า /arrivals
```

| | |
|---|---|
| นับได้ | ทั้งเพื่อนใหม่และคนที่คุยกันอยู่แล้ว · คนเดียวส่งหลายรอบในวันเดียว = 1 |
| **ไม่ตอบลูกค้า** | แอดมินคุยในหน้า Chat ของ LINE OA Manager เหมือนเดิมทุกอย่าง |
| **ไม่เก็บแชทอื่น** | ข้อความที่ไม่ใช่ "มาถึงโชว์รูม" ทิ้งตั้งแต่ประตู ไม่เข้าฐานข้อมูล (PDPA) |
| พิมพ์เองก็นับ | "มาถึงโชว์รูมแล้วครับ" · "ถึงโชรูมแล้วค่ะ" นับ · "ยังไม่ถึงโชว์รูม" ไม่นับ |
| ส่งผิด/พนักงานลอง | กด "ไม่นับ" ในหน้า /arrivals · ลบไม่ได้ (A7) |

---

## 0 · เช็กก่อน (2 นาที) ⚠️ สำคัญที่สุด

LINE ให้ **1 OA ต่อ webhook ได้ 1 ที่** · ถ้า @chawcher ต่อกับระบบอื่นอยู่แล้ว (เช่น โปรแกรมแชท/CRM ของเจ้าอื่น) ใส่ของเราแทน = **ของเดิมหยุดทำงาน**

LINE OA Manager → @chawcher → **Settings → Messaging API**
- ขึ้นปุ่ม "Enable Messaging API" → ยังไม่เคยเปิด · ไปขั้น 1 ได้เลย
- ขึ้นว่าเปิดแล้ว และ **Webhook URL มีค่าอื่นอยู่** → **หยุด · บอกผมว่าเป็นของอะไร**

## 1 · ลงตารางในฐานข้อมูล (3 นาที)

Supabase → `chawcher` → **SQL Editor** → วางทั้งไฟล์ `supabase/migrations/0041_line_oa_arrivals.sql` → **Run**
ต้องได้ `Success. No rows returned` · เมนู **มาโชว์รูม** จะโผล่ในระบบ

## 2 · เปิด Messaging API ให้ @chawcher (5 นาที)

1. Settings → **Messaging API** → **Enable Messaging API**
2. เลือก Provider **Chaw Cher ตัวเดียวกับ Team Bay** (เลือกแล้วเปลี่ยนไม่ได้)
   → LINE ให้รหัสลูกค้าเป็นรายเจ้าของ (provider) · อยู่ด้วยกัน = รหัสลูกค้าคนเดียวกันตรงกันทุก OA ใช้ต่อได้ทีหลัง
3. Settings → **Response settings**
   - **Chat: เปิดไว้เหมือนเดิม** (แอดมินยังตอบได้)
   - **Webhooks: เปิด**
   - ข้อความทักทาย / ตอบอัตโนมัติ / AI Chatbot: **ไม่ต้องแตะ** ปล่อยตามเดิม

## 3 · เอา key จาก LINE Developers (5 นาที)

developers.line.biz → Provider Chaw Cher → Channel **@chawcher** (ไม่ใช่ Team Bay)

| แท็บ | ชื่อในหน้า | ใส่ Vercel ชื่อ | |
|---|---|---|---|
| Basic settings | Channel secret | `LINE_OA_CHANNEL_SECRET` | ต้องมี |
| Messaging API | Channel access token (long-lived) → Issue | `LINE_OA_CHANNEL_ACCESS_TOKEN` | ไม่บังคับ · มีแล้วเห็นชื่อลูกค้า |

แท็บ Messaging API → **Webhook URL**

```
https://chawcher-os.vercel.app/api/line/oa/webhook
```

เปิด **Use webhook** · ปิด "Webhook redelivery" ได้ (ระบบกันนับซ้ำอยู่แล้ว)

> ⚠️ ชื่อ key ขึ้นต้น `LINE_OA_` · **อย่าทับ** `LINE_CHANNEL_SECRET` เดิมของ Team Bay

## 4 · ใส่ key ใน Vercel แล้ว Redeploy (3 นาที)

Vercel → **chawcher-os** → Settings → Environment Variables (Production) → ใส่ 2 ตัวข้างบน
→ Deployments → **Redeploy** · กลับไป LINE Developers กด **Verify** ต้องขึ้น Success
→ เปิด `/arrivals` ในระบบ · 3 ช่องการเชื่อมต่อต้องเขียว (ชื่อลูกค้าเหลืองได้ถ้าไม่ใส่ token)

## 5 · ทดสอบ (2 นาที)

1. ใช้มือถือ (บัญชีที่เป็นเพื่อน @chawcher อยู่แล้ว) สแกนป้าย A4 → กดส่ง
2. เปิด `/arrivals` → ต้องขึ้นภายในไม่กี่วินาที · "วันนี้ 1"
3. กด **ไม่นับ** แถวนั้น (เพราะเป็นการทดสอบ) → ยอดกลับเป็น 0
4. ในแอดมิน LINE OA Manager → ข้อความยังขึ้นในหน้า Chat ตามปกติ ✓

ไม่ขึ้น → Vercel → Logs ค้น `line-oa` แล้วส่งให้ผมดู

---

## ส่วนที่ทดสอบแล้ว (2026-11-08)

| | ผล |
|---|---|
| migration 0001–0041 บน Postgres 16 | ผ่าน |
| `supabase/tests/20_line_oa_arrivals.sql` · ซ้ำ · นับรายวัน · เวลาไทย · รหัสนัด · ห้ามลบ · สิทธิ์ | ผ่าน |
| คัดข้อความ 10 แบบ + event ที่ต้องทิ้ง 4 แบบ | 14/14 |
| webhook ลายเซ็นปลอม → 401 · ลายเซ็นถูก → 200 · หน้า /arrivals ไม่ล็อกอิน → ไปหน้า login | ผ่าน |
| `tsc` · `eslint` · `next build` | ผ่าน |
| **ยังไม่ได้ทดสอบกับ LINE จริง** | ขั้น 5 คือที่ที่จะรู้จริง |
