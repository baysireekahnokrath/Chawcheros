# Chaw Cher OS — เว็บแอป

Next.js 16 · TypeScript · Tailwind · Supabase

## โครงสร้าง

```
src/
  app/
    login/              หน้าเข้าสู่ระบบ
    (app)/
      layout.tsx        เปลือกแอป (หัวเรื่อง + ชื่อผู้ใช้ + ออก)
      page.tsx          App Launcher  ← สร้างตัวเองจากตาราง core.modules
      setup/            ตั้งค่าครั้งแรก (คนแรก = เจ้าของ)
      marketing/        โมดูลการตลาด
  modules/
    registry.ts         อ่านทะเบียนโมดูล + สิทธิ์
    marketing/          queries + actions ของโมดูลการตลาด
  lib/supabase/         client ฝั่งเบราว์เซอร์และเซิร์ฟเวอร์
  middleware.ts         ต่ออายุ session + กันหน้าที่ต้องล็อกอิน
```

**เพิ่มโมดูลใหม่ = เพิ่มโฟลเดอร์ใน `modules/` + 1 แถวใน `core.modules`**
เมนูและ App Launcher จะขึ้นเอง ไม่ต้องแก้โค้ดเมนู

## ⚠️ ตารางไม่ได้อยู่ใน schema `public`

ทุกตารางอยู่ใน schema ของโมดูล เวลาเรียกต้องระบุเสมอ:

```ts
supabase.schema('marketing').from('campaigns')   // ✅
supabase.from('campaigns')                       // ❌ หาไม่เจอ
```

## รันในเครื่อง

```bash
cp .env.example .env.local   # ใส่ค่าจริงจาก Supabase Dashboard → API
npm install
npm run dev
```

## ⚠️ ข้อจำกัดของ session ที่ใช้พัฒนา

Session พัฒนาบน Claude Code **เข้า `*.supabase.co` ไม่ได้** เพราะนโยบาย network ขององค์กร
(proxy ตอบว่า `connect_rejected — organization policy`)

แปลว่า **ทดสอบผ่านเบราว์เซอร์จากใน session ไม่ได้** ต้องทดสอบด้วยวิธีใดวิธีหนึ่ง:

1. **เพิ่ม `*.supabase.co` ใน Allowed domains ของ environment** แล้วเปิด session ใหม่
   (claude.ai/code → ไอคอนเมฆเหนือช่องพิมพ์ → เฟือง → Network access → Custom)
2. **Deploy ขึ้น Vercel แล้วทดสอบจากเครื่องจริง** — เซิร์ฟเวอร์ Vercel เข้า Supabase ได้ปกติ

สิ่งที่ทดสอบได้จาก session: `npm run build` · typecheck · ตรรกะฐานข้อมูลทั้งหมด (ผ่าน MCP)
