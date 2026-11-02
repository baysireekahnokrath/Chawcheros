/**
 * ปลายทาง webhook ของ LINE · ตั้งใน LINE Developers ว่า https://<โดเมน>/api/line/webhook
 *
 * ตรวจลายเซ็นก่อนทุกอย่าง (LR-1) · ตอบ 200 ทันที แล้วค่อยทำงานต่อใน after()
 * เพื่อไม่ให้ LINE รอนาน · หน้านี้ไม่ต้องล็อกอิน (ยกเว้นไว้ใน middleware)
 */
import { after, NextResponse } from 'next/server';
import { handleEvent } from '@/modules/line-agent/handle';
import { lineSecrets, verifySignature, type LineEvent } from '@/modules/line-agent/line';

export const maxDuration = 60;

export async function POST(request: Request) {
  const keys = lineSecrets();
  if (!keys) return new NextResponse('LINE ยังไม่ได้ตั้งค่า', { status: 503 });

  const raw = await request.text();
  if (!verifySignature(raw, request.headers.get('x-line-signature'), keys.secret)) {
    return new NextResponse('bad signature', { status: 401 });
  }

  let events: LineEvent[] = [];
  try {
    events = (JSON.parse(raw) as { events?: LineEvent[] }).events ?? [];
  } catch {
    return new NextResponse('bad json', { status: 400 });
  }

  after(async () => {
    for (const ev of events) {
      try {
        await handleEvent(ev, keys.token);
      } catch (e) {
        console.error('line-agent', ev.webhookEventId, e);
      }
    }
  });

  // ปุ่ม Verify ใน LINE Developers ส่ง events ว่าง · ตอบ 200 ให้ผ่าน
  return NextResponse.json({ ok: true });
}
