import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL)
  : null;

const nextConfig: NextConfig = {
  // DEMO_MODE=true serves fixtures instead of Supabase (see src/lib/demo). Inlined for client code too.
  env: { DEMO_MODE: process.env.DEMO_MODE === "true" ? "true" : "false" },
  // Locale and session both come from cookies, so nearly every route is request-time.
  // Cache Components would force Suspense boundaries everywhere for no gain; see docs/decisions.md.
  cacheComponents: false,
  images: {
    remotePatterns: supabaseUrl
      ? [
          {
            protocol: supabaseUrl.protocol.replace(":", "") as "http" | "https",
            hostname: supabaseUrl.hostname,
            port: supabaseUrl.port,
            pathname: "/storage/v1/object/public/**",
          },
        ]
      : [],
    // Local Supabase serves images from 127.0.0.1, which the optimizer refuses by default.
    dangerouslyAllowLocalIP: process.env.NODE_ENV !== "production",
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default createNextIntlPlugin("./src/i18n/request.ts")(nextConfig);
