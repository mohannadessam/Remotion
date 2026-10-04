import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { hasProAccess, type SubscriptionRow } from '@/lib/subscription';

// كل الصفحات داخل (pro) تتطلب اشتراكًا فعّالًا. هذا حجب الواجهة؛
// الحجب الحقيقي للبيانات في سياسات RLS (has_pro_access في schema.sql).
export default async function ProLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('status, ends_at')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!hasProAccess(sub as SubscriptionRow | null)) redirect('/app/upgrade');

  return <>{children}</>;
}
