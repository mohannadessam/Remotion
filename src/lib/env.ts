// Public env vars are inlined at build time, so reference them statically.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
/** Optional MapLibre/Mapbox-compatible style URL. Falls back to a built-in raster style. */
export const MAP_STYLE_URL = process.env.NEXT_PUBLIC_MAP_STYLE_URL || "";
