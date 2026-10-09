// Public env vars are inlined at build time, so reference them statically.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
/** Optional MapLibre-compatible style URL; takes precedence over the Mapbox token. */
export const MAP_STYLE_URL = process.env.NEXT_PUBLIC_MAP_STYLE_URL || "";
/** Mapbox public token. Without it (and without MAP_STYLE_URL) the map falls back to a static view. */
export const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
export const HAS_INTERACTIVE_MAP = Boolean(MAP_STYLE_URL || MAPBOX_TOKEN);
