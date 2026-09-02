import { AlertTriangle } from "lucide-react";
import type { Item } from "@/lib/supabase/database.types";

export function LowStockAlert({ items }: { items: Item[] }) {
  const lowStock = items.filter((i) => i.current_stock <= i.minimum_threshold && i.is_active);

  if (lowStock.length === 0) return null;

  return (
    <div className="mb-6 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
      <div>
        <p className="font-medium text-amber-900">
          {lowStock.length} item{lowStock.length > 1 ? "s" : ""} at or below minimum threshold
        </p>
        <p className="mt-1 text-sm text-amber-800">
          {lowStock.map((i) => `${i.name} (${i.current_stock})`).join(", ")}
        </p>
      </div>
    </div>
  );
}
