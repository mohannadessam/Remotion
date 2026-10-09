import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/env";

let client: ReturnType<typeof createBrowserClient<Database>> | undefined;

export function createClient() {
  client ??= createBrowserClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  return client;
}
