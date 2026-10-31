"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

export type StockItem = {
  id: string;
  name: string;
  category: string;
  current_stock: number;
  minimum_threshold: number;
};

type Status = "ok" | "low" | "out";

function statusOf(item: StockItem): Status {
  if (item.current_stock <= 0) return "out";
  if (item.current_stock <= item.minimum_threshold) return "low";
  return "ok";
}

const BADGE: Record<Status, { label: string; className: string }> = {
  ok: { label: "OK", className: "bg-emerald-50 text-emerald-700" },
  low: { label: "Low", className: "bg-amber-50 text-amber-700" },
  out: { label: "Out", className: "bg-red-50 text-red-700" },
};

export function StockList({ items, branchLabel }: { items: StockItem[]; branchLabel: string }) {
  const [query, setQuery] = useState("");
  const [lowOnly, setLowOnly] = useState(false);

  const counts = useMemo(
    () => ({
      low: items.filter((i) => statusOf(i) === "low").length,
      out: items.filter((i) => statusOf(i) === "out").length,
    }),
    [items]
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (lowOnly && statusOf(item) === "ok") return false;
      if (!q) return true;
      return item.name.toLowerCase().includes(q) || (item.category ?? "").toLowerCase().includes(q);
    });
  }, [items, query, lowOnly]);

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Stock in {branchLabel}</h2>
            <p className="text-sm text-muted-foreground">
              {counts.low} low · {counts.out} out of stock
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant={lowOnly ? "default" : "outline"}
            aria-pressed={lowOnly}
            onClick={() => setLowOnly((v) => !v)}
          >
            Low or out only
          </Button>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search items"
            className="pl-9"
          />
        </div>

        {items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No items have been added for this branch yet.
          </p>
        ) : visible.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No items match.</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {visible.map((item) => {
              const badge = BADGE[statusOf(item)];
              return (
                <li key={item.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{item.name}</p>
                    {item.category ? (
                      <p className="truncate text-xs text-muted-foreground">{item.category}</p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-sm tabular-nums text-slate-700">{item.current_stock}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}>
                      {badge.label}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}