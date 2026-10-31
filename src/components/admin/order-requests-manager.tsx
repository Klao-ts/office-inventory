"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Status = "pending" | "approved" | "rejected" | "ordered";

export type RequestRow = {
  id: string;
  group_id: string;
  branch: string;
  item_name: string;
  quantity: number;
  note: string | null;
  status: Status;
  admin_note: string | null;
  created_at: string;
  staff_name: string;
  department: string;
  distributor_id: string | null;
};

const STATUS_LABELS: Record<Status, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Declined",
  ordered: "Ordered",
};

const STATUS_COLORS: Record<Status, string> = {
  pending: "bg-amber-50 text-amber-700",
  approved: "bg-emerald-50 text-emerald-700",
  rejected: "bg-red-50 text-red-700",
  ordered: "bg-teal-50 text-teal-700",
};

const BRANCH_LABEL = (b: string) => (b === "factory" ? "Factory" : b === "office" ? "Office" : b);

type Saved = { id: string; status: Status; admin_note: string | null };

async function sendPatch(id: string, body: { status?: Status; admin_note?: string }): Promise<Saved> {
  const res = await fetch(`/api/purchase-requests/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Could not save");
  return data.request as Saved;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-GB", {
    timeZone: "Asia/Bangkok",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function LineRow({
  row,
  disabled,
  onStatus,
  onSaveNote,
}: {
  row: RequestRow;
  disabled: boolean;
  onStatus: (status: Status) => void;
  onSaveNote: (note: string) => void;
}) {
  const [note, setNote] = useState(row.admin_note ?? "");
  const dirty = note.trim() !== (row.admin_note ?? "");

  return (
    <li className="space-y-2 px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-900">
            {row.item_name} <span className="text-muted-foreground">× {row.quantity}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            {row.distributor_id ? (
              <>ID: {row.distributor_id}</>
            ) : (
              <span className="text-amber-700">No Distributor ID yet</span>
            )}
            {row.note ? <> · Staff note: {row.note}</> : null}
          </p>
        </div>
        <select
          value={row.status}
          disabled={disabled}
          onChange={(e) => onStatus(e.target.value as Status)}
          className={`h-8 rounded-md border border-input px-2 text-xs font-medium ${STATUS_COLORS[row.status]}`}
        >
          {(Object.keys(STATUS_LABELS) as Status[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <Input
          value={note}
          maxLength={300}
          placeholder="Note for the staff member (optional)"
          className="h-8 text-sm"
          onChange={(e) => setNote(e.target.value)}
        />
        {dirty && (
          <Button type="button" size="sm" disabled={disabled} onClick={() => onSaveNote(note)}>
            Save note
          </Button>
        )}
      </div>
    </li>
  );
}

export function OrderRequestsManager({ initialRows }: { initialRows: RequestRow[] }) {
  const [rows, setRows] = useState<RequestRow[]>(initialRows);
  const [busy, setBusy] = useState(false);

  const apply = (saved: Saved) =>
    setRows((prev) =>
      prev.map((r) => (r.id === saved.id ? { ...r, status: saved.status, admin_note: saved.admin_note } : r))
    );

  const changeStatus = async (ids: string[], status: Status) => {
    if (ids.length === 0) return;
    setBusy(true);
    try {
      const results = await Promise.all(ids.map((id) => sendPatch(id, { status })));
      results.forEach(apply);
      toast.success(ids.length === 1 ? "Saved" : `${ids.length} items updated`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const saveNote = async (id: string, note: string) => {
    setBusy(true);
    try {
      apply(await sendPatch(id, { admin_note: note }));
      toast.success("Note saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const counts = useMemo(() => {
    const c: Record<Status, number> = { pending: 0, approved: 0, rejected: 0, ordered: 0 };
    for (const r of rows) c[r.status] += 1;
    return c;
  }, [rows]);

  const groups = useMemo(() => {
    const map = new Map<string, RequestRow[]>();
    for (const r of rows) map.set(r.group_id, [...(map.get(r.group_id) ?? []), r]);
    return Array.from(map.values());
  }, [rows]);

  const approvedIds = rows.filter((r) => r.status === "approved").map((r) => r.id);

  if (rows.length === 0) {
    return (
      <p className="rounded-md border bg-white py-10 text-center text-sm text-muted-foreground">
        No order requests for this selection.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2 text-xs font-medium">
          {(Object.keys(STATUS_LABELS) as Status[]).map((s) => (
            <span key={s} className={`rounded-full px-2.5 py-1 ${STATUS_COLORS[s]}`}>
              {STATUS_LABELS[s]}: {counts[s]}
            </span>
          ))}
        </div>
        {approvedIds.length > 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => {
              if (window.confirm(`Mark ${approvedIds.length} approved item(s) as ordered?`)) {
                changeStatus(approvedIds, "ordered");
              }
            }}
          >
            Mark all approved as ordered
          </Button>
        )}
      </div>

      {groups.map((lines) => {
        const first = lines[0];
        const pendingIds = lines.filter((l) => l.status === "pending").map((l) => l.id);
        return (
          <Card key={first.group_id}>
            <CardContent className="p-0">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-slate-50 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {first.staff_name} <span className="font-normal text-muted-foreground">· {first.department}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {BRANCH_LABEL(first.branch)} · sent {formatDate(first.created_at)}
                  </p>
                </div>
                {pendingIds.length > 0 && (
                  <div className="flex gap-2">
                    <Button type="button" size="sm" disabled={busy} onClick={() => changeStatus(pendingIds, "approved")}>
                      Approve all
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => changeStatus(pendingIds, "rejected")}
                    >
                      Decline all
                    </Button>
                  </div>
                )}
              </div>
              <ul className="divide-y">
                {lines.map((line) => (
                  <LineRow
                    key={line.id}
                    row={line}
                    disabled={busy}
                    onStatus={(status) => changeStatus([line.id], status)}
                    onSaveNote={(note) => saveNote(line.id, note)}
                  />
                ))}
              </ul>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}