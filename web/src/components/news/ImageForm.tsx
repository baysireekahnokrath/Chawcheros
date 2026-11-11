'use client';

/**
 * ฟอร์มที่มีรูป · ย่อรูปในเบราว์เซอร์ก่อนส่ง (ด้านยาว 1600px · JPEG) ให้ไม่เกินเพดานของ server action (4MB)
 * รูปจากมือถือ 3-5MB ต่อรูป → เหลือ ~300KB · ส่งได้หลายรูปในครั้งเดียว
 */
import { useState, type ReactNode } from 'react';

const MAX_SIDE = 1600;

async function shrink(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) return file;
  const k = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * k); canvas.height = Math.round(bmp.height * k);
  canvas.getContext('2d')?.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.85));
  if (!blob) return file;
  return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
}

export default function ImageForm({ action, children, className }: {
  action: (fd: FormData) => Promise<void>; children: ReactNode; className?: string;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <form
      className={className}
      action={async (fd) => {
        setBusy(true);
        try {
          const files = fd.getAll('images').filter((f): f is File => f instanceof File && f.size > 0);
          fd.delete('images');
          for (const f of files.slice(0, 10)) fd.append('images', await shrink(f));
          await action(fd);
        } finally {
          setBusy(false);
        }
      }}
    >
      <fieldset disabled={busy} className="contents">{children}</fieldset>
      {busy && <p className="mt-2 text-xs text-muted">กำลังทำงาน… (ร่างด้วย AI ใช้เวลาราว 10-30 วินาที)</p>}
    </form>
  );
}
