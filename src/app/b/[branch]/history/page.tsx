import { notFound, redirect } from "next/navigation";
import { isBranch } from "@/lib/branches";
import { getCurrentStaff, hasAccess } from "@/lib/staff-auth";
import { createServiceClient } from "@/lib/supabase/service";
import { getNextCutoff } from "@/lib/pr-cutoff";
import { OrderHistoryList, type HistoryRow } from "@/components/branch/order-history-list";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const REASON_LABELS: Record<string, string> = {
  general_use: "General office use",
  client_meeting: "Client / meeting prep",
  new_hire: "New hire setup",
  replacement: "Replacement",
  project: "Project-specific",
  other: "Other",
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-GB", {
    timeZone: "Asia/Bangkok",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function HistoryPage({ params }: { params: { branch: string } }) {
  const branch = params.branch;
  if (!isBranch(branch)) return notFound();

  const { member } = await getCurrentStaff(branch);
  if (!member || !hasAccess(member)) redirect(`/b/${branch}`);

  const service = createServiceClient();

  const [withdrawalsRes, requestsRes] = await Promise.all([
    service
      .from("withdrawals")
      .select("id, quantity, reason_category, requested_at, items(name)")
      .eq("staff_id", member.id)
      .order("requested_at", { ascending: false })
      .limit(50),
    service
      .from("purchase_requests")
      .select(
        "id, group_id, item_name, quantity, note, status, admin_note, cutoff_date, created_at, resubmitted_from"
      )
      .eq("staff_id", member.id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const withdrawals = withdrawalsRes.data ?? [];
  const requests = requestsRes.data ?? [];

  // A resubmission is always newer than the line it came from, so it is in this list too.
  const resubmittedIds = new Set<string>(
    requests.map((r) => r.resubmitted_from as string | null).filter((v): v is string => !!v)
  );

  const rows: HistoryRow[] = requests.map((r) => ({
    id: r.id,
    group_id: r.group_id,
    item_name: r.item_name,
    quantity: r.quantity,
    note: r.note,
    status: r.status,
    admin_note: r.admin_note,
    sent_label: formatDate(r.created_at),
    cutoff_label: formatDate(r.cutoff_date),
    is_resubmission: !!r.resubmitted_from,
    resubmitted: resubmittedIds.has(r.id),
  }));

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">My History</h1>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-900">Order requests</h2>
        <p className="text-sm text-muted-foreground">
          If something was declined, tick it to review and send it again for the next cut-off.
        </p>
        <OrderHistoryList rows={rows} branch={branch} nextCutoffLabel={getNextCutoff().label} />
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-900">Withdrawals</h2>
        <Card>
          <CardContent className="p-0">
            {withdrawals.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">No withdrawals yet.</p>
            ) : (
              <ul className="divide-y">
                {withdrawals.map((w) => {
                  const rel = w.items as { name?: string } | { name?: string }[] | null;
                  const itemName = Array.isArray(rel) ? rel[0]?.name : rel?.name;
                  return (
                    <li key={w.id} className="space-y-1 px-4 py-3">
                      <p className="text-sm font-medium text-slate-900">
                        {itemName ?? "Item"} <span className="text-muted-foreground">× {w.quantity}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(w.requested_at)}
                        {w.reason_category ? ` · ${REASON_LABELS[w.reason_category] ?? w.reason_category}` : ""}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}