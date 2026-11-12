# วิธี deploy ขึ้น Vercel

> ⚠️ ขั้นตอนนี้ **Claude ทำให้ไม่ได้** เพราะข้อจำกัด 2 อย่างพร้อมกัน (ดูท้ายไฟล์)
> Bay ต้องกดเองใน Vercel Dashboard ใช้เวลาประมาณ 5 นาที

---

## สถานะตอนนี้

| | |
|---|---|
| โปรเจกต์ Vercel | **`chawcher-os` สร้างไว้แล้ว** · ทีม Bay (`bay8`) |
| Project ID | `prj_6qWJMrU96pLjPk6GhFBlBiU6dhWG` |
| เชื่อม GitHub แล้วยัง | ❌ ยัง |
| ตั้ง env var แล้วยัง | ❌ ยัง |
| deploy แล้วยัง | ❌ ยัง |

**อย่าสร้างโปรเจกต์ใหม่ชื่อซ้ำ** — ใช้ตัวที่มีอยู่แล้ว

---

## ขั้นตอน (ประมาณ 5 นาที)

### 1. เชื่อม GitHub

Vercel Dashboard → โปรเจกต์ **chawcher-os** → **Settings → Git**

| ช่อง | ใส่ |
|---|---|
| Repository | `baysireekahnokrath/Chawcheros` |
| Production Branch | `main` · ตั้งที่ Settings → Environments → Production → Branch Tracking (เปลี่ยนแล้ว 2026-11-12) |

### 2. ตั้ง Root Directory

**Settings → Build & Deployment → Root Directory**

```
web
```

⚠️ **สำคัญมาก** — โค้ดเว็บอยู่ในโฟลเดอร์ `web/` ไม่ได้อยู่ที่ราก
ถ้าไม่ตั้ง Vercel จะหา Next.js ไม่เจอและ build พัง

Framework ปล่อยให้ตรวจเองได้ (จะขึ้น Next.js)

### 3. ใส่ตัวแปรสภาพแวดล้อม 2 ตัว

**Settings → Environment Variables** — ติ๊กครบทั้ง 3 (Production · Preview · Development)

| Key | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://iblnlzttabwuydgcmqts.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_T8MaQoGHPr8R9wLVywiQVQ_XEwVTgI1` |

> **คีย์นี้เปิดเผยได้ ไม่ใช่ความลับ** — มันถูกออกแบบมาให้ฝังในหน้าเว็บอยู่แล้ว
> สิ่งที่กันข้อมูลจริงๆ คือ RLS ในฐานข้อมูล ไม่ใช่การซ่อนคีย์
> (ถ้าไม่มีสิทธิ์ ต่อให้มีคีย์ก็อ่านอะไรไม่ได้ — ทดสอบแล้ว `anon` แตะไม่ได้สักตาราง)

⚠️ ต้องใส่ **ก่อน** deploy ครั้งแรก เพราะ Next.js ต้องใช้ตอน build ไม่ใช่ตอนรัน

### 4. Deploy

**Deployments → Redeploy** (หรือ push อะไรก็ได้ขึ้น branch นั้น)

---

## หลัง deploy เสร็จ — สร้างบัญชีของ Bay

ระบบ**ไม่เปิดสมัครเอง** ต้องสร้างผู้ใช้ก่อน

**Supabase Dashboard** → โปรเจกต์ `chawcher` → **Authentication → Users → Add user**

- Email: อีเมลของ Bay
- Password: ตั้งเอง
- ✅ ติ๊ก **Auto Confirm User**

จากนั้นเปิด URL ที่ Vercel ให้มา → ล็อกอิน → ระบบจะพาไปหน้า **"ตั้งค่าครั้งแรก"**
ใส่ชื่อ → กด → **ได้สิทธิ์เจ้าของครบทุกอย่าง รวมถึงเห็นต้นทุนและกำไร**

> สิทธิ์นี้ให้ได้**ครั้งเดียวในชีวิตของระบบ** คนที่ 2 เป็นต้นไปต้องให้ Bay สร้างให้

---

## ทำไม Claude ทำขั้นตอนนี้ให้ไม่ได้

ติด 2 อย่างพร้อมกัน:

**1. Vercel MCP ผูกไว้กับโปรเจกต์เดียว**
เชื่อมต่อนี้เข้าถึงได้แค่ `bee-coder-islands` เท่านั้น
เรียก `chawcher-os` หรือแม้แต่ `chawcher-materials` ก็ตอบ 404 หมด
(สร้างโปรเจกต์ได้ แต่แก้ไขหรือ deploy ไม่ได้)

**2. `vercel.com` ถูกบล็อกโดยนโยบาย network** จึงใช้ Vercel CLI แทนไม่ได้

**ถ้าอยากให้ Claude ทำเองได้ในอนาคต** ต้องขยาย scope ของ Vercel connector
ให้ครอบคลุมทั้งทีม ไม่ใช่ผูกกับโปรเจกต์เดียว

---

## POS หน้าบูธ (`/pos`) · เพิ่ม 2026-11-06

| หน้า | ใครเปิดได้ | ทำอะไร |
|---|---|---|
| `https://<โดเมน vercel>/pos` | **ทุกคนที่มีลิงก์** (ไม่ต้องล็อกอิน) ใส่ PIN ร้านครั้งเดียวต่อเครื่อง | ขาย ออกใบเสร็จ · เน็ตหลุดก็ขายต่อได้ ระบบส่งเข้าฐานข้อมูลให้เองเมื่อเน็ตกลับ |
| `https://<โดเมน vercel>/pos-admin` | Bay (ล็อกอิน + สิทธิ์ admin) | ดูบิลทุกเครื่อง · แก้ · ยกเลิก · ลบ · CSV · เปลี่ยน PIN |

### ก่อนใช้ครั้งแรก
1. แก้ PIN ในไฟล์ `docs/sql-done/APPLY-0037-pos.sql` (บรรทัด ★) แล้ววางรันใน Supabase SQL Editor
2. ให้โค้ด branch นี้ขึ้น Production ของ Vercel (merge เข้า Production Branch หรือเปลี่ยน Production Branch)
3. เปิด `/pos` ใส่ PIN → ขายทดสอบ 1 บิล → เปิด `/pos-admin` ดูว่าบิลเข้า → ลบบิลทดสอบ

> ⚠️ Preview deployment ของ Vercel มักเปิดการป้องกัน (ต้องล็อกอิน Vercel) · ลิงก์ที่ส่งให้น้องต้องเป็น **Production** เท่านั้น
