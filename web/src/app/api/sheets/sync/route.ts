/**
 * ดึง Google Sheet ตามเวลา (Vercel Cron · ดู vercel.json)
 * Vercel ส่ง Authorization: Bearer <CRON_SECRET> มาเอง · ไม่ตรง = ปฏิเสธ
 * ปุ่ม "ดึงตอนนี้" ในหน้า /line ไม่ได้ใช้ทางนี้ (เรียก syncAll ตรงๆ หลังเช็กสิทธิ์ Bay)
 */
import { NextResponse } from 'next/server';
import { syncAll } from '@/modules/sheets/sync';

export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return new NextResponse('unauthorized', { status: 401 });
  }
  return NextResponse.json(await syncAll());
}
