# LINE Agent · ด่าน 4 · ขั้นตอนที่ Bay ต้องกดเอง

**2026-11-01** · โค้ดและฐานข้อมูลเขียนเสร็จ ทดสอบผ่านแล้ว · เหลือขั้นที่ต้องใช้บัญชีของ Bay
ทำตามลำดับ ใช้เวลารวมราว 20-30 นาที

> ⚠️ ข้อเท็จจริงของ LINE ข้อ ◻ ใน `0-idea.md` (reply ฟรี · isSelf · ฯลฯ) ผมยังตรวจซ้ำไม่ได้
> เพราะ session นี้เข้าเว็บ LINE ไม่ได้ · **ขั้น 6 ห้องทดสอบคือที่ที่จะรู้จริง** ก่อนเข้าห้อง CC

---

## 1 · ลงตารางในฐานข้อมูล (5 นาที)

Supabase Dashboard → โปรเจกต์ `chawcher` → **SQL Editor** → New query
→ วางเนื้อไฟล์ `supabase/migrations/0034_line_agent.sql` ทั้งไฟล์ → **Run**

ผลที่ต้องได้: `Success. No rows returned` · เมนู "ผู้ช่วย LINE" จะโผล่ในระบบหลัง deploy

## 2 · เปิด LINE Official Account ใหม่ (10 นาที · D2)

1. เข้า **LINE Official Account Manager** (manager.line.biz) → สร้างบัญชีใหม่ ชื่อ **Team Bay** · แพ็กเกจฟรี
2. ตั้งค่า → **บัญชี** → เปิด **"อนุญาตให้บัญชีเข้าร่วมกลุ่มแชท"**
3. ตั้งค่า → **การตอบกลับ** → ปิด "ข้อความตอบกลับอัตโนมัติ" · ปิด "ข้อความทักทาย" · **เปิด Webhook**
4. ตั้งค่า → **Messaging API** → กด **เปิดใช้ Messaging API** (สร้าง Provider ใหม่ชื่อ Chaw Cher ได้)

## 3 · เอา key 2 ตัวจาก LINE Developers (5 นาที)

เข้า **developers.line.biz** → Provider Chaw Cher → Channel "Team Bay"

| เอาจากแท็บ | ชื่อในหน้า | เอาไปใส่ Vercel ชื่อ |
|---|---|---|
| Basic settings | **Channel secret** | `LINE_CHANNEL_SECRET` |
| Messaging API | **Channel access token (long-lived)** → กด Issue | `LINE_CHANNEL_ACCESS_TOKEN` |

ในแท็บ Messaging API → **Webhook URL** ใส่

```
https://chawcher-os.vercel.app/api/line/webhook
```

เปิด **Use webhook** · (กด Verify ได้หลังขั้น 4 เสร็จ ต้องขึ้น Success)

## 4 · ใส่ key ใน Vercel (5 นาที)

Vercel → โปรเจกต์ **chawcher-os** → Settings → **Environment Variables** · ติ๊ก Production

| Key | เอามาจาก |
|---|---|
| `LINE_CHANNEL_SECRET` | ขั้น 3 |
| `LINE_CHANNEL_ACCESS_TOKEN` | ขั้น 3 |
| `SUPABASE_SECRET_KEY` | Supabase → Project Settings → **API Keys** → **Secret key** (`sb_secret_…`) |
| `ANTHROPIC_API_KEY` | มีอยู่แล้วจาก content agent · ไม่ต้องใส่ใหม่ |

> `SUPABASE_SECRET_KEY` เป็นความลับ · ห้ามแปะในแชท ห้ามใส่ในโค้ด
> แต่ถึงหลุด ในฐานข้อมูล key นี้เรียกได้แค่ประตูของบอท (0034) ที่ไม่มีราคาและข้อมูลลูกค้า

แล้ว **Deployments → Redeploy** · เสร็จแล้วเปิด `/line` ในระบบ → ช่อง LINE / ฐานข้อมูล / Claude ต้องเขียวทั้ง 3

## 5 · ทดสอบ 30 คำถาม (LR-26 · ผม/โปรแกรมเมอร์รัน · ~10 บาท)

```bash
cd web && ANTHROPIC_API_KEY=sk-ant-... node --experimental-strip-types scripts/line-eval.mts
```

ต้องได้ `30/30 ผ่าน` · ไม่ครบ = แก้ก่อน ห้ามเข้าห้องจริง

## 6 · ห้องทดสอบ 1 สัปดาห์ (LR-27)

1. สร้างกลุ่ม LINE ใหม่ "ทดสอบ Team Bay" · Bay + ทีม CC 1-2 คน
2. เชิญ **Team Bay** เข้ากลุ่ม
3. เปิด `/line` ในระบบ → ห้องขึ้น **รออนุมัติ** → กด **อนุมัติ**
4. ลงออเดอร์จริงสัก 2-3 ใบในระบบ แล้วลองพิมพ์ในกลุ่ม
   - `@Team Bay BLS3230 รายละเอียด`
   - `@Team Bay สัปดาห์นี้ต้องเสร็จอะไรบ้าง`
   - `@Team Bay ต้นทุน BLS3230` → ต้องตอบว่าไม่มีข้อมูลนี้
   - `@Team Bay ตอบผิด` → ต้องถอนคำตอบ และ `/line` ขึ้นธง
   - พิมพ์อะไรก็ได้ **ไม่ทัก** → บอทต้องเงียบ และ `/line` ต้องไม่มีบันทึก
5. ดู `/line` ทุกวัน · อะไรผิดบอกผม → ผมแก้และเพิ่มเข้าชุดทดสอบ

## 7 · เข้าห้อง CC จริง

ผ่านห้องทดสอบแล้ว → เชิญบอทเข้าห้อง CC → อนุมัติใน `/line` → โพสต์ข้อความแจ้งทีม (ร่างอยู่ท้าย `2-requirements.md`)

---

## ถ้ามีอะไรผิดปกติ

| เห็นอะไร | ทำอะไร |
|---|---|
| บอทตอบผิด / ไม่มั่นใจ | `/line` → **พักบอท** · เงียบทันที ทีมคุยแบบเดิมได้ |
| ทักแล้วบอทเงียบ | `/line` ดูว่าห้อง **อนุมัติ** แล้วไหม · บอทพักอยู่ไหม · ช่องเชื่อมต่อเขียวไหม |
| ไม่มีอะไรขึ้นใน `/line` เลย | ปุ่ม Verify ใน LINE Developers ต้อง Success · ปิด "ข้อความตอบกลับอัตโนมัติ" ใน OA แล้วหรือยัง |
| งบหมด | `/line` → เพิ่มงบ หรือเปลี่ยนเป็นรุ่น Haiku 5.5 (ถูกกว่า ~40 เท่า) |

---

## ไฟล์ที่สร้าง

| ไฟล์ | ทำอะไร |
|---|---|
| `supabase/migrations/0034_line_agent.sql` | ตาราง ห้อง · บันทึก · ตั้งค่า + **ประตูข้อมูลที่ไม่มีราคา/ลูกค้า** |
| `supabase/tests/15_line_agent.sql` | พิสูจน์ 9 ข้อ (ข้อมูลลับไม่หลุด · กันซ้ำ · อนุมัติห้อง · ตอบผิด ฯลฯ) · ผ่านครบ |
| `web/src/app/api/line/webhook/route.ts` | รับข้อความจาก LINE · ตรวจลายเซ็น |
| `web/src/modules/line-agent/handle.ts` | ลำดับการตัดสินใจทั้งหมด |
| `web/src/modules/line-agent/intent.ts` | Claude อ่านคำถาม → เลือกว่าจะดึงอะไร (ไม่เห็นข้อมูล) |
| `web/src/modules/line-agent/render.ts` | **โค้ด**เขียนคำตอบจากฐานข้อมูล (LR-24) |
| `web/src/modules/line-agent/db.ts` · `line.ts` · `admin.ts` | ต่อฐานข้อมูล · ต่อ LINE · ปุ่มหลังบ้าน |
| `web/src/app/(app)/line/page.tsx` | หน้าหลังบ้าน `/line` |
| `web/scripts/line-eval.mts` | ชุดทดสอบ 30 คำถาม |
