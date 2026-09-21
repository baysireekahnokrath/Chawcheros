import { Suspense } from 'react';
import LoginForm from '@/components/LoginForm';

export default function LoginPage() {
  return (
    <main className="min-h-dvh grid place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">ฌ เฌอ</h1>
          <p className="mt-1 text-sm text-muted">Chaw Cher OS</p>
        </div>

        {/* useSearchParams ต้องอยู่ใน Suspense ไม่งั้น build ไม่ผ่าน */}
        <Suspense
          fallback={<div className="h-72 rounded-2xl border border-border bg-surface" />}
        >
          <LoginForm />
        </Suspense>

        <p className="mt-6 text-center text-xs text-muted">
          ยังไม่มีบัญชี? ให้ผู้ดูแลระบบสร้างให้ — ระบบนี้ไม่เปิดสมัครเอง
        </p>
      </div>
    </main>
  );
}
