import Link from 'next/link';
import CustomerForm from '@/components/crm/CustomerForm';

export default function NewCustomerPage() {
  return (
    <>
      <Link href="/customers" className="text-sm text-muted">
        ← ลูกค้า
      </Link>
      <h1 className="mt-2 text-xl font-semibold tracking-tight">ลูกค้าใหม่</h1>
      <p className="mt-1 text-sm text-muted">
        สาขาและที่อยู่เพิ่มทีหลังได้ · ลูกค้ารายเดียวมีได้หลายสาขา
      </p>
      <CustomerForm />
    </>
  );
}
