'use server';

import QRCode from 'qrcode';
import { createClient } from '@/lib/supabase/server';

export type Sticker = {
  unit_code: string;
  qr_svg: string;
  sku_display: string;
  collection: string;
  spec: string;
};

/**
 * สร้างสติกเกอร์สำหรับพิมพ์
 *
 * QR เก็บ "ลิงก์เต็ม" ไม่ใช่รหัสเปล่าๆ เพราะกล้องมือถือธรรมดาจะเด้งลิงก์ให้กดทันที
 * ถ้าเก็บแค่ U0000042 กล้องจะโชว์ข้อความเฉยๆ แล้วคนต้องมาพิมพ์ต่อเอง
 * ซึ่งแพ้ตั้งแต่ยังไม่เริ่ม — เอกสารบอกว่าการย้ายของต้องง่ายกว่าการไม่ย้าย
 */
export async function buildStickers(unitCodes: string[]): Promise<Sticker[]> {
  if (unitCodes.length === 0) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .schema('stock')
    .from('units')
    .select('unit_code,product_variants(sku,material_grade,wood_type,configuration,products(collection))')
    .in('unit_code', unitCodes);

  const rows = (data ?? []) as unknown as {
    unit_code: string;
    product_variants: {
      sku: string;
      material_grade: string | null;
      wood_type: string | null;
      configuration: string | null;
      products: { collection: string } | null;
    } | null;
  }[];

  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? 'https://chawcher-os.vercel.app';

  const order = new Map(unitCodes.map((c, i) => [c, i]));
  rows.sort((a, b) => (order.get(a.unit_code) ?? 0) - (order.get(b.unit_code) ?? 0));

  return Promise.all(
    rows.map(async (r) => {
      const v = r.product_variants;
      const sku = v?.sku ?? '';
      return {
        unit_code: r.unit_code,
        qr_svg: await QRCode.toString(`${base}/stock/u/${r.unit_code}`, {
          type: 'svg',
          margin: 0,
          errorCorrectionLevel: 'M',
        }),
        sku_display: sku ? `${sku.slice(0, 3)}.${sku.slice(3, 6)}.${sku.slice(6)}` : '—',
        collection: v?.products?.collection ?? '—',
        spec: [v?.material_grade, v?.wood_type, v?.configuration].filter(Boolean).join(' · '),
      };
    }),
  );
}
