import { getPriceList } from '@/modules/pricing/queries';
import { buildSheets, type Sheet } from './build';

/**
 * data sheet ใช้ข้อมูลชุดเดียวกับใบราคา แล้วยุบเกรดวัสดุทิ้ง
 * error กับความว่างเปล่าส่งต่อออกมาตรง ๆ ไม่กลืน
 * (เคยพลาดมาแล้วตอนทำหน้าใบราคา หน้าจอขึ้น 0 รุ่น ทั้งที่ฐานข้อมูลมี 751 แถว)
 */
export async function getDataSheets(): Promise<{ sheets: Sheet[]; error: string | null }> {
  const { rows, error } = await getPriceList();
  if (error) return { sheets: [], error };
  return { sheets: buildSheets(rows), error: null };
}

export type { Sheet, Group, Module } from './build';
