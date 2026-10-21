"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type Staff = {
  id: string;
  email: string;
  full_name: string;
  department: string;
  branch: "office" | "factory" | "store";
  is_active: boolean;
};

const BRANCH_LABELS: Record<string, string> = {
  office: "Office",
  factory: "Factory",
  store: "Store",
};

const selectClass = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

/** One person per line: "email, full name, department". Tabs (pasted from a spreadsheet) also work. */
function parseLines(text: string) {
  const rows: { email: string; full_name: string; department: string }[] = [];
  let skipped = 0;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const parts = (line.includes("\t") ? line.split("\t") : line.split(",")).map((p) => p.trim());
    const [email, full_name, department] = parts;

    // Header rows ("Email, Name, Department") and malformed lines end up here.
    if (!email || !email.includes("@") || !full_name || !department) {
      skipped += 1;
      continue;
    }
    rows.push({ email, full_name, department });
  }
  return { rows, skipped };
}

export function StaffManager({ initialStaff }: { initialStaff: Staff[] }) {
  const [staff, setStaff] = useState<Staff[]>(initialStaff);
  const [addBranch, setAddBranch] = useState<Staff["branch"]>("office");
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState("all");

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: staff.length, office: 0, factory: 0, store: 0 };
    for (const s of staff) c[s.branch] += 1;
    return c;
  }, [staff]);

  const visible = useMemo(
    () =>
      staff
        .filter((s) => filter === "all" || s.branch === filter)
        .sort((a, b) => a.branch.localeCompare(b.branch) || a.full_name.localeCompare(b.full_name)),
    [staff, filter]
  );

  const addStaff = async () => {
    const { rows, skipped } = parseLines(text);
    if (rows.length === 0) {
      toast.error("No valid lines found. Use: email, full name, department");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branch: addBranch, rows }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save staff");

      const saved = data.staff as Staff[];
      setStaff((prev) => {
        const byId = new Map(prev.map((s) => [s.id, s]));
        for (const s of saved) byId.set(s.id, s);
        return Array.from(byId.values());
      });
      setText("");
      toast.success(
        `Saved ${saved.length} ${saved.length === 1 ? "person" : "people"}` +
          (skipped ? ` (${skipped} line${skipped === 1 ? "" : "s"} skipped)` : "")
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const setActive = async (id: string, is_active: boolean) => {
    const previous = staff;
    setStaff((prev) => prev.map((s) => (s.id === id ? { ...s, is_active } : s)));

    const res = await fetch(`/api/staff/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active }),
    });
    if (!res.ok) {
      setStaff(previous);
      toast.error("Could not save that change");
    }
  };

  const remove = async (person: Staff) => {
    if (!confirm(`Remove ${person.full_name} (${person.email}) from the ${BRANCH_LABELS[person.branch]} roster?`)) return;

    const res = await fetch(`/api/staff/${person.id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Could not remove that person");
      return;
    }
    setStaff((prev) => prev.filter((s) => s.id !== person.id));
    toast.success("Removed");
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add staff</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="staff-branch">Branch</Label>
            <select
              id="staff-branch"
              value={addBranch}
              onChange={(e) => setAddBranch(e.target.value as Staff["branch"])}
              className={selectClass}
            >
              <option value="office">Office</option>
              <option value="factory">Factory</option>
              <option value="store">Store</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="staff-text">One person per line: email, full name, department</Label>
            <textarea
              id="staff-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={6}
              placeholder={"somchai@mimetta.co, Somchai Jaidee, Finance\nmali@mimetta.co, Mali Suksan, HR"}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              You can paste straight from a spreadsheet (three columns). Pasting the same email again updates that
              person instead of adding a duplicate.
            </p>
          </div>

          <Button onClick={addStaff} disabled={saving || !text.trim()}>
            {saving ? "Saving..." : "Save to roster"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Roster</CardTitle>
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className={`${selectClass} w-48`}>
            <option value="all">All branches ({counts.all})</option>
            <option value="office">Office ({counts.office})</option>
            <option value="factory">Factory ({counts.factory})</option>
            <option value="store">Store ({counts.store})</option>
          </select>
        </CardHeader>
        <CardContent className="space-y-3">
          {visible.length === 0 && <p className="text-sm text-muted-foreground">Nobody here yet.</p>}

          {visible.map((s) => (
            <div
              key={s.id}
              className="flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{s.full_name}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="truncate">{s.email}</span>
                  <span>{s.department}</span>
                  <Badge variant="secondary">{BRANCH_LABELS[s.branch]}</Badge>
                  {!s.is_active && <Badge variant="warning">Switched off</Badge>}
                </div>
              </div>

              <div className="flex items-center gap-4 text-sm">
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={s.is_active}
                    onChange={(e) => setActive(s.id, e.target.checked)}
                  />
                  Active
                </label>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => remove(s)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}