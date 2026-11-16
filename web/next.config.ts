import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // หน้า /news ส่งรูปผ่าน server action (ย่อในเบราว์เซอร์แล้ว ~300KB/รูป) · Vercel รับได้ไม่เกิน 4.5MB
  experimental: { serverActions: { bodySizeLimit: '4mb' } },
  // POS หน้าบูธ เป็นหน้า HTML ล้วนใน public/pos (ใช้ได้แม้เน็ตหลุด)
  async rewrites() {
    return [{ source: "/pos", destination: "/pos/index.html" }];
  },
};

export default nextConfig;
