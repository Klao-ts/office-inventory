import { notFound, redirect } from "next/navigation";
import { isBranch, BRANCH_LABELS } from "@/lib/branches";
import { getCurrentStaff, hasAccess } from "@/lib/staff-auth";
import { createServiceClient } from "@/lib/supabase/service";
import { BranchWithdrawalForm, type ItemOption } from "@/components/branch/branch-withdrawal-form";

export const dynamic = "force-dynamic";

export default async function WithdrawPage({ params }: { params: { branch: string } }) {
  const branch = params.branch;
  if (!isBranch(branch)) return notFound();

  const { member } = await getCurrentStaff(branch);
  if (!member || !hasAccess(member)) redirect(`/b/${branch}`);

  // Items come from the server, filtered to THIS branch only.
  const service = createServiceClient();
  const { data: itemRows } = await service
    .from("items")
    .select("id, name, category, current_stock, minimum_threshold, unit, max_withdraw_qty")
    .eq("branch", branch)
    .eq("is_active", true)
    .order("name");

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">Withdraw supplies</h1>
      <BranchWithdrawalForm
        branch={branch}
        branchLabel={BRANCH_LABELS[branch]}
        staffName={member.full_name}
        department={member.department}
        initialItems={(itemRows ?? []) as ItemOption[]}
      />
    </div>
  );
}