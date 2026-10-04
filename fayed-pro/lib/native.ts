import { headers } from 'next/headers';

// تطبيق الجوال (mobile/capacitor.config.ts) يضيف هذا لـ User-Agent، فالخادم يعرف إن الطلب من داخل التطبيق.
export const NATIVE_UA_MARKER = 'FayedApp';

export async function isNativeApp() {
  return (await headers()).get('user-agent')?.includes(NATIVE_UA_MARKER) ?? false;
}
