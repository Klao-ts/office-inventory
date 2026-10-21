import { createServiceClient } from "@/lib/supabase/service";
import { StaffManager, type Staff } from "@/components/admin/staff-manager";

export const dynamic = "force-dynamic";

export default async function StaffPage() {
  const supabase = createServiceClient();
  const { data, error } = await supabase.from("staff").select("*").order("branch").order("full_name");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Staff Roster</h1>
        <p className="mt-1 text-sm text-slate-500">
          Everyone listed here will be able to sign in to their branch&apos;s page, and their name and department will
          be locked in forms. The branch sign-in pages arrive in the next step.
        </p>
      </div>

      {error ? (
        <p className="text-destructive">Failed to load the roster: {error.message}</p>
      ) : (
        <StaffManager initialStaff={(data ?? []) as Staff[]} />
      )}
    </div>
  );
}