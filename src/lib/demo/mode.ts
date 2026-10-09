/**
 * DEMO_MODE=true runs the app from local fixtures (src/lib/demo) with no Supabase or map keys.
 * Exposed to client bundles through next.config.ts `env`, so both sides read the same flag.
 */
export const DEMO_MODE = process.env.DEMO_MODE === "true";

/** Cookie holding the demo user's profile id (demo sign-in, no Supabase Auth). */
export const DEMO_SESSION_COOKIE = "trukni_demo_uid";
