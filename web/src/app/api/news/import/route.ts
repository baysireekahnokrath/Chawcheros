/**
 * ดึงแท็บ "ร่าง" ของชีต Chaw Cher News ทุกเช้า 09:00 เวลาไทย (Vercel Cron 02:00 UTC · ดู vercel.json)
 * Claude ร่างลงชีตตอน 08:00 · ระบบดึงตามมาทีหลัง 1 ชั่วโมง · ไม่มีค่า API
 * Vercel ส่ง Authorization: Bearer <CRON_SECRET> มาเอง · ไม่ตรง = ปฏิเสธ
 * ผลทุกชิ้นเป็นร่าง · ขึ้นเว็บ/ส่ง LINE ต้องให้ Bay กดในหน้า /news
 */
import { NextResponse } from 'next/server';
import { importFromSheet } from '@/modules/news/sheet';

export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return new NextResponse('unauthorized', { status: 401 });
  }
  return NextResponse.json(await importFromSheet('ตั้งเวลา'));
}
