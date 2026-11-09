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

  // ลิงก์กู้รหัสผ่านหลงมาลงหน้าอื่น · เกิดได้ถ้าลืมใส่ /reset ใน Redirect URLs ของ Supabase
  // ถ้าไม่ดักไว้ โค้ดจะหายไปกับการเด้งไปหน้า login แล้วตั้งรหัสใหม่ไม่ได้เลย
  if (request.nextUrl.searchParams.has('code')) {
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
  matcher: ['/((?!api/line/webhook|api/sheets/sync|pos/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
