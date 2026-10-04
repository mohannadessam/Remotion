// نفس منطق دالة has_pro_access في supabase/schema.sql — حافظ على تطابقهما.

export interface SubscriptionRow {
  status: 'active' | 'inactive' | 'cancelled' | 'expired';
  ends_at: string | null;
}

export function hasProAccess(sub: SubscriptionRow | null | undefined, now = new Date()): boolean {
  if (!sub) return false;
  if (sub.status === 'active') return true;
  if (sub.status === 'cancelled' && sub.ends_at) return new Date(sub.ends_at) > now;
  return false;
}
