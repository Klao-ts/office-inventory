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

const UNIT_SUGGESTIONS = ["pcs", "ream", "box", "pack", "set", "roll", "bottle", "pair", "unit"];

const emptyForm = {
  name: "",
  category: "",
  branch: "office",
  distributor_item_id: "",
  seller: "",
  unit: "pcs",
  unit_price: "",
  current_stock: "",
  minimum_threshold: "5",
  max_withdraw_qty: "",
  max_request_qty: "",
};

export function AddItemDialog({
  onCreated,
  sellerOptions = [],
}: {
  onCreated: (item: Item) => void;
  sellerOptions?: string[];
}) {
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
          distributor_item_id: form.distributor_item_id.trim() || null,
          seller: form.seller.trim() || null,
          unit: form.unit.trim() || "pcs",
          unit_price: Number(form.unit_price || 0),
          current_stock: Number(form.current_stock || 0),
          minimum_threshold: Number(form.minimum_threshold || 5),
          max_withdraw_qty: form.max_withdraw_qty.trim() ? Number(form.max_withdraw_qty) : null,
          max_request_qty: form.max_request_qty.trim() ? Number(form.max_request_qty) : null,
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
      <DialogContent className="max-h-[90vh] overflow-y-auto">
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
            <Label>Item ID</Label>
            <Input
              value={form.distributor_item_id}
              onChange={update("distributor_item_id")}
              placeholder="Product code from the seller"
            />
          </div>
          <p className="col-span-2 -mt-2 text-xs text-muted-foreground">
            The same product in Office and Factory can use the same Item ID.
          </p>
          <div className="col-span-2 space-y-1.5">
            <Label>Seller / Distributor</Label>
            <Input
              list="add-seller-options"
              value={form.seller}
              onChange={update("seller")}
              placeholder="Company name or distributor ID"
            />
            <datalist id="add-seller-options">
              {sellerOptions.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
          <div className="space-y-1.5">
            <Label>Unit</Label>
            <Input list="add-unit-options" value={form.unit} onChange={update("unit")} placeholder="e.g. ream" />
            <datalist id="add-unit-options">
              {UNIT_SUGGESTIONS.map((u) => (
                <option key={u} value={u} />
              ))}
            </datalist>
          </div>
          <div className="space-y-1.5">
            <Label>Cost per unit, THB (average)</Label>
            <Input type="number" step="0.01" min={0} value={form.unit_price} onChange={update("unit_price")} />
          </div>
          <div className="space-y-1.5">
            <Label>Initial Stock</Label>
            <Input type="number" min={0} value={form.current_stock} onChange={update("current_stock")} />
          </div>
          <div className="space-y-1.5">
            <Label>Minimum Threshold</Label>
            <Input type="number" min={0} value={form.minimum_threshold} onChange={update("minimum_threshold")} />
          </div>
          <div className="space-y-1.5">
            <Label>Max per withdrawal</Label>
            <Input
              type="number"
              min={1}
              value={form.max_withdraw_qty}
              onChange={update("max_withdraw_qty")}
              placeholder="No limit"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Max per order request</Label>
            <Input
              type="number"
              min={1}
              value={form.max_request_qty}
              onChange={update("max_request_qty")}
              placeholder="No limit"
            />
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