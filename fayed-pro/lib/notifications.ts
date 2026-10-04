import type { SupabaseClient } from '@supabase/supabase-js';

export type NotificationKind = 'monthly_report' | 'monthly_reminder' | 'milestone';

/**
 * يحجز إشعارًا قبل إرساله. يرجع true لو هذا أول مرة (أرسِل)، و false لو سبق إرساله (تجاهل).
 * الحجز قبل الإرسال يمنع التكرار حتى لو اشتغل الكرون مرتين بنفس الوقت.
 * يحتاج عميل service_role لأن الجدول بلا سياسات RLS للمستخدمين.
 */
export async function claimNotification(
  admin: SupabaseClient,
  userId: string,
  kind: NotificationKind,
  ref: string
): Promise<boolean> {
  const { error } = await admin
    .from('notifications_sent')
    .insert({ user_id: userId, kind, ref });
  if (!error) return true;
  if (error.code === '23505') return false; // unique violation — أُرسل من قبل
  throw error;
}

/** يلغي الحجز لو فشل الإرسال، عشان تنجح المحاولة القادمة */
export async function releaseNotification(
  admin: SupabaseClient,
  userId: string,
  kind: NotificationKind,
  ref: string
): Promise<void> {
  await admin
    .from('notifications_sent')
    .delete()
    .match({ user_id: userId, kind, ref });
}
