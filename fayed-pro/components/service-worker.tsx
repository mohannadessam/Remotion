'use client';

import { useEffect } from 'react';

// يسجّل public/sw.js (صفحة "ما فيه اتصال" بدل شاشة خطأ المتصفح). ما يخزّن أي بيانات مالية.
export default function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch(() => {});
  }, []);
  return null;
}
