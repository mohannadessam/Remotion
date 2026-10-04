import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// حذف الحساب نهائيًا (مطلوب من App Store وGoogle Play لأي تطبيق فيه تسجيل حساب).
// كل جداول المستخدم مربوطة بـ auth.users بـ on delete cascade، فحذف المستخدم يمسح بياناته كلها.
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'سجّل دخولك أول' }, { status: 401 });

  const { error } = await createAdminClient().auth.admin.deleteUser(user.id);
  if (error) return NextResponse.json({ error: 'تعذّر حذف الحساب' }, { status: 500 });

  // الجلسة صارت لمستخدم محذوف؛ نمسح كوكيزها
  await supabase.auth.signOut().catch(() => {});
  return NextResponse.json({ deleted: true });
}
