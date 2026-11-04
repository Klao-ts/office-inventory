"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

type Status = "pending" | "approved" | "rejected" | "ordered";

export type HistoryRow = {
  id: string;
  group_id: string;
  item_name: string;
  quantity: number;
  note: string | null;
  status: Status;
  admin_note: string | null;
  sent_label: string;
  cutoff_label: string;
  is_resubmission: boolean;
  resubmitted: boolean;
};

const STATUS_STYLES: Record<Status, { label: string; className: string }> = {
  pending: { label: "Waiting for review", className: "bg-amber-50 text-amber-700" },
  approved: { label: "Approved", className: "bg-emerald-50 text-emerald-700" },
  rejected: { label: "Declined", className: "bg-red-50 text-red-700" },
  ordered: { label: "Ordered", className: "bg-teal-50 text-teal-700" },
};

type Edit = { quantity: string; note: string };

export function OrderHistoryList({
  rows,
  branch,
  nextCutoffLabel,
}: {
  rows: HistoryRow[];
  branch: string;
  nextCutoffLabel: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [reviewing, setReviewing] = useState(false);
  const [edits, setEdits] = useState<Record<string, Edit>>({});
  const [sending, setSending] = useState(false);

  const canResubmit = (r: HistoryRow) => r.status === "rejected" && !r.resubmitted;

  const groups = useMemo(() => {
    const map = new Map<string, HistoryRow[]>();
    for (const r of rows) map.set(r.group_id, [...(map.get(r.group_id) ?? []), r]);
    return Array.from(map.values());
  }, [rows]);

  const selectedRows = rows.filter((r) => selected.includes(r.id) && canResubmit(r));

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const toggleGroup = (lines: HistoryRow[]) => {
    const ids = lines.filter(canResubmit).map((l) => l.id);
    const allSelected = ids.every((id) => selected.includes(id));
    setSelected((prev) =>
      allSelected ? prev.filter((id) => !ids.includes(id)) : Array.from(new Set([...prev, ...ids]))
    );
  };

  const startReview = () => {
    const next: Record<string, Edit> = {};
    for (const r of selectedRows) next[r.id] = { quantity: String(r.quantity), note: r.note ?? "" };
    setEdits(next);
    setReviewing(true);
  };

  const removeFromReview = (id: string) => {
    const next = selected.filter((x) => x !== id);
    setSelected(next);
    if (next.length === 0) setReviewing(false);
  };

  const cancelAll = () => {
    setSelected([]);
    setReviewing(false);
  };

  const submit = async () => {
    const lines: { id: string; quantity: number; note: string }[] = [];
    for (const r of selectedRows) {
      const e = edits[r.id];
      const qty = Number(e?.quantity);
      if (!Number.isInteger(qty) || qty < 1) {
        toast.error(`${r.item_name}: quantity must be 1 or more`);
        return;
      }
      lines.push({ id: r.id, quantity: qty, note: (e?.note ?? "").trim() });
    }
    if (lines.length === 0) return;

    setSending(true);
    try {
      const res = await fetch("/api/purchase-requests/resubmit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branch, lines }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to resubmit");

      toast.success("Resubmitted.");
      setSelected([]);
      setReviewing(false);
      setEdits({});
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSending(false);
    }
  };

  if (rows.length === 0) {
    return <p className="px-4 py-6 text-center text-sm text-muted-foreground">No order requests yet.</p>;
  }

  return (
    <div className="space-y-3">
      {reviewing && selectedRows.length > 0 ? (
        <Card className="border-teal-300">
          <CardContent className="space-y-4 pt-6">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Review before resubmitting</h3>
              <p className="text-sm text-muted-foreground">
                These items will be sent as a new request for the {nextCutoffLabel} cut-off. You can change the
                quantity or note first.
              </p>
            </div>

            {selectedRows.map((r) => (
              <div key={r.id} className="space-y-2 rounded-md border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900">{r.item_name}</p>
                    <p className="text-xs text-red-700">Declined: {r.admin_note || "no reason was given"}</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => removeFromReview(r.id)}
                    aria-label={`Remove ${r.item_name}`}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Qty</span>
                  <Input
                    type="number"
                    min={1}
                    className="h-9 w-24"
                    value={edits[r.id]?.quantity ?? ""}
                    onChange={(e) =>
                      setEdits((prev) => ({ ...prev, [r.id]: { ...prev[r.id], quantity: e.target.value } }))
                    }
                  />
                </div>
                <Input
                  value={edits[r.id]?.note ?? ""}
                  maxLength={300}
                  placeholder="Note (optional), e.g. why you still need it"
                  onChange={(e) =>
                    setEdits((prev) => ({ ...prev, [r.id]: { ...prev[r.id], note: e.target.value } }))
                  }
                />
              </div>
            ))}

            <div className="flex gap-2">
              <Button type="button" className="flex-1" disabled={sending} onClick={submit}>
                {sending ? "Sending..." : `Resubmit ${selectedRows.length} item${selectedRows.length === 1 ? "" : "s"}`}
              </Button>
              <Button type="button" variant="outline" disabled={sending} onClick={() => setReviewing(false)}>
                Back
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : selectedRows.length > 0 ? (
        <div className="sticky top-2 z-30 flex items-center justify-between gap-2 rounded-md border border-teal-300 bg-white p-3 shadow-sm">
          <p className="text-sm font-medium text-slate-900">{selectedRows.length} selected</p>
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={startReview}>
              Review and resubmit
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={cancelAll}>
              Clear
            </Button>
          </div>
        </div>
      ) : null}

      {groups.map((lines) => {
        const first = lines[0];
        const resubmittable = lines.filter(canResubmit);
        const allSelected = resubmittable.length > 0 && resubmittable.every((l) => selected.includes(l.id));
        return (
          <Card key={first.group_id}>
            <CardContent className="p-0">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-slate-50 px-4 py-2.5">
                <p className="text-xs text-muted-foreground">
                  {lines.some((l) => l.is_resubmission) ? "Resubmitted · " : ""}
                  Sent {first.sent_label} · counts toward the {first.cutoff_label} cut-off
                </p>
                {resubmittable.length > 0 && (
                  <button
                    type="button"
                    className="text-xs font-medium text-teal-700 hover:underline"
                    onClick={() => toggleGroup(lines)}
                  >
                    {allSelected ? "Clear declined" : "Select all declined"}
                  </button>
                )}
              </div>
              <ul className="divide-y">
                {lines.map((r) => {
                  const status = STATUS_STYLES[r.status] ?? STATUS_STYLES.pending;
                  return (
                    <li key={r.id} className="flex items-start gap-3 px-4 py-3">
                      {canResubmit(r) ? (
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4 shrink-0 accent-teal-700"
                          checked={selected.includes(r.id)}
                          onChange={() => toggle(r.id)}
                          aria-label={`Select ${r.item_name}`}
                        />
                      ) : (
                        <span className="w-4 shrink-0" />
                      )}
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm font-medium text-slate-900">
                            {r.item_name} <span className="text-muted-foreground">× {r.quantity}</span>
                          </p>
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${status.className}`}>
                            {status.label}
                          </span>
                        </div>
                        {r.note ? <p className="text-xs text-slate-600">Your note: {r.note}</p> : null}
                        {r.status === "rejected" ? (
                          <p className="text-xs text-red-700">Reason: {r.admin_note || "no reason was given"}</p>
                        ) : r.admin_note ? (
                          <p className="text-xs text-slate-700">Admin: {r.admin_note}</p>
                        ) : null}
                        {r.resubmitted ? <p className="text-xs font-medium text-teal-700">Resubmitted ✓</p> : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}