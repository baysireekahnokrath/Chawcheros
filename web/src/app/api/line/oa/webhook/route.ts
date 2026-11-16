/**
 * webhook ของ LINE @chawcher (OA ที่ลูกค้าทัก) · ตั้งใน LINE Developers ว่า
 *   https://chawcher-os.vercel.app/api/line/oa/webhook
 * คนละตัวกับ /api/line/webhook ของบอท Team Bay · ใช้ key คนละชุด (LINE_OA_*)
 *
 * หน้าที่เดียว: ข้อความตัวอักษรจากลูกค้า → เปิด/อัปเดตแถวในรายการคนสนใจ
 *   - ไม่ตอบลูกค้า ไม่ส่งอะไรออกไปที่ LINE เลย
 *   - ตอบ 200 เสมอและตอบทันที แล้วค่อยบันทึกใน after()
 *     (ตอบอย่างอื่น LINE จะส่งซ้ำ/ขึ้นว่า webhook ล้ม ทั้งที่เราแค่ไม่ต้องการเหตุการณ์นั้น)
 *   - ยังไม่ได้ใส่ key ใน Vercel = ตอบ 200 แล้วไม่ทำอะไร · deploy ก่อนตั้งค่าได้ ไม่มีผลข้างเคียง
 *   - ลายเซ็นไม่ผ่าน = ตอบ 200 แล้วทิ้ง ไม่แตะฐานข้อมูล
 * หน้านี้ไม่ต้องล็อกอิน (ยกเว้นไว้ใน middleware) · ของจริงกันด้วยลายเซ็น
 */
import { after, NextResponse } from 'next/server';
import { verifySignature } from '@/modules/line-agent/line';
import { handleOaEvent, oaConfig, type OaEvent } from '@/modules/leads/line-oa';

export const maxDuration = 30;

const ok = () => NextResponse.json({ ok: true });

export async function POST(request: Request) {
  const cfg = oaConfig();
  if (!cfg) return ok();

  let raw = '';
  try {
    raw = await request.text();
  } catch {
    return ok();
  }
  if (!verifySignature(raw, request.headers.get('x-line-signature'), cfg.secret)) return ok();

  let events: OaEvent[] = [];
  try {
    const body = JSON.parse(raw) as { events?: OaEvent[] };
    events = Array.isArray(body.events) ? body.events : [];
  } catch {
    return ok();
  }

  // ปุ่ม Verify ใน LINE Developers ส่ง events ว่าง · ตอบ 200 ให้ผ่าน
  if (events.length > 0) {
    after(async () => {
      for (const ev of events) {
        try {
          await handleOaEvent(ev, cfg);
        } catch (e) {
          // log แค่รหัสเหตุการณ์กับชนิดของ error · ไม่มีข้อความลูกค้า
          console.error('leads-oa', ev?.webhookEventId ?? '-', e instanceof Error ? e.message : 'error');
        }
      }
    });
  }
  return ok();
}
