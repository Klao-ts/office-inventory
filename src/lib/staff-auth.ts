import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { Branch } from "@/lib/branches";

export type StaffRole = "staff" | "manager";
export type StaffStatus = "pending" | "approved" | "rejected";

export type StaffMember = {
  id: string;
  email: string;
  full_name: string;
  department: string;
  branch: Branch;
  role: StaffRole;
  status: StaffStatus;
  is_active: boolean;
};

/** Only accounts from this domain may REQUEST access. Override with ALLOWED_EMAIL_DOMAIN if needed. */
export const ALLOWED_EMAIL_DOMAIN = (process.env.ALLOWED_EMAIL_DOMAIN || "mimetta.co").toLowerCase();

export function isAllowedEmail(email: string) {
  return email.toLowerCase().endsWith(`@${ALLOWED_EMAIL_DOMAIN}`);
}

/** The roster entry for this email in this branch, whatever its status. */
export async function getMembership(email: string, branch: Branch): Promise<StaffMember | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("staff")
    .select("id, email, full_name, department, branch, role, status, is_active")
    .eq("email", email.trim().toLowerCase())
    .eq("branch", branch)
    .maybeSingle();

  if (error) {
    console.error("Roster lookup failed:", error.message);
    return null;
  }
  return (data as StaffMember | null) ?? null;
}

export function hasAccess(member: StaffMember | null): boolean {
  return !!member && member.status === "approved" && member.is_active;
}

/**
 * "Who is this?" The signed-in account and what it may do in this branch.
 * Only accounts that signed in with Google are treated as staff, so a password
 * account created with someone else's address never gets a roster entry.
 */
export async function getCurrentStaff(branch: Branch) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const email = user?.email?.toLowerCase() ?? null;
  const viaGoogle = !!user?.identities?.some((i) => i.provider === "google");
  const member = email && viaGoogle ? await getMembership(email, branch) : null;

  return { user, email, viaGoogle, member };
}