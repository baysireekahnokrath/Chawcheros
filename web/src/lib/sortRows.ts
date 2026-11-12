/**
 * เรียงแถวในเครื่อง แทนการสั่งเรียงที่ API
 *
 * ★ ทำไมต้องมีไฟล์นี้
 *   PostgREST แยกชื่อคอลัมน์ที่ไม่ใช่ ASCII ในพารามิเตอร์ order ไม่ออก
 *   `.order('หมวด')` จะได้ error กลับมาว่า "failed to parse order (หมวด.asc,...)"
 *   แล้ว supabase-js คืน data เป็น null · หน้าจอเห็นเป็น "ไม่มีข้อมูล"
 *   ทั้งที่ฐานข้อมูลมีครบ — พังเงียบ ไม่มีอะไรบอก
 *
 *   เราตั้งชื่อคอลัมน์ในวิวเป็นภาษาไทยทั้งระบบเพราะคนอ่านรู้เรื่องกว่า
 *   เลยต้องเรียงฝั่งนี้แทน · ถ้าต้อง .limit() ด้วย ให้สั่ง order ที่ API
 *   ด้วยคอลัมน์ ASCII สักตัว (เช่น created_at) เพื่อให้ตัดเอาชุดที่ถูกต้องมาก่อน
 */

export type SortSpec<T> = {
  key: (row: T) => string | number | null | undefined;
  desc?: boolean;
};

const collator = new Intl.Collator('th', { numeric: true, sensitivity: 'base' });

export function sortRows<T>(rows: T[], specs: SortSpec<T>[]): T[] {
  return [...rows].sort((a, b) => {
    for (const { key, desc } of specs) {
      const va = key(a);
      const vb = key(b);

      // ค่าว่างไปท้ายเสมอ ไม่ว่าจะเรียงขึ้นหรือลง · แถวที่ไม่มีข้อมูลไม่ควรมาอยู่บนสุด
      if (va == null && vb == null) continue;
      if (va == null) return 1;
      if (vb == null) return -1;

      const d =
        typeof va === 'number' && typeof vb === 'number'
          ? va - vb
          : collator.compare(String(va), String(vb));
      if (d !== 0) return desc ? -d : d;
    }
    return 0;
  });
}
