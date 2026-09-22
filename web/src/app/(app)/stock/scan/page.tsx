import Link from 'next/link';
import ScanBox from '@/components/stock/ScanBox';

export const metadata = { title: 'สแกนย้ายของ · Chaw Cher OS' };

export default function ScanPage() {
  return (
    <>
      <Link href="/stock" className="text-sm text-muted">← คลัง</Link>
      <h1 className="mt-2 text-xl font-semibold tracking-tight">สแกนย้ายของ</h1>
      <p className="mt-1 mb-5 text-sm text-muted">
        วิธีที่เร็วที่สุดคือเปิดกล้องมือถือส่องที่สติกเกอร์ — มันจะเด้งลิงก์มาให้กดเลย
      </p>
      <ScanBox />
    </>
  );
}
