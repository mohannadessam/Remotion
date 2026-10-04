import type { SupabaseClient, User } from '@supabase/supabase-js';
import { hasProAccess, type SubscriptionRow } from './subscription';

/** للمسارات الخادمية: يرجع المستخدم لو مسجّل وله حق البرو، أو سبب الرفض */
export async function requirePro(
  supabase: SupabaseClient
): Promise<{ user: User } | { error: string; status: 401 | 403 }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'غير مسجّل دخول', status: 401 };
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('status, ends_at')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!hasProAccess(sub as SubscriptionRow | null)) return { error: 'يتطلب اشتراك PRO', status: 403 };
  return { user };
}
