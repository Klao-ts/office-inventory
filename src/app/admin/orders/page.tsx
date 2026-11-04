import { createServiceClient } from "@/lib/supabase/service";
import Link from "next/link";
import { isBranch } from "@/lib/branches";
import { OrderRequestsManager, type RequestRow } from "@/components/admin/order-requests-manager";

export const dynamic = "force-dynamic";

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function cutoffLabel(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const selectClass = "h-10 rounded-md border border-input bg-background px-3 text-sm";

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: { branch?: string; cutoff?: string };
}) {
  const service = createServiceClient();

  const { data: overview } = await service.from("purchase_requests").select("cutoff_date, status").limit(5000);

  const all = (overview ?? []) as { cutoff_date: string; status: string }[];
  const cutoffs = Array.from(new Set(all.map((r) => r.cutoff_date))).sort().reverse();
  const pendingCutoffs = Array.from(new Set(all.filter((r) => r.status === "pending").map((r) => r.cutoff_date))).sort();

  // Default: the oldest cut-off that still has pending items, otherwise the newest one.
  const requested = searchParams.cutoff;
  const cutoff = requested && cutoffs.includes(requested) ? requested : pendingCutoffs[0] ?? cutoffs[0] ?? "";
  const branch = searchParams.branch && isBranch(searchParams.branch) ? searchParams.branch : "all";

  let rows: RequestRow[] = [];
  if (cutoff) {
    let query = service
      .from("purchase_requests")
      .select(
        "id, group_id, branch, item_name, quantity, note, status, admin_note, created_at, staff(full_name, department), items(distributor_item_id)"
      )
      .eq("cutoff_date", cutoff)
      .order("created_at", { ascending: false });
    if (branch !== "all") query = query.eq("branch", branch);

    const { data } = await query;
    rows = (data ?? []).map((r) => {
      const staff = one(r.staff as { full_name: string; department: string } | { full_name: string; department: string }[] | null);
      const item = one(
        r.items as { distributor_item_id: string | null } | { distributor_item_id: string | null }[] | null
      );
      return {
        id: r.id,
        group_id: r.group_id,
        branch: r.branch,
        item_name: r.item_name,
        quantity: r.quantity,
        note: r.note,
        status: r.status,
        admin_note: r.admin_note,
        created_at: r.created_at,
        staff_name: staff?.full_name ?? "Unknown",
        department: staff?.department ?? "",
        distributor_id: item?.distributor_item_id?.trim() || null,
      } as RequestRow;
    });
  }

  const exportBase = `/api/purchase-requests/export?cutoff=${cutoff}&branch=${branch}`;
  const linkClass =
    "inline-flex h-10 items-center rounded-md border px-4 text-sm font-medium hover:bg-slate-50";

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Order Requests</h1>
          <Link href="/admin/orders/history" className="text-sm font-medium text-teal-700 hover:underline">
            History by person →
          </Link>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Review what staff asked for, approve or decline it, then download the list for the seller.
        </p>
      </div>

      {cutoffs.length === 0 ? (
        <p className="rounded-md border bg-white py-10 text-center text-sm text-muted-foreground">
          No order requests yet.
        </p>
      ) : (
        <>
          <form method="get" className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label htmlFor="cutoff" className="text-xs text-muted-foreground">
                Cut-off date
              </label>
              <select id="cutoff" name="cutoff" defaultValue={cutoff} className={`${selectClass} block`}>
                {cutoffs.map((c) => (
                  <option key={c} value={c}>
                    {cutoffLabel(c)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="branch" className="text-xs text-muted-foreground">
                Branch
              </label>
              <select id="branch" name="branch" defaultValue={branch} className={`${selectClass} block`}>
                <option value="all">All branches</option>
                <option value="office">Office</option>
                <option value="factory">Factory</option>
              </select>
            </div>
            <button
              type="submit"
              className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Show
            </button>
            <div className="ml-auto flex flex-wrap gap-2">
              <a href={`${exportBase}&status=approved`} className={linkClass}>
                Download approved (CSV)
              </a>
              <a href={`${exportBase}&status=all`} className={linkClass}>
                Download all (CSV)
              </a>
            </div>
          </form>

          <OrderRequestsManager key={`${cutoff}-${branch}`} initialRows={rows} />
        </>
      )}
    </div>
  );
}