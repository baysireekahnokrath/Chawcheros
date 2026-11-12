import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/** ต่ออายุ session ทุก request และกันหน้าที่ต้องล็อกอิน */
export async function middleware(request: NextRequest) {
  // หน้า POS หน้าบูธเปิดสาธารณะ (ไม่ต้องล็อกอิน) · ฐานข้อมูลยอมให้แค่บันทึกบิลที่ใส่ PIN ถูก
  if (request.nextUrl.pathname === '/pos') return NextResponse.next();

  // หน้าจัดชุดฟีนิกซ์เปิดสาธารณะเหมือนกัน (Bay 2026-11-09 ขอแบบไม่ต้องล็อกอิน)
  // อ่านผ่าน pricing.phoenix_sheet() ที่คืนเฉพาะแถวฟีนิกซ์และไม่มีต้นทุน · ดู 0047
  if (request.nextUrl.pathname === '/phoenix') return NextResponse.next();

  // หน้าตั้งรหัสผ่านใหม่ · คนที่มาถึงยังไม่ได้ล็อกอิน (ของจริงกันที่ลิงก์ในอีเมล)
  if (request.nextUrl.pathname === '/reset') return NextResponse.next();

  // ลิงก์กู้รหัสผ่านหลงมาลงหน้าอื่น · เกิดได้ถ้า Site URL หรือ Redirect URLs ใน Supabase ยังไม่ถูก
  //
  // ★ ดักทั้งกรณีสำเร็จ (code) และกรณีลิงก์ใช้ไม่ได้ (error / error_code)
  //   Bay เจอของจริง 2026-11-12 · ลิงก์พาไปหน้าแรกพร้อม error=access_denied&error_code=otp_expired
  //   ถ้าไม่ดักกรณี error ด้วย คนกดจะเจอหน้าแรกเฉย ๆ ไม่รู้ว่าทำไมตั้งรหัสไม่ได้
  //   (ส่วนที่มาทางแฮช # เซิร์ฟเวอร์มองไม่เห็น · มี AuthHashCatcher ดักให้อีกชั้น)
  const sp = request.nextUrl.searchParams;
  if (sp.has('code') || sp.has('error') || sp.has('error_code')) {
    const url = request.nextUrl.clone();
    url.pathname = '/reset';   // ส่งต่อทั้งแถบ query · Supabase อาจแนบพารามิเตอร์อื่นมาด้วย
    return NextResponse.redirect(url);
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isLoginPage = request.nextUrl.pathname.startsWith('/login');

  if (!user && !isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  if (user && isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ['/((?!api/line/webhook|api/sheets/sync|api/kb/digest|api/news/import|api/faq|faq(?:/|$)|pos/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
