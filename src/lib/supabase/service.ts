import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client (bypasses RLS). SERVER-ONLY: never import this
 * into a client component. Used for reading the notification recipients list,
 * which regular visitors must never be able to see.
 */
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}