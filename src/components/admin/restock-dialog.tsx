"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Item } from "@/lib/supabase/database.types";

export function RestockDialog({
  item,
  open,
  onOpenChange,
  onRestocked,
}: {
  item: Item | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRestocked: (item: Item) => void;
}) {
  const [quantity, setQuantity] = useState("");
  const [supplier, setSupplier] = useState("");
  const [note, setNote] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [loading, setLoading] = useState(false);

  if (!item) return null;

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/restock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item_id: item.id,
          added_quantity: Number(quantity),
          supplier: supplier || null,
          note: note || null,
          unit_price: unitPrice ? Number(unitPrice) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to restock");

      toast.success(`${item.name} restocked (+${quantity})`);
      onRestocked(data.item);
      onOpenChange(false);
      setQuantity("");
      setSupplier("");
      setNote("");
      setUnitPrice("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Restock: {item.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Quantity to Add</Label>
            <Input type="number" min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Supplier</Label>
            <Input value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="e.g. Office Depot" />
          </div>
          <div className="space-y-1.5">
            <Label>Unit Price (optional)</Label>
            <Input type="number" step="0.01" min={0} value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Note</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note" />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSubmit} disabled={loading || !quantity} className="w-full">
            {loading ? "Saving..." : "Confirm Restock"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
