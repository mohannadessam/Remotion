import type { MetadataRoute } from 'next';

// يخلي الموقع قابل للتثبيت كتطبيق على الجوال (أندرويد: "تثبيت التطبيق"، آيفون: "إضافة إلى الشاشة الرئيسية")
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'فائض PRO',
    short_name: 'فائض',
    description: 'تتبّع خطتك المالية الشهرية وتطور صندوق الطوارئ عبر الزمن',
    id: '/',
    start_url: '/app/plan',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    lang: 'ar',
    dir: 'rtl',
    background_color: '#f7f6f2',
    theme_color: '#173f35',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
