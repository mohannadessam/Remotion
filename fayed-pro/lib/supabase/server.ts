import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// عميل Supabase يُستخدم داخل Server Components و Route Handlers
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // يُستدعى من Server Component لا يقدر يكتب كوكيز — الـ middleware يكفي هنا
          }
        },
      },
    }
  );
}
