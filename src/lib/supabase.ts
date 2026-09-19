import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database";
let client: SupabaseClient<Database> | undefined;
export function supabase() {
  if (!client)
    client = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          storageKey: "atraction-auth",
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      },
    );
  return client;
}
