/**
 * ค่าคงที่ที่ทั้งฝั่งเซิร์ฟเวอร์และฝั่งหน้าจอใช้ร่วมกัน
 *
 * แยกไฟล์นี้ออกมาเพราะ queries.ts เรียก next/headers ซึ่งใช้ในคอมโพเนนต์
 * ฝั่งหน้าจอไม่ได้ · เคยพังมาแล้วตอนทำโมดูลคอนเทนต์
 */
export const CHANNELS = ['ขายตรง', 'NocNoc', 'ASE', 'อื่นๆ'] as const;

export const PAYMENT_METHODS = [
  'โอน SCB/TTB',
  'บัตรเครดิต',
  'ผ่าน ASE',
  'NocNoc',
  'เงินสด',
  'อื่นๆ',
] as const;

export const baht = (n: number | null | undefined) =>
  n === null || n === undefined
    ? '—'
    : n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
