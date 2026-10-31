import { notFound, redirect } from "next/navigation";
import { isBranch } from "@/lib/branches";
import { getCurrentStaff, hasAccess } from "@/lib/staff-auth";
import { createServiceClient } from "@/lib/supabase/service";
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

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  pending: { label: "Waiting for review", className: "bg-amber-50 text-amber-700" },
  approved: { label: "Approved", className: "bg-emerald-50 text-emerald-700" },
  rejected: { label: "Declined", className: "bg-red-50 text-red-700" },
  ordered: { label: "Ordered", className: "bg-teal-50 text-teal-700" },
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
      .select("id, item_name, quantity, note, status, admin_note, cutoff_date, created_at")
      .eq("staff_id", member.id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const withdrawals = withdrawalsRes.data ?? [];
  const requests = requestsRes.data ?? [];

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">My History</h1>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-900">Order requests</h2>
        <Card>
          <CardContent className="p-0">
            {requests.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">No order requests yet.</p>
            ) : (
              <ul className="divide-y">
                {requests.map((r) => {
                  const status = STATUS_STYLES[r.status] ?? STATUS_STYLES.pending;
                  return (
                    <li key={r.id} className="space-y-1 px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-medium text-slate-900">
                          {r.item_name} <span className="text-muted-foreground">× {r.quantity}</span>
                        </p>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${status.className}`}>
                          {status.label}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Sent {formatDate(r.created_at)} · counts toward the {formatDate(r.cutoff_date)} cut-off
                      </p>
                      {r.note ? <p className="text-xs text-slate-600">Your note: {r.note}</p> : null}
                      {r.admin_note ? <p className="text-xs text-slate-700">Admin: {r.admin_note}</p> : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
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