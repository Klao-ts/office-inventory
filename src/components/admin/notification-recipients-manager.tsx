"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type Recipient = {
  id: string;
  email: string;
  label: string | null;
  branch: "office" | "factory" | "store" | null;
  notify_low_stock: boolean;
  notify_purchase_request: boolean;
  is_active: boolean;
};

const BRANCH_LABELS: Record<string, string> = {
  office: "Office",
  factory: "Factory",
  store: "Store",
};

type Patch = Partial<Pick<Recipient, "notify_low_stock" | "notify_purchase_request" | "is_active">>;

export function NotificationRecipientsManager({ initialRecipients }: { initialRecipients: Recipient[] }) {
  const [recipients, setRecipients] = useState<Recipient[]>(initialRecipients);
  const [email, setEmail] = useState("");
  const [label, setLabel] = useState("");
  const [branch, setBranch] = useState("all");
  const [lowStock, setLowStock] = useState(true);
  const [purchase, setPurchase] = useState(true);
  const [saving, setSaving] = useState(false);

  const addRecipient = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/recipients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          label: label || null,
          branch: branch === "all" ? null : branch,
          notify_low_stock: lowStock,
          notify_purchase_request: purchase,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not add recipient");

      setRecipients((prev) => [...prev, data.recipient as Recipient]);
      setEmail("");
      setLabel("");
      setBranch("all");
      setLowStock(true);
      setPurchase(true);
      toast.success("Recipient added");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const update = async (id: string, patch: Patch) => {
    const previous = recipients;
    setRecipients((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

    const res = await fetch(`/api/recipients/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });

    if (!res.ok) {
      setRecipients(previous);
      toast.error("Could not save that change");
    }
  };

  const remove = async (recipient: Recipient) => {
    if (!confirm(`Remove ${recipient.email} from the notification list?`)) return;

    const res = await fetch(`/api/recipients/${recipient.id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Could not remove recipient");
      return;
    }
    setRecipients((prev) => prev.filter((r) => r.id !== recipient.id));
    toast.success("Recipient removed");
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add a recipient</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="rcpt-email">Email</Label>
              <Input
                id="rcpt-email"
                type="email"
                placeholder="name@mimetta.co"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rcpt-label">Name / role (optional)</Label>
              <Input
                id="rcpt-label"
                placeholder="e.g. Store manager"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rcpt-branch">Receives alerts for</Label>
            <select
              id="rcpt-branch"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="all">All branches</option>
              <option value="office">Office only</option>
              <option value="factory">Factory only</option>
              <option value="store">Store only</option>
            </select>
          </div>

          <div className="flex flex-wrap gap-6 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" className="h-4 w-4" checked={lowStock} onChange={(e) => setLowStock(e.target.checked)} />
              Low-stock alerts
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" className="h-4 w-4" checked={purchase} onChange={(e) => setPurchase(e.target.checked)} />
              Purchase request alerts
            </label>
          </div>

          <Button onClick={addRecipient} disabled={saving || !email}>
            {saving ? "Adding..." : "Add recipient"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Current recipients</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {recipients.length === 0 && <p className="text-sm text-muted-foreground">No recipients yet.</p>}

          {recipients.map((r) => (
            <div key={r.id} className="flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate font-medium">{r.email}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {r.label && <span>{r.label}</span>}
                  <Badge variant="secondary">{r.branch ? BRANCH_LABELS[r.branch] : "All branches"}</Badge>
                  {!r.is_active && <Badge variant="warning">Paused</Badge>}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-sm">
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={r.notify_low_stock}
                    onChange={(e) => update(r.id, { notify_low_stock: e.target.checked })}
                  />
                  Low stock
                </label>
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={r.notify_purchase_request}
                    onChange={(e) => update(r.id, { notify_purchase_request: e.target.checked })}
                  />
                  Purchase requests
                </label>
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={r.is_active}
                    onChange={(e) => update(r.id, { is_active: e.target.checked })}
                  />
                  Active
                </label>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => remove(r)}
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