/**
 * webhook ของ LINE @chawcher (OA ลูกค้า) · ตั้งใน LINE Developers ว่า https://<โดเมน>/api/line/oa/webhook
 *
 * หน้าที่เดียว: นับคนแจ้งมาถึงโชว์รูม · ไม่ตอบลูกค้า (OA-6)
 * ตรวจลายเซ็นด้วย secret ของ @chawcher ก่อนทุกอย่าง · ตอบ 200 ทันทีแล้วค่อยบันทึกใน after()
 * หน้านี้ไม่ต้องล็อกอิน (ยกเว้นไว้ใน middleware)
 */
import { after, NextResponse } from 'next/server';
import { verifySignature } from '@/modules/line-agent/line';
import { handleOaEvent, oaSecrets, type OaEvent } from '@/modules/line-oa/arrivals';

export async function POST(request: Request) {
  const keys = oaSecrets();
  if (!keys) return new NextResponse('LINE @chawcher ยังไม่ได้ตั้งค่า', { status: 503 });

  const raw = await request.text();
  if (!verifySignature(raw, request.headers.get('x-line-signature'), keys.secret)) {
    return new NextResponse('bad signature', { status: 401 });
  }

  let events: OaEvent[] = [];
  try {
    events = (JSON.parse(raw) as { events?: OaEvent[] }).events ?? [];
  } catch {
    return new NextResponse('bad json', { status: 400 });
  }

  after(async () => {
    for (const ev of events) {
      try {
        await handleOaEvent(ev, keys.token);
      } catch (e) {
        console.error('line-oa', ev.webhookEventId, e);
      }
    }
  });

  // ปุ่ม Verify ใน LINE Developers ส่ง events ว่าง · ตอบ 200 ให้ผ่าน
  return NextResponse.json({ ok: true });
}
