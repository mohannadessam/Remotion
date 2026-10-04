import type { CapacitorConfig } from '@capacitor/cli';

// التطبيق يفتح الموقع المنشور (Vercel) داخل WebView: نفس الكود ونفس الحساب ونفس البيانات،
// وأي تحديث تنشره للموقع يوصل للتطبيق فورًا بدون تحديث من المتجر.
// اكتب رابط موقعك في FAYED_APP_URL قبل `npx cap sync` (نفس NEXT_PUBLIC_APP_URL).
const appUrl = process.env.FAYED_APP_URL;
if (!appUrl) {
  throw new Error('FAYED_APP_URL مو مضبوط. مثال: FAYED_APP_URL=https://fayed.app npx cap sync');
}

const config: CapacitorConfig = {
  appId: 'app.fayed.pro',
  appName: 'فائض',
  // صفحة احتياطية فقط (لو الموقع ما فتح أول مرة). المحتوى الفعلي من server.url
  webDir: 'www',
  server: {
    url: `${appUrl.replace(/\/$/, '')}/app/plan`,
    // لو ما فتح الموقع (ما فيه نت): صفحة www/index.html مع زر "حاول مرة ثانية".
    // روابط النطاقات الثانية تنفتح في متصفح الجوال لا داخل التطبيق (السلوك الافتراضي)
    errorPath: 'index.html',
  },
  // الخادم يعرف منها إن الطلب من التطبيق (lib/native.ts) فيخفي الدفع الخارجي
  appendUserAgent: 'FayedApp',
  backgroundColor: '#f7f6f2',
  android: {
    allowMixedContent: false,
  },
  ios: {
    contentInset: 'never',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 800,
      backgroundColor: '#f7f6f2',
      showSpinner: false,
    },
    // الصفحات فاتحة دائمًا: أيقونات شريط الحالة غامقة، والمحتوى يمتد تحت الأشرطة
    // ويبتعد عنها بـ env(safe-area-inset-*) في app/globals.css
    SystemBars: {
      insetsHandling: 'native',
      initialViewportFitValueHint: 'cover',
      style: 'LIGHT',
    },
  },
};

export default config;
