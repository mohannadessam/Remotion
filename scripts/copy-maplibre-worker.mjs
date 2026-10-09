// MapLibre v6 loads its web worker from a separate module next to its main bundle,
// which Next's bundler doesn't emit. Serve it from public/ instead (see truck-map.tsx).
import { copyFileSync, mkdirSync } from "node:fs";

mkdirSync("public/maplibre", { recursive: true });
copyFileSync("node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs", "public/maplibre/maplibre-gl-worker.mjs");
