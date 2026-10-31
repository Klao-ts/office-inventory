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
import { Plus } from "lucide-react";
import type { Item } from "@/lib/supabase/database.types";

const emptyForm = {
  name: "",
  category: "",
  branch: "office",
  sku: "",
  unit_price: "",
  current_stock: "",
  minimum_threshold: "5",
};

export function AddItemDialog({ onCreated }: { onCreated: (item: Item) => void }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const update = (key: keyof typeof emptyForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          category: form.category || "General",
          branch: form.branch,
          sku: form.sku || null,
          unit_price: Number(form.unit_price || 0),
          current_stock: Number(form.current_stock || 0),
          minimum_threshold: Number(form.minimum_threshold || 5),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create item");

      toast.success(`${form.name} added to inventory`);
      onCreated(data.item);
      setOpen(false);
      setForm(emptyForm);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" /> Add Item
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Item</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 space-y-1.5">
            <Label>Item Name</Label>
            <Input value={form.name} onChange={update("name")} placeholder="e.g. A4 Paper Ream" />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="item-branch">Branch</Label>
            <select
              id="item-branch"
              value={form.branch}
              onChange={(e) => setForm((f) => ({ ...f, branch: e.target.value }))}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="office">Office</option>
              <option value="factory">Factory</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Input value={form.category} onChange={update("category")} placeholder="e.g. Paper" />
          </div>
          <div className="space-y-1.5">
            <Label>SKU</Label>
            <Input value={form.sku} onChange={update("sku")} placeholder="e.g. PAP-A4-002" />
          </div>
          <div className="space-y-1.5">
            <Label>Unit Price</Label>
            <Input type="number" step="0.01" min={0} value={form.unit_price} onChange={update("unit_price")} />
          </div>
          <div className="space-y-1.5">
            <Label>Initial Stock</Label>
            <Input type="number" min={0} value={form.current_stock} onChange={update("current_stock")} />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Minimum Threshold</Label>
            <Input type="number" min={0} value={form.minimum_threshold} onChange={update("minimum_threshold")} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSubmit} disabled={loading || !form.name} className="w-full">
            {loading ? "Saving..." : "Create Item"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}