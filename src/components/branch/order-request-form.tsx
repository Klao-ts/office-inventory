"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

export type OrderItem = {
  id: string;
  name: string;
  category: string;
  current_stock: number;
  minimum_threshold: number;
};

type Line = {
  key: number;
  custom: boolean;
  itemId: string;
  customName: string;
  quantity: string;
  note: string;
};

const newLine = (key: number): Line => ({
  key,
  custom: false,
  itemId: "",
  customName: "",
  quantity: "1",
  note: "",
});

function stockBadge(item: OrderItem) {
  if (item.current_stock <= 0) return { text: "Out", className: "bg-red-50 text-red-700" };
  if (item.current_stock <= item.minimum_threshold) return { text: "Low", className: "bg-amber-50 text-amber-700" };
  return { text: "OK", className: "bg-emerald-50 text-emerald-700" };
}

function ItemPicker({
  items,
  selectedId,
  onSelect,
}: {
  items: OrderItem[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const selected = items.find((i) => i.id === selectedId);

  const q = text.trim().toLowerCase();
  const matches = items
    .filter((i) => !q || i.name.toLowerCase().includes(q) || (i.category ?? "").toLowerCase().includes(q))
    .slice(0, 50);

  return (
    <div className="relative">
      <Input
        value={open ? text : selected?.name ?? ""}
        placeholder="Search and choose an item"
        onFocus={() => {
          setText("");
          setOpen(true);
        }}
        onBlur={() => setOpen(false)}
        onChange={(e) => setText(e.target.value)}
      />
      {open && (
        <ul className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-white shadow-lg">
          {matches.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">No items match.</li>
          ) : (
            matches.map((item) => {
              const badge = stockBadge(item);
              return (
                <li
                  key={item.id}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onSelect(item.id);
                    setOpen(false);
                    (document.activeElement as HTMLElement | null)?.blur();
                  }}
                  className="flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm hover:bg-slate-50"
                >
                  <span className="truncate">{item.name}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="text-xs tabular-nums text-muted-foreground">{item.current_stock} left</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}>
                      {badge.text}
                    </span>
                  </span>
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}

export function OrderRequestForm({
  branch,
  items,
  cutoffLabel,
}: {
  branch: string;
  items: OrderItem[];
  cutoffLabel: string;
}) {
  const keyCounter = useRef(1);
  const [lines, setLines] = useState<Line[]>([newLine(0)]);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const updateLine = (key: number, changes: Partial<Line>) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...changes } : l)));

  const addLine = () => {
    setLines((prev) => [...prev, newLine(keyCounter.current++)]);
  };

  const removeLine = (key: number) => setLines((prev) => prev.filter((l) => l.key !== key));

  const submit = async () => {
    const payloadLines: { item_id: string | null; item_name?: string; quantity: number; note: string }[] = [];

    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      const qty = Number(l.quantity);
      if (!Number.isInteger(qty) || qty < 1) {
        toast.error(`Item ${i + 1}: quantity must be 1 or more`);
        return;
      }
      if (l.custom) {
        if (l.customName.trim().length < 2) {
          toast.error(`Item ${i + 1}: please type the item name`);
          return;
        }
        payloadLines.push({ item_id: null, item_name: l.customName.trim(), quantity: qty, note: l.note.trim() });
      } else {
        if (!l.itemId) {
          toast.error(`Item ${i + 1}: please choose an item`);
          return;
        }
        payloadLines.push({ item_id: l.itemId, quantity: qty, note: l.note.trim() });
      }
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/purchase-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branch, lines: payloadLines }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send request");

      toast.success("Order request sent.");
      setDone(true);
      setLines([newLine(keyCounter.current++)]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="text-lg font-medium text-slate-900">Request sent!</p>
          <p className="text-sm text-muted-foreground">
            The admin will review it after the {cutoffLabel} cut-off. You can follow its status in My History.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={() => setDone(false)}>Send another request</Button>
            <Link
              href={`/b/${branch}/history`}
              className="inline-flex h-10 items-center rounded-md border px-4 text-sm font-medium hover:bg-slate-50"
            >
              Open My History
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        {lines.map((line, index) => (
          <div key={line.key} className="space-y-3 rounded-md border p-3">
            <div className="flex items-start justify-between gap-2">
              <Label className="text-xs text-muted-foreground">Item {index + 1}</Label>
              {lines.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="-mt-2 h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => removeLine(line.key)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>

            {line.custom ? (
              <Input
                value={line.customName}
                placeholder="Type the item name"
                maxLength={100}
                onChange={(e) => updateLine(line.key, { customName: e.target.value })}
              />
            ) : (
              <ItemPicker
                items={items}
                selectedId={line.itemId}
                onSelect={(id) => updateLine(line.key, { itemId: id })}
              />
            )}

            <button
              type="button"
              className="text-xs font-medium text-teal-700 hover:underline"
              onClick={() => updateLine(line.key, { custom: !line.custom, itemId: "", customName: "" })}
            >
              {line.custom ? "Choose from the list instead" : "Item not in the list?"}
            </button>

            <div className="flex items-center gap-2">
              <Label htmlFor={`oq-${line.key}`} className="text-xs text-muted-foreground">
                Qty
              </Label>
              <Input
                id={`oq-${line.key}`}
                type="number"
                min={1}
                className="h-9 w-24"
                value={line.quantity}
                onChange={(e) => updateLine(line.key, { quantity: e.target.value })}
              />
            </div>

            <Input
              value={line.note}
              placeholder="Note (optional), e.g. brand, size or why you need it"
              maxLength={300}
              onChange={(e) => updateLine(line.key, { note: e.target.value })}
            />
          </div>
        ))}

        <Button type="button" variant="outline" size="sm" className="w-full gap-2" onClick={addLine}>
          <Plus className="h-4 w-4" /> Add another item
        </Button>

        <Button type="button" className="w-full" disabled={submitting} onClick={submit}>
          {submitting ? "Sending..." : "Send order request"}
        </Button>
      </CardContent>
    </Card>
  );
}