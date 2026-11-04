"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

import type { Branch } from "@/lib/branches";
import { formatBaht } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type ItemOption = {
  id: string;
  name: string;
  category: string;
  current_stock: number;
  minimum_threshold: number;
  unit: string;
  max_withdraw_qty: number | null;
  unit_price: number;
};

type CostLine = {
  item_id: string;
  name: string;
  unit: string;
  quantity: number;
  unit_cost: number | null;
  total_cost: number | null;
};

const REASON_OPTIONS: { value: string; label: string }[] = [
  { value: "general_use", label: "General office use" },
  { value: "client_meeting", label: "Client / meeting prep" },
  { value: "new_hire", label: "New hire setup" },
  { value: "replacement", label: "Replacement (damaged/lost)" },
  { value: "project", label: "Project-specific" },
  { value: "other", label: "Other" },
];

const formSchema = z.object({
  items: z
    .array(
      z
        .object({
          item_id: z.string().uuid("Select an item"),
          quantity: z.coerce.number().int().min(1, "Min 1"),
          reason_category: z.enum(
            ["general_use", "client_meeting", "new_hire", "replacement", "project", "other"],
            { required_error: "Select a reason", invalid_type_error: "Select a reason" }
          ),
          reason_note: z.string().optional(),
        })
        .refine((row) => row.reason_category !== "other" || !!row.reason_note?.trim(), {
          message: "Please describe the reason",
          path: ["reason_note"],
        })
    )
    .min(1, "Add at least one item"),
});

type FormValues = z.infer<typeof formSchema>;

const toNumber = (v: number | string | null | undefined) => (v === null || v === undefined ? null : Number(v));

function CostSummary({ heading, lines }: { heading: string; lines: CostLine[] }) {
  const total = Math.round(lines.reduce((sum, l) => sum + (l.total_cost ?? 0), 0) * 100) / 100;
  const missing = lines.some((l) => l.total_cost === null);

  return (
    <div className="w-full rounded-md border bg-slate-50 p-3 text-left text-sm">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{heading}</p>
      <ul className="space-y-1.5">
        {lines.map((l, i) => (
          <li key={`${l.item_id}-${i}`} className="flex items-start justify-between gap-3">
            <span className="min-w-0">
              <span className="font-medium text-slate-900">{l.name}</span>
              <span className="block text-xs text-muted-foreground">
                {l.quantity} {l.unit}
                {l.unit_cost !== null ? ` × ${formatBaht(l.unit_cost)}` : ""}
              </span>
            </span>
            <span className="shrink-0 tabular-nums text-slate-900">
              {l.total_cost !== null ? (
                formatBaht(l.total_cost)
              ) : (
                <span className="text-xs text-muted-foreground">cost not set</span>
              )}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex justify-between border-t pt-2 font-semibold text-slate-900">
        <span>Grand total</span>
        <span className="tabular-nums">{formatBaht(total)}</span>
      </div>
      {missing ? (
        <p className="mt-1 text-xs text-muted-foreground">Items with no cost set are not included in the total.</p>
      ) : null}
    </div>
  );
}

export function BranchWithdrawalForm({
  branch,
  branchLabel,
  staffName,
  department,
  initialItems,
}: {
  branch: Branch;
  branchLabel: string;
  staffName: string;
  department: string;
  initialItems: ItemOption[];
}) {
  const router = useRouter();
  const [items, setItems] = useState<ItemOption[]>(initialItems);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [receipt, setReceipt] = useState<CostLine[]>([]);

  // Pick up fresh stock numbers whenever the server sends them again.
  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { items: [{ item_id: "", quantity: 1, reason_category: undefined, reason_note: "" }] },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const watchedItems = watch("items");

  // Estimated cost, shown before submitting. The saved cost comes from the server.
  const estimate: CostLine[] = (watchedItems ?? []).flatMap((row): CostLine[] => {
    const item = items.find((i) => i.id === row?.item_id);
    const qty = Number(row?.quantity);
    if (!item || !Number.isInteger(qty) || qty < 1) return [];
    const price = Number(item.unit_price);
    const cost = price > 0 ? price : null;
    return [
      {
        item_id: item.id,
        name: item.name,
        unit: item.unit,
        quantity: qty,
        unit_cost: cost,
        total_cost: cost === null ? null : Math.round(cost * qty * 100) / 100,
      },
    ];
  });

  const onSubmit = async (values: FormValues) => {
    for (const row of values.items) {
      const item = items.find((i) => i.id === row.item_id);
      if (item && row.quantity > item.current_stock) {
        toast.error(`${item.name}: only ${item.current_stock} ${item.unit} left in stock`);
        return;
      }
      if (item?.max_withdraw_qty) {
        const totalForItem = values.items
          .filter((r) => r.item_id === row.item_id)
          .reduce((sum, r) => sum + r.quantity, 0);
        if (totalForItem > item.max_withdraw_qty) {
          toast.error(`${item.name}: max ${item.max_withdraw_qty} ${item.unit} per withdrawal`);
          return;
        }
      }
      if (!row.reason_category) {
        toast.error(`${item?.name ?? "One of your items"}: please select a reason`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/branch-withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branch, items: values.items }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit request");

      const returned = (data.withdrawals ?? []) as {
        item_id: string;
        quantity: number | string;
        unit_cost: number | string | null;
        total_cost: number | string | null;
      }[];
      setReceipt(
        returned.map((w) => {
          const item = items.find((i) => i.id === w.item_id);
          return {
            item_id: w.item_id,
            name: item?.name ?? "Item",
            unit: item?.unit ?? "",
            quantity: Number(w.quantity),
            unit_cost: toNumber(w.unit_cost),
            total_cost: toNumber(w.total_cost),
          };
        })
      );

      toast.success("Request submitted: items withdrawn from stock.");
      setSubmitted(true);
      setItems((prev) =>
        prev.map((item) => {
          const withdrawnQty = values.items
            .filter((row) => row.item_id === item.id)
            .reduce((sum, row) => sum + row.quantity, 0);
          return withdrawnQty > 0 ? { ...item, current_stock: item.current_stock - withdrawnQty } : item;
        })
      );
      reset({ items: [{ item_id: "", quantity: 1, reason_category: undefined, reason_note: "" }] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="mb-5 rounded-md border bg-slate-50 p-3 text-sm">
          <p className="text-xs text-muted-foreground">Requesting as</p>
          <p className="font-medium text-slate-900">{staffName}</p>
          <p className="text-muted-foreground">
            {department} · {branchLabel}
          </p>
        </div>

        {items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No items have been added for this branch yet. Please contact your administrator.
          </p>
        ) : submitted ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <p className="text-lg font-medium text-slate-900">Request submitted!</p>
            <p className="text-sm text-muted-foreground">Your items have been deducted from inventory.</p>
            {receipt.length > 0 ? <CostSummary heading="Cost" lines={receipt} /> : null}
            <Button
              onClick={() => {
                setSubmitted(false);
                setReceipt([]);
                router.refresh();
              }}
            >
              Submit another request
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-3">
              <Label>Items</Label>
              {fields.map((field, index) => {
                const selectedId = watchedItems?.[index]?.item_id;
                const selectedItem = items.find((i) => i.id === selectedId);
                const selectedReason = watchedItems?.[index]?.reason_category;

                return (
                  <div key={field.id} className="flex items-start gap-2 rounded-md border p-3">
                    <div className="flex-1 space-y-2">
                      <Select
                        value={selectedId}
                        onValueChange={(v) => setValue(`items.${index}.item_id`, v, { shouldValidate: true })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select an item" />
                        </SelectTrigger>
                        <SelectContent>
                          {items.map((item) => (
                            <SelectItem key={item.id} value={item.id} disabled={item.current_stock <= 0}>
                              <div className="flex w-full items-center justify-between gap-2">
                                <span>{item.name}</span>
                                <Badge variant={item.current_stock <= item.minimum_threshold ? "warning" : "secondary"}>
                                  {item.current_stock} {item.unit} left
                                </Badge>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors.items?.[index]?.item_id && (
                        <p className="text-xs text-destructive">{errors.items[index]?.item_id?.message}</p>
                      )}

                      <div className="flex items-center gap-2">
                        <Label htmlFor={`qty-${index}`} className="text-xs text-muted-foreground">
                          Qty
                        </Label>
                        <Input
                          id={`qty-${index}`}
                          type="number"
                          min={1}
                          max={
                            selectedItem
                              ? Math.min(
                                  selectedItem.current_stock,
                                  selectedItem.max_withdraw_qty ?? selectedItem.current_stock
                                )
                              : undefined
                          }
                          className="h-8 w-24"
                          {...register(`items.${index}.quantity`)}
                        />
                        {selectedItem ? (
                          <span className="text-xs text-muted-foreground">{selectedItem.unit}</span>
                        ) : null}
                      </div>
                      {selectedItem?.max_withdraw_qty ? (
                        <p className="text-xs text-muted-foreground">
                          Max {selectedItem.max_withdraw_qty} {selectedItem.unit} per withdrawal
                        </p>
                      ) : null}
                      {selectedItem && selectedItem.current_stock <= selectedItem.minimum_threshold && (
                        <p className="text-xs text-amber-600">
                          Low stock: only {selectedItem.current_stock} {selectedItem.unit} remaining
                        </p>
                      )}

                      <div className="space-y-1">
                        <Label htmlFor={`reason-${index}`} className="text-xs text-muted-foreground">
                          Reason
                        </Label>
                        <Select
                          value={selectedReason}
                          onValueChange={(v) =>
                            setValue(
                              `items.${index}.reason_category`,
                              v as FormValues["items"][number]["reason_category"],
                              { shouldValidate: true }
                            )
                          }
                        >
                          <SelectTrigger id={`reason-${index}`} className="h-8">
                            <SelectValue placeholder="Why do you need this?" />
                          </SelectTrigger>
                          <SelectContent>
                            {REASON_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {errors.items?.[index]?.reason_category && (
                          <p className="text-xs text-destructive">{errors.items[index]?.reason_category?.message}</p>
                        )}
                      </div>

                      {selectedReason === "other" && (
                        <div className="space-y-1">
                          <Input
                            placeholder="Briefly describe why"
                            className="h-8"
                            {...register(`items.${index}.reason_note`)}
                          />
                          {errors.items?.[index]?.reason_note && (
                            <p className="text-xs text-destructive">{errors.items[index]?.reason_note?.message}</p>
                          )}
                        </div>
                      )}
                    </div>

                    {fields.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="mt-1 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => remove(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                );
              })}

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full gap-2"
                onClick={() =>
                  append({ item_id: "", quantity: 1, reason_category: undefined as never, reason_note: "" })
                }
              >
                <Plus className="h-4 w-4" /> Add another item
              </Button>
            </div>

            {estimate.length > 0 ? <CostSummary heading="Estimated cost" lines={estimate} /> : null}

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Submitting..." : "Submit Request"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}