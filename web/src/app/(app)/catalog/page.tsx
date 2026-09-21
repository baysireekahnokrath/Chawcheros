import Link from 'next/link';
import { getCatalogCounts } from '@/modules/catalog/queries';

export const metadata = { title: 'สินค้า · Chaw Cher OS' };

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

export default async function CatalogPage() {
  const c = await getCatalogCounts();

  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight">สินค้า</h1>
      <p className="mt-1 text-sm text-muted">รุ่น · ตัวที่ขายจริง · SKU</p>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="รอตรวจ" value={c.รอตรวจ} tone={c.รอตรวจ > 0 ? 'text-warn' : ''} />
        <Stat label="อนุมัติแล้ว" value={c.อนุมัติแล้ว} />
        <Stat label="รุ่นที่ขายอยู่" value={c.รุ่นที่ขายอยู่} />
        <Stat label="ตัวที่ขายจริง" value={c.ตัวที่ขายจริง} />
      </div>

      <div className="mt-5 space-y-3">
        {c.รอตรวจ > 0 && (
          <Link
            href="/catalog/review"
            className="block rounded-2xl border border-warn/40 bg-warn/5 p-4"
          >
            <div className="font-medium text-warn">
              มีของรอตรวจ {c.รอตรวจ.toLocaleString('th-TH')} ตัว
            </div>
            <p className="mt-1 text-sm text-muted">
              อนุมัติแล้วถึงจะมี SKU · ถึงจะตั้งราคาได้ · ถึงจะจัดโปรได้
            </p>
          </Link>
        )}

        <Link href="/catalog/review" className="block rounded-2xl border border-border bg-surface p-4">
          <div className="font-medium">ตรวจและอนุมัติสินค้า</div>
          <p className="mt-0.5 text-sm text-muted">ตรวจทีละรุ่น ไม่ใช่ทีละแถว</p>
        </Link>

        <Link href="/catalog/import" className="block rounded-2xl border border-border bg-surface p-4">
          <div className="font-medium">อัปโหลดไฟล์ราคา</div>
          <p className="mt-0.5 text-sm text-muted">ไฟล์ .csv จาก Airtable</p>
        </Link>
      </div>

      {c.รอตรวจ === 0 && c.ตัวที่ขายจริง === 0 && (
        <p className="mt-5 rounded-2xl border border-border bg-surface p-4 text-sm text-muted">
          ยังไม่มีสินค้าในระบบเลย — เริ่มที่ &ldquo;อัปโหลดไฟล์ราคา&rdquo;
        </p>
      )}
    </>
  );
}
