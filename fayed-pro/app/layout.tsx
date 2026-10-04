import type { Metadata, Viewport } from "next";
import "./globals.css";
import ServiceWorker from "@/components/service-worker";

export const metadata: Metadata = {
  title: "فائض PRO",
  description: "تتبّع خطتك المالية الشهرية وتطور صندوق الطوارئ عبر الزمن",
  applicationName: "فائض",
  appleWebApp: { capable: true, title: "فائض", statusBarStyle: "default" },
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#173f35",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ar" dir="rtl" className="h-full antialiased">
      <body
        className="min-h-full flex flex-col"
        style={{ fontFamily: 'Arial, Tahoma, sans-serif' }}
      >
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
