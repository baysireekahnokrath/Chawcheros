/**
 * ค้นข่าว Chaw Cher + ASE ทุกเช้า 08:00 เวลาไทย (Vercel Cron 01:00 UTC · ดู vercel.json)
 * Vercel ส่ง Authorization: Bearer <CRON_SECRET> มาเอง · ไม่ตรง = ปฏิเสธ
 * ผลทุกชิ้นเป็นร่าง · ขึ้นเว็บ/ส่ง LINE ต้องให้ Bay กดในหน้า /news
 * ปุ่ม "ค้นข่าวตอนนี้" ในหน้า /news ไม่ได้ใช้ทางนี้ (เรียก collectNews ตรงๆ หลังเช็กสิทธิ์ Bay)
 */
import { NextResponse } from 'next/server';
import { collectNews } from '@/modules/news/ai';

export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return new NextResponse('unauthorized', { status: 401 });
  }
  return NextResponse.json(await collectNews('ตั้งเวลา'));
}
