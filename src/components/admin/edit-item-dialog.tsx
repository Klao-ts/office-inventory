"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pencil } from "lucide-react";
import type { Item } from "@/lib/supabase/database.types";

const fromItem = (item: Item) => ({
  name: item.name,
  category: item.category,
  distributor_item_id: item.distributor_item_id ?? "",
  unit_price: String(item.unit_price),
  minimum_threshold: String(item.minimum_threshold),
});

export function EditItemDialog({ item }: { item: Item }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(fromItem(item));

  const update = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleOpenChange = (next: boolean) => {
    if (next) setForm(fromItem(item));
    setOpen(next);
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          category: form.category || "General",
          distributor_item_id: form.distributor_item_id.trim() || null,
          unit_price: Number(form.unit_price || 0),
          minimum_threshold: Number(form.minimum_threshold || 5),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update item");

      toast.success(`${form.name} updated`);
      setOpen(false);
      // Simple refresh so the table shows the new values.
      setTimeout(() => window.location.reload(), 600);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-2">
          <Pencil className="h-4 w-4" /> Edit
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Item</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 space-y-1.5">
            <Label>Item Name</Label>
            <Input value={form.name} onChange={update("name")} />
          </div>
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Input value={form.category} onChange={update("category")} />
          </div>
          <div className="space-y-1.5">
            <Label>Distributor Item ID</Label>
            <Input
              value={form.distributor_item_id}
              onChange={update("distributor_item_id")}
              placeholder="Code from the seller"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Unit Price</Label>
            <Input type="number" step="0.01" min={0} value={form.unit_price} onChange={update("unit_price")} />
          </div>
          <div className="space-y-1.5">
            <Label>Minimum Threshold</Label>
            <Input type="number" min={0} value={form.minimum_threshold} onChange={update("minimum_threshold")} />
          </div>
          <p className="col-span-2 text-xs text-muted-foreground">
            Stock and branch can&apos;t be changed here. Use Restock to add stock.
          </p>
        </div>
        <DialogFooter>
          <Button onClick={handleSubmit} disabled={loading || !form.name} className="w-full">
            {loading ? "Saving..." : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}