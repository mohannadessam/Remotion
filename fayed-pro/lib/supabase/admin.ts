import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// عميل بصلاحيات service_role — يتجاوز RLS.
// يُستخدم فقط داخل route handlers موثوقة (مثل webhook الاشتراك)، أبدًا في كود المتصفح.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
