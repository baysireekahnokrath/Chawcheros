import Link from 'next/link';
import { getStockCounts, getStockToday } from '@/modules/stock/queries';

export const metadata = { title: 'คลัง · Chaw Cher OS' };

function Stat({ label, value, tone = '' }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className={`text-2xl font-semibold tabular-nums ${tone}`}>
        {value.toLocaleString('th-TH')}
      </div>
      <div className="mt-0.5 text-xs text-muted">{label}</div>
    </div>
  );
}

export default async function StockPage() {
  const [c, today] = await Promise.all([getStockCounts(), getStockToday()]);
  const overdue = today.filter((t) => t.หมวด === 'เลยกำหนดคืน');
  const soon = today.filter((t) => t.หมวด === 'ใกล้ถึงกำหนดคืน');
  const flawed = today.filter((t) => t.หมวด === 'ของมีตำหนิ รอจัดการ');

  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight">คลัง</h1>
      <p className="mt-1 text-sm text-muted">นับเป็นตัว ไม่ใช่จำนวน</p>

      {/* งานวันนี้มาก่อน — หน้าจอคือ "งานวันนี้" ไม่ใช่ฐานข้อมูล */}
      {today.length > 0 && (
        <section className="mt-5">
          <h2 className="mb-2 text-sm font-medium">งานวันนี้</h2>
          <div className="space-y-2">
            {overdue.length > 0 && (
              <Link
                href="/stock/overdue"
                className="block rounded-2xl border border-danger/40 bg-danger/5 p-4"
              >
                <div className="font-medium text-danger">
                  เลยกำหนดคืนแล้ว {overdue.length} ตัว
                </div>
                <p className="mt-1 text-sm text-muted">
                  ของที่อยู่ในมือคนอื่นโดยไม่มีใครตาม — กดดูว่าตัวไหนจมเงินมากที่สุด
                </p>
              </Link>
            )}
            {soon.map((t) => (
              <div key={t.ref_id} className="rounded-xl border border-warn/40 bg-warn/5 px-4 py-3 text-sm">
                <span className="text-warn">ใกล้ถึงกำหนดคืน</span> · {t.เรื่อง}
                {t.เลยมากี่วัน !== null && (
                  <span className="text-muted"> (อีก {Math.abs(t.เลยมากี่วัน)} วัน)</span>
                )}
              </div>
            ))}
            {flawed.map((t) => (
              <div key={t.ref_id} className="rounded-xl border border-border bg-surface px-4 py-3 text-sm">
                <span className="text-muted">ของมีตำหนิ</span> · {t.เรื่อง}
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="ของทั้งหมด" value={c.ทั้งหมด} />
        <Stat label="พร้อมขาย" value={c.พร้อมขาย} tone="text-ok" />
        <Stat label="ยืมออก" value={c.ยืมออก} />
        <Stat
          label="เลยกำหนดคืน"
          value={c.เลยกำหนดคืน}
          tone={c.เลยกำหนดคืน > 0 ? 'text-danger' : ''}
        />
      </div>

      <div className="mt-5 space-y-3">
        <Link href="/stock/scan" className="block rounded-2xl border border-accent bg-accent/5 p-4">
          <div className="font-medium text-accent">สแกนย้ายของ</div>
          <p className="mt-0.5 text-sm text-muted">
            ส่องกล้องที่สติกเกอร์ หรือพิมพ์รหัส — เลือกปลายทาง จบ
          </p>
        </Link>

        <Link href="/stock/receive" className="block rounded-2xl border border-border bg-surface p-4">
          <div className="font-medium">รับของเข้า + พิมพ์สติกเกอร์</div>
          <p className="mt-0.5 text-sm text-muted">รับทีละหลายตัว ระบบออกรหัสให้ครบ</p>
        </Link>

        <Link href="/stock/on-hand" className="block rounded-2xl border border-border bg-surface p-4">
          <div className="font-medium">มีอะไรอยู่ที่ไหน</div>
          <p className="mt-0.5 text-sm text-muted">นับสดจากของจริงทุกครั้ง</p>
        </Link>

        {c.เลยกำหนดคืน === 0 && (
          <Link href="/stock/overdue" className="block rounded-2xl border border-border bg-surface p-4">
            <div className="font-medium">ของที่ยืมออก</div>
            <p className="mt-0.5 text-sm text-muted">ยังไม่มีตัวไหนเลยกำหนด</p>
          </Link>
        )}
      </div>

      {c.ทั้งหมด === 0 && (
        <p className="mt-5 rounded-2xl border border-border bg-surface p-4 text-sm text-muted">
          ยังไม่มีของในคลังเลย — เริ่มที่ &ldquo;รับของเข้า&rdquo; แล้วพิมพ์สติกเกอร์ไปติด
        </p>
      )}
    </>
  );
}
