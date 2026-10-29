import Link from 'next/link';
import { getCustomerPicker } from '@/modules/crm/queries';
import OrderForm from '@/components/sales/OrderForm';

export default async function NewOrderPage() {
  const customers = await getCustomerPicker();

  return (
    <>
      <Link href="/orders" className="text-sm text-muted">
        ← ออเดอร์
      </Link>
      <h1 className="mt-2 text-xl font-semibold tracking-tight">ออเดอร์ใหม่</h1>

      {customers.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-border bg-surface p-4 text-sm text-muted">
          ยังไม่มีลูกค้าในระบบ —{' '}
          <Link href="/customers/new" className="text-accent underline">
            สร้างลูกค้าก่อน
          </Link>
        </p>
      ) : (
        <OrderForm customers={customers} />
      )}
    </>
  );
}
