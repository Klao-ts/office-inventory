"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type ItemOption = {
  id: string;
  name: string;
  category: string;
  current_stock: number;
  minimum_threshold: number;
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
  employee_name: z.string().min(2, "Enter your full name"),
  department: z.string().min(2, "Enter your department"),
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

export function WithdrawalForm({
  initialItems,
  fetchError,
}: {
  initialItems: ItemOption[];
  fetchError: string | null;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState<ItemOption[]>(initialItems);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

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

  useEffect(() => {
    const channel = supabase
      .channel("items-stock-changes")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "items" },
        (payload) => {
          setItems((prev) =>
            prev.map((item) =>
              item.id === payload.new.id
                ? { ...item, current_stock: payload.new.current_stock as number }
                : item
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  const onSubmit = async (values: FormValues) => {
    for (const row of values.items) {
      const item = items.find((i) => i.id === row.item_id);
      if (item && row.quantity > item.current_stock) {
        toast.error(`${item.name}: only ${item.current_stock} left in stock`);
        return;
      }
      if (!row.reason_category) {
        toast.error(`${item?.name ?? "One of your items"}: please select a reason`);
        return;
      }
      if (row.reason_category === "other" && !row.reason_note?.trim()) {
        toast.error(`${item?.name ?? "One of your items"}: please describe the reason`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to submit request");
      }

      toast.success("Request submitted — items withdrawn from stock.");
      setSubmitted(true);
      setItems((prev) =>
        prev.map((item) => {
          const withdrawnQty = values.items
            .filter((row) => row.item_id === item.id)
            .reduce((sum, row) => sum + row.quantity, 0);
          return withdrawnQty > 0 ? { ...item, current_stock: item.current_stock - withdrawnQty } : item;
        })
      );
      reset({
        employee_name: "",
        department: "",
        items: [{ item_id: "", quantity: 1, reason_category: undefined, reason_note: "" }],
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  if (fetchError) {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-destructive">
          Failed to load items: {fetchError}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        {submitted ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <p className="text-lg font-medium text-slate-900">Request submitted!</p>
            <p className="text-sm text-muted-foreground">Your items have been deducted from inventory.</p>
            <Button onClick={() => setSubmitted(false)}>Submit another request</Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="employee_name">Employee Name</Label>
              <Input id="employee_name" placeholder="Jane Doe" {...register("employee_name")} />
              {errors.employee_name && <p className="text-xs text-destructive">{errors.employee_name.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="department">Department</Label>
              <Input id="department" placeholder="Finance" {...register("department")} />
              {errors.department && <p className="text-xs text-destructive">{errors.department.message}</p>}
            </div>

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
                                  {item.current_stock} left
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
                          max={selectedItem?.current_stock ?? undefined}
                          className="h-8 w-24"
                          {...register(`items.${index}.quantity`)}
                        />
                      </div>
                      {selectedItem && selectedItem.current_stock <= selectedItem.minimum_threshold && (
                        <p className="text-xs text-amber-600">⚠ Low stock — only {selectedItem.current_stock} remaining</p>
                      )}

                      <div className="space-y-1">
                        <Label htmlFor={`reason-${index}`} className="text-xs text-muted-foreground">
                          Reason
                        </Label>
                        <Select
                          value={selectedReason}
                          onValueChange={(v) =>
                            setValue(`items.${index}.reason_category`, v as FormValues["items"][number]["reason_category"], {
                              shouldValidate: true,
                            })
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

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Submitting..." : "Submit Request"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}