import Link from 'next/link';
import { getProducts, getMaterialGrades, getProductVariants } from '@/modules/catalog/queries';
import ProductList from '@/components/catalog/ProductList';

export const metadata = { title: 'สินค้าในระบบ · Chaw Cher OS' };

export default async function ProductsPage() {
  const [products, grades] = await Promise.all([getProducts(), getMaterialGrades()]);

  async function loadVariants(productId: string) {
    'use server';
    return getProductVariants(productId);
  }

  return (
    <>
      <Link href="/catalog" className="text-sm text-muted">← สินค้า</Link>
      <h1 className="mt-2 text-xl font-semibold tracking-tight">สินค้าในระบบ</h1>
      <p className="mt-1 mb-5 text-sm text-muted">
        {products.length} รุ่น · กางดูตัวที่ขายจริงและราคา · เพิ่มเกรดวัสดุที่ไฟล์ราคาไม่มีได้ที่นี่
      </p>

      <ProductList products={products} grades={grades} loadVariants={loadVariants} />
    </>
  );
}
