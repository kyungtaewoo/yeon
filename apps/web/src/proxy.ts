import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  // Supabase 연결 전까지 패스스루
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
