/**
 * รอบสรุปคลังความรู้รายสัปดาห์ (Vercel Cron · ดู vercel.json)
 * Vercel ส่ง Authorization: Bearer <CRON_SECRET> มาเอง · ไม่ตรง = ปฏิเสธ
 * ปุ่ม "สรุปตอนนี้" ในหน้า /knowledge ไม่ได้ใช้ทางนี้ (เรียก runDigest ตรงๆ หลังเช็กสิทธิ์ Bay)
 * ผลทุกข้อเป็นร่าง · Bay ต้องยืนยันก่อนบอทหรือ FAQ ใช้ (R4)
 */
import { NextResponse } from 'next/server';
import { runDigest } from '@/modules/line-agent/kb-digest';

export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return new NextResponse('unauthorized', { status: 401 });
  }
  return NextResponse.json(await runDigest('ตั้งเวลา'));
}
