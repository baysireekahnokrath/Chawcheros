import CostDemo from '@/components/production/CostDemo';

export const metadata = { title: 'COST (ตัวทดลอง) · Chaw Cher OS' };

/**
 * หน้าจำลองโปรแกรม COST ของโรงงาน บนเว็บ · /cost-demo
 *
 * Bay 2026-11-16: "ทำ mockup ให้เหมือนกับว่าเค้าใช้งานใน Access แต่ใช้บนเว็บ
 *                  เราจะยังไม่เปลี่ยนวิธีการใช้งานเค้า ให้เค้าลองไปใช้ก่อน"
 *
 * ยังไม่ต่อฐานข้อมูล ไม่เขียนอะไรลงที่ไหน · ใช้ตัวอย่าง 3 สูตรที่คัดจากไฟล์จริง
 * อยู่ในกลุ่ม (app) จึงต้องล็อกอิน — ถ้าจะให้โรงงานเปิดได้เลยโดยไม่ล็อกอิน
 * ต้องเพิ่มทางผ่านใน middleware ซึ่งเป็นการเปิดสู่ภายนอก ต้องให้ Bay ยืนยันก่อน
 */
export default function CostDemoPage() {
  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight">COST · ตัวทดลองบนเว็บ</h1>
      <p className="mt-1 mb-4 text-sm text-muted">
        หน้าตาและขั้นตอนเหมือนโปรแกรมเดิมในโรงงานทุกอย่าง · เปิดจากมือถือได้ ·
        ยังไม่ได้ต่อฐานข้อมูลจริง กดบันทึกแล้วไม่เก็บ
      </p>
      <CostDemo />
    </>
  );
}
