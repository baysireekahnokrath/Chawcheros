import { getDataSheets } from '@/modules/datasheet/queries';
import DataSheet from '@/components/datasheet/DataSheet';

export const metadata = { title: 'Data Sheet · Chaw Cher OS' };

export default async function DataSheetPage() {
  const { sheets, error } = await getDataSheets();
  const modules = sheets.reduce((n, s) => n + s.modules, 0);

  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight">Data Sheet</h1>
      <p className="mt-1 mb-5 text-sm text-muted">
        สเปคสินค้าทุกรุ่น ขนาด วัสดุ และรหัส · สร้างจากข้อมูลเดียวกับใบราคา จึงไม่มีทางหลุดกัน ·
        ไม่มีราคาในแผ่น ส่งให้ดีลเลอร์หรือสถาปนิกได้เลย
      </p>

      {error && (
        <div className="mb-5 rounded-xl border border-danger/40 bg-danger/10 p-4 text-sm">
          <p className="font-semibold text-danger">อ่านสเปคจากระบบไม่ได้</p>
          <p className="mt-1 text-muted">
            ไม่ใช่ว่าไม่มีสินค้า แต่คำขอไปไม่ถึงข้อมูล · ข้อความจากระบบ:
          </p>
          <pre className="mt-2 overflow-x-auto rounded-lg bg-bg p-2 text-xs">{error}</pre>
        </div>
      )}

      {!error && sheets.length === 0 && (
        <div className="mb-5 rounded-xl border border-warn/40 bg-warn/10 p-4 text-sm">
          <p className="font-semibold text-warn">ระบบตอบกลับปกติ แต่ไม่มีสินค้าสักตัว</p>
          <p className="mt-1 text-muted">
            แปลว่าสิทธิ์อ่านผ่านแล้ว แต่ยังไม่มีรุ่นที่สถานะ &quot;ขายอยู่&quot; ในระบบ
          </p>
        </div>
      )}

      <DataSheet sheets={sheets} totalModules={modules} />
    </>
  );
}
