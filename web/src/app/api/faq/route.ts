/**
 * ข้อมูล FAQ สาธารณะ (JSON) · ให้ chawcher.com ดึงไปแสดงเอง (Bay เลือกข้อ 2 ก · 2026-11-11)
 *   GET /api/faq              → { updated_at, items: [{ id, category, q, a, updated_at }], jsonld }
 * เปิดสาธารณะ ไม่ต้องล็อกอิน · มีเฉพาะข้อที่ Bay ยืนยัน + ติ๊กสาธารณะ · ไม่มีชื่อลูกค้า ไม่มีข้อมูลภายใน
 * แคช 5 นาที (แก้ใน /knowledge แล้วเว็บแบรนด์เห็นภายใน ~5 นาที)
 */
import { faqJsonLd, getFaq } from '@/modules/line-agent/faq';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS' };

export async function GET() {
  try {
    const faq = await getFaq();
    return Response.json({ ...faq, jsonld: faqJsonLd(faq.items) }, {
      headers: { ...CORS, 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600' },
    });
  } catch (e) {
    console.error('faq', e);
    return Response.json({ error: 'faq_unavailable' }, { status: 502, headers: { ...CORS, 'Cache-Control': 'no-store' } });
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}
