import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/service";
import { isBranch } from "@/lib/branches";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

export const dynamic = "force-dynamic";

const STATUSES = ["pending", "approved", "rejected", "ordered"] as const;

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Declined",
  ordered: "Ordered",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700",
  approved: "bg-emerald-50 text-emerald-700",
  rejected: "bg-red-50 text-red-700",
  ordered: "bg-teal-50 text-teal-700",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const branchLabel = (b: string) => (b === "factory" ? "Factory" : b === "office" ? "Office" : b);

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function fmt(value: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-GB", {
    timeZone: "Asia/Bangkok",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const selectClass = "block h-10 rounded-md border border-input bg-background px-3 text-sm";

export default async function OrderHistoryPage({
  searchParams,
}: {
  searchParams: { person?: string; branch?: string; status?: string };
}) {
  const service = createServiceClient();

  const person = searchParams.person && UUID.test(searchParams.person) ? searchParams.person : "all";
  const branch = searchParams.branch && isBranch(searchParams.branch) ? searchParams.branch : "all";
  const status =
    searchParams.status === "rejected_open" || (STATUSES as readonly string[]).includes(searchParams.status ?? "")
      ? (searchParams.status as string)
      : "all";

  const { data: staffList } = await service
    .from("staff")
    .select("id, full_name, branch")
    .order("full_name");

  let query = service
    .from("purchase_requests")
    .select(
      "id, branch, item_name, quantity, note, status, admin_note, cutoff_date, created_at, decided_at, resubmitted_from, staff(full_name, department)"
    )
    .order("created_at", { ascending: false })
    .limit(500);
  if (person !== "all") query = query.eq("staff_id", person);
  if (branch !== "all") query = query.eq("branch", branch);
  if (status === "rejected_open") query = query.eq("status", "rejected");
  else if (status !== "all") query = query.eq("status", status);

  const { data } = await query;

  // Which declined lines were resubmitted, and what happened to the new line.
  const { data: resubs } = await service
    .from("purchase_requests")
    .select("id, resubmitted_from, created_at, status")
    .not("resubmitted_from", "is", null)
    .limit(5000);
  const resubMap = new Map<string, { created_at: string; status: string }>();
  for (const r of resubs ?? []) {
    resubMap.set(r.resubmitted_from as string, { created_at: r.created_at, status: r.status });
  }

  let rows = (data ?? []).map((r) => {
    const staff = one(r.staff as { full_name: string; department: string } | { full_name: string; department: string }[] | null);
    return { ...r, staff_name: staff?.full_name ?? "Unknown", department: staff?.department ?? "" };
  });
  if (status === "rejected_open") rows = rows.filter((r) => !resubMap.has(r.id));

  const counts = { pending: 0, approved: 0, rejected: 0, ordered: 0, notResubmitted: 0 };
  for (const r of rows) {
    if (r.status in counts) counts[r.status as "pending" | "approved" | "rejected" | "ordered"] += 1;
    if (r.status === "rejected" && !resubMap.has(r.id)) counts.notResubmitted += 1;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Order History by Person</h1>
          <p className="mt-1 text-sm text-slate-500">
            Everything staff requested, what was ordered, and what was declined and why.
          </p>
        </div>
        <Link href="/admin/orders" className="text-sm font-medium text-teal-700 hover:underline">
          ← Back to Order Requests
        </Link>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label htmlFor="person" className="text-xs text-muted-foreground">
            Person
          </label>
          <select id="person" name="person" defaultValue={person} className={selectClass}>
            <option value="all">Everyone</option>
            {(staffList ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.full_name} ({branchLabel(s.branch)})
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="branch" className="text-xs text-muted-foreground">
            Branch
          </label>
          <select id="branch" name="branch" defaultValue={branch} className={selectClass}>
            <option value="all">All branches</option>
            <option value="office">Office</option>
            <option value="factory">Factory</option>
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="status" className="text-xs text-muted-foreground">
            Status
          </label>
          <select id="status" name="status" defaultValue={status} className={selectClass}>
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="ordered">Ordered</option>
            <option value="rejected">Declined</option>
            <option value="rejected_open">Declined, not resubmitted</option>
          </select>
        </div>
        <button
          type="submit"
          className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Show
        </button>
      </form>

      <div className="flex flex-wrap gap-2 text-xs font-medium">
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">Items: {rows.length}</span>
        {STATUSES.map((s) => (
          <span key={s} className={`rounded-full px-2.5 py-1 ${STATUS_COLORS[s]}`}>
            {STATUS_LABELS[s]}: {counts[s]}
          </span>
        ))}
        <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-700">
          Declined, not resubmitted: {counts.notResubmitted}
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-md border bg-white py-10 text-center text-sm text-muted-foreground">
          Nothing matches this selection.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sent</TableHead>
                <TableHead>Person</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Admin note / reason</TableHead>
                <TableHead>Decided</TableHead>
                <TableHead>Follow-up</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const re = resubMap.get(r.id);
                return (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap">{fmt(r.created_at)}</TableCell>
                    <TableCell>
                      <div className="font-medium">{r.staff_name}</div>
                      <div className="text-xs text-muted-foreground">{r.department}</div>
                    </TableCell>
                    <TableCell>{branchLabel(r.branch)}</TableCell>
                    <TableCell>
                      <div>{r.item_name}</div>
                      {r.note ? <div className="text-xs text-muted-foreground">Staff note: {r.note}</div> : null}
                    </TableCell>
                    <TableCell>{r.quantity}</TableCell>
                    <TableCell>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[r.status] ?? ""}`}
                      >
                        {STATUS_LABELS[r.status] ?? r.status}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-xs">{r.admin_note ?? ""}</TableCell>
                    <TableCell className="whitespace-nowrap">{fmt(r.decided_at)}</TableCell>
                    <TableCell className="text-sm">
                      {r.status === "rejected" ? (
                        re ? (
                          <span className="text-teal-700">
                            Resubmitted {fmt(re.created_at)} ({STATUS_LABELS[re.status] ?? re.status})
                          </span>
                        ) : (
                          <span className="font-medium text-amber-700">Not resubmitted</span>
                        )
                      ) : r.resubmitted_from ? (
                        <span className="text-muted-foreground">Resubmission of a declined item</span>
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {rows.length === 500 && (
        <p className="text-xs text-muted-foreground">Showing the newest 500 items. Use the filters to narrow it down.</p>
      )}
    </div>
  );
}