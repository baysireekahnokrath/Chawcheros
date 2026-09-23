'use client';

import { useState } from 'react';
import Link from 'next/link';

/** ปุ่ม + ลอยมุมจอ · ไอเดียด่วน หรือ ตั้งงานแบบเต็ม (แก้หลังดู mockup รอบ 2) */
export default function NewMenu() {
  const [open, setOpen] = useState(false);
  return (
    <div className="fixed bottom-5 right-5 z-20 flex flex-col items-end gap-2">
      {open && (
        <div className="w-56 overflow-hidden rounded-2xl border border-border bg-surface shadow-lg">
          <Link href="/content/idea" className="block px-4 py-3 text-sm hover:bg-bg">
            <div className="font-medium">ไอเดียด่วน</div>
            <div className="text-xs text-muted">พิมพ์ประโยคเดียว agent เขียนให้</div>
          </Link>
          <Link href="/content/new" className="block border-t border-border px-4 py-3 text-sm hover:bg-bg">
            <div className="font-medium">ตั้งงานแบบเต็ม</div>
            <div className="text-xs text-muted">กรอก brief เอง</div>
          </Link>
        </div>
      )}
      <button onClick={() => setOpen(!open)} aria-expanded={open} aria-label="สร้างงานใหม่"
        className="grid h-14 w-14 place-items-center rounded-full bg-accent text-2xl text-accent-fg shadow-lg">
        {open ? '×' : '+'}
      </button>
    </div>
  );
}
