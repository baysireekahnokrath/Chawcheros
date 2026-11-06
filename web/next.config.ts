import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // POS หน้าบูธ เป็นหน้า HTML ล้วนใน public/pos (ใช้ได้แม้เน็ตหลุด)
  async rewrites() {
    return [{ source: "/pos", destination: "/pos/index.html" }];
  },
};

export default nextConfig;
