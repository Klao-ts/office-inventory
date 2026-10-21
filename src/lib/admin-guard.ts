import { createClient } from "@/lib/supabase/server";

/** True only if the current request comes from a signed-in admin. */
export async function isAdminRequest() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return !!user && (user.app_metadata as { role?: string } | null)?.role === "admin";
}