"use client";

import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "@/lib/db/types";
import { requireSupabaseConfig } from "@/lib/supabase/config";

let cached: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function createClient() {
  if (!cached) {
    const { url, key } = requireSupabaseConfig();
    cached = createBrowserClient<Database>(url, key);
  }
  return cached;
}
