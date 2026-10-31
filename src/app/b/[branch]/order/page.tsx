import { notFound, redirect } from "next/navigation";
import { CalendarClock } from "lucide-react";
import { isBranch, BRANCH_LABELS } from "@/lib/branches";
import { getCurrentStaff, hasAccess } from "@/lib/staff-auth";
import { createServiceClient } from "@/lib/supabase/service";
import { getNextCutoff } from "@/lib/pr-cutoff";
import { OrderRequestForm, type OrderItem } from "@/components/branch/order-request-form";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function OrderRequestPage({ params }: { params: { branch: string } }) {
  const branch = params.branch;
  if (!isBranch(branch)) return notFound();

  const { member } = await getCurrentStaff(branch);
  if (!member || !hasAccess(member)) redirect(`/b/${branch}`);

  // Items come from the server, filtered to THIS branch only.
  const service = createServiceClient();
  const { data: itemRows } = await service
    .from("items")
    .select("id, name, category, current_stock, minimum_threshold")
    .eq("branch", branch)
    .eq("is_active", true)
    .order("name");

  const cutoff = getNextCutoff();

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Order Request</h1>
        <p className="text-sm text-muted-foreground">
          Ask the admin to order supplies for {BRANCH_LABELS[branch]}.
        </p>
      </div>

      <Card className="border-teal-200 bg-teal-50">
        <CardContent className="flex items-start gap-3 pt-6">
          <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-teal-700" />
          <div className="space-y-1">
            <p className="font-medium text-slate-900">
              Next cut-off: {cutoff.label} ({cutoff.daysText})
            </p>
            <p className="text-sm text-slate-600">
              Requests are collected until the 10th of each month. The admin reviews them, and reasonable requests
              will be ordered.
            </p>
          </div>
        </CardContent>
      </Card>

      <OrderRequestForm branch={branch} items={(itemRows ?? []) as OrderItem[]} cutoffLabel={cutoff.label} />
    </div>
  );
}