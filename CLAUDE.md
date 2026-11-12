# Chaw Cher OS · กฎสำหรับ Claude ทุก session

ไฟล์นี้ถูกโหลดอัตโนมัติทุก session · อ่านแล้วทำตามทุกข้อ · Bay ไม่ควรต้องบอกเรื่องเดิมซ้ำ

## 1 · ก่อนสร้างหรือแก้อะไร ต้องหาของเดิมก่อน (Bay 2026-11-12: "ทำไมทำผิดซ้ำๆ")

ห้ามสร้างจากความจำ · ค้นในเอกสารก่อนเสมอ:

1. `docs/decisions-log.md` · ทุกเรื่องที่ Bay ตัดสินแล้ว (ห้ามถามซ้ำ)
2. `docs/working-method.md` · ทำทีละด่าน
3. เอกสารของโมดูลนั้นใน `docs/modules/<ชื่อ>/` · โดยเฉพาะไฟล์ `*-status.md` ล่าสุด
4. ใช้ `grep -rn "<คำสำคัญ>" docs` หา pattern/แบบที่ Bay เคยให้ไว้ ก่อนออกแบบเอง

### ของที่ Bay ให้ไว้แล้ว และเคยพลาดมาแล้ว

| เรื่อง | ต้องใช้ | อยู่ที่ |
|---|---|---|
| **ตอบราคาลูกค้า** | ข้อความตามแบบนี้เป๊ะ ห้ามแต่งเอง: `<Full name> ราคา <เต็ม> ลด <x>% เหลือ <หลังลด> ชำระเป็นเงินสด ลด on top เพิ่ม <y>% เหลือ <สุดท้าย> ภายใน เดือน<เดือนนี้ พ.ศ.> และส่วนลดเพิ่มเติมตามโปรฯ ได้ที่ https://chawcher.com/category/promotion/` | D13 · `docs/price-list-analysis.md` หัวข้อ 3 · คอลัมน์ "ราคา งานไม้ โซฟา - Answer Customer" ใน `docs/source/standard-price-2026-grid-view.csv` |
| สูตรราคา | ราคาเต็ม × (1−%ลด) × (1−%on top) · ขั้นบันได 50,000 +12% · 100,000 +18% | J5 · J9 ใน decisions-log |
| ไฟล์ที่ Bay ส่งให้ (Google Sheet ฯลฯ) | **อ่านอย่างเดียว ห้ามแก้เด็ดขาด** · ไม่คัดข้อมูลลูกค้าลง repo | B40 |
| ต้นทุน/กำไร | ไม่เข้าบอท ไม่เข้าห้อง LINE เด็ดขาด | กฎ AI 4-5 |
| AI กับลูกค้า | AI ร่าง คนกดส่ง · ยกเว้นข้อความ template ที่ Bay อนุมัติ | กฎ AI 1 · `docs/modules/line-agent/7-status.md` |

## 2 · คุยกับ Bay

- ภาษาไทย · สั้น · **ทีละขั้น** (step by step) เมื่อให้ Bay ไปกดอะไร
- ถามน้อยที่สุด · ข้อที่ตัดสินแทนได้ด้วยค่าที่ปลอดภัย ให้ตัดสินแล้วบอก
- **ลิงก์ต้องกดได้เสมอ** เขียนเป็น `[ข้อความ](https://...)` · **ห้ามใส่ลิงก์ในกล่องโค้ด** ห้ามให้ Bay ก๊อปไปวางเอง
  - ลิงก์ที่ใช้บ่อย:
    - Supabase SQL Editor: [เปิด SQL Editor](https://supabase.com/dashboard/project/iblnlzttabwuydgcmqts/sql/new)
    - Merge โค้ดขึ้นเว็บ: [เปิดหน้า merge](https://github.com/baysireekahnokrath/Chawcheros/compare/claude/chaw-cher-os-setup-9k21w6...claude/lucid-carson-uely21) (เปลี่ยนชื่อ branch ตาม session)
    - ไฟล์ migration: `https://github.com/baysireekahnokrath/Chawcheros/blob/<branch>/supabase/migrations/<ไฟล์>`
    - เว็บระบบ: [chawcher-os.vercel.app](https://chawcher-os.vercel.app) · หลังบ้านบอท [/line](https://chawcher-os.vercel.app/line)
- ซื่อตรง: ยังไม่ได้ทดสอบจริงต้องบอก · พลาดต้องยอมรับ แล้วบอกว่าจะกันไม่ให้พลาดซ้ำยังไง

## 3 · ส่งงาน

- ทดสอบ SQL ในเครื่องก่อนทุกครั้ง: `supabase/tests/README.md`
- web: `npx tsc --noEmit` · `npx eslint` · `npx next build` (ใน `web/`)
- ทุก migration ใหม่ Bay ต้องวางใน Supabase เอง → ให้ลิงก์ไฟล์ + ลิงก์ SQL Editor ที่กดได้
- เขียนสถานะล่าสุดลง `docs/modules/<โมดูล>/*-status.md` ก่อนจบ session
