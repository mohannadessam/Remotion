import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// يستقبل هذا المسار طلب رابط الدخول السحري (magic link) ويبادله بجلسة فعلية
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/app/plan';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
