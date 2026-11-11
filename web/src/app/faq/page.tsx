import type { Metadata } from 'next';
import { Montserrat } from 'next/font/google';
import { byCategory, faqJsonLd, getFaq, type Faq } from '@/modules/line-agent/faq';

/**
 * FAQ สาธารณะ · /faq · ไม่ต้องล็อกอิน (middleware ปล่อยผ่าน)
 * ข้อมูลมาจากคลังความรู้เฉพาะข้อที่ Bay ยืนยันและติ๊กสาธารณะ (migration 0048) · ไม่มีชื่อลูกค้า ไม่มีข้อมูลภายใน
 * ที่แสดงจริงคือ chawcher.com (Bay เลือกข้อ 2 ก) · หน้านี้ใช้ได้ทั้งแบบเปิดตรง และฝังด้วย iframe · ข้อมูลดิบอยู่ที่ /api/faq
 *
 * ใช้ CI ของ CHAW CHER (docs/brand/README.md): Navy #2B4368 · Slate #2F4554 · Aqua #83B7BF · Taupe #958C7B · Off-white #F7F8F8
 * ฟอนต์ Montserrat 400/500 (แทน Gotham) + Noto Sans Thai (แทน Sukhumvit Set · โหลดไว้ที่ layout แล้ว) · ไม่มีเชิง ไม่มีสีเขียว
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'FAQ · CHAW CHER',
  description: 'คำถามที่พบบ่อยเกี่ยวกับสินค้าและบริการของ ฌ เฌอ',
};

const mont = Montserrat({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-mont' });

const C = { navy: '#2B4368', slate: '#2F4554', aqua: '#83B7BF', taupe: '#958C7B', off: '#F7F8F8' };

export default async function FaqPage() {
  let faq: Faq = { updated_at: null, items: [] };
  let failed = false;
  try { faq = await getFaq(); } catch (e) { console.error('faq page', e); failed = true; }
  const groups = byCategory(faq.items);

  return (
    <div className={mont.variable} style={{ background: C.off, color: C.navy, minHeight: '100vh', fontFamily: 'var(--font-thai), system-ui, sans-serif' }}>
      <header style={{ background: C.slate, color: '#fff' }}>
        <div className="mx-auto flex max-w-3xl flex-col items-center px-4 pt-10 pb-8 text-center">
          <div role="img" aria-label="CHAW CHER" style={{
            width: 44, height: 90, background: '#fff', WebkitMask: 'url(/brand/logo.svg) center / contain no-repeat',
            mask: 'url(/brand/logo.svg) center / contain no-repeat',
          }} />
          <h1 className="mt-5 text-2xl uppercase" style={{ fontFamily: 'var(--font-mont), var(--font-thai), sans-serif', fontWeight: 500, letterSpacing: '0.22em' }}>
            FAQ
          </h1>
          <p className="mt-2 text-sm" style={{ color: C.aqua }}>คำถามที่พบบ่อย</p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:py-10">
        {failed && <p className="text-sm" style={{ color: C.taupe }}>ขออภัย ตอนนี้โหลดข้อมูลไม่ได้ ลองใหม่อีกครั้งในภายหลังนะคะ</p>}
        {!failed && groups.length === 0 && <p className="text-sm" style={{ color: C.taupe }}>กำลังรวบรวมคำถามที่พบบ่อย เร็วๆ นี้ค่ะ</p>}

        {groups.map(([cat, items]) => (
          <section key={cat} className="mb-8">
            <h2 className="mb-3 pb-2 text-sm uppercase" style={{ borderBottom: `1px solid ${C.taupe}`, color: C.taupe, letterSpacing: '0.14em', fontWeight: 500 }}>{cat}</h2>
            <div className="space-y-2">
              {items.map((i) => (
                <details key={i.id} className="group rounded-xl bg-white px-4 py-3" style={{ border: `1px solid ${C.aqua}55` }}>
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-3" style={{ fontWeight: 500 }}>
                    <span>{i.q}</span>
                    <span aria-hidden className="mt-0.5 shrink-0 transition-transform group-open:rotate-45" style={{ color: C.aqua, fontSize: 20, lineHeight: 1 }}>+</span>
                  </summary>
                  <p className="mt-2 whitespace-pre-line text-sm leading-relaxed" style={{ color: C.slate }}>{i.a}</p>
                </details>
              ))}
            </div>
          </section>
        ))}

        <p className="mt-10 text-center text-xs" style={{ color: C.taupe }}>
          ไม่พบคำตอบที่ต้องการ? ติดต่อทีมงานได้ที่ LINE @chawcher
        </p>
      </main>

      {groups.length > 0 && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(faq.items)).replace(/</g, '\\u003c') }} />
      )}
    </div>
  );
}
