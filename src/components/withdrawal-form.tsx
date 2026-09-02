"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ScanLine } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { QrScanner } from "@/components/qr-scanner";

type ItemOption = {
  id: string;
  name: string;
  category: string;
  current_stock: number;
  minimum_threshold: number;
};

const formSchema = z.object({
  employee_name: z.string().min(2, "Enter your full name"),
  employee_id: z.string().optional(),
  department: z.string().min(2, "Enter your department"),
  item_id: z.string().uuid("Select an item"),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1"),
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
  const [showScanner, setShowScanner] = useState(false);

  const searchParams = useSearchParams();
  const router = useRouter();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(formSchema) });

  const selectedItemId = watch("item_id");
  const selectedItem = items.find((i) => i.id === selectedItemId);

  // Open scanner automatically if arrived via ?scan=1 (e.g. from the home page QR tile)
  useEffect(() => {
    if (searchParams.get("scan") === "1") setShowScanner(true);
  }, [searchParams]);

  // Real-time stock sync: keep quantities live as other people submit withdrawals
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

  const onScanResult = (value: string) => {
    setShowScanner(false);
    // If the QR encodes a direct withdraw URL with ?item=<id>, prefill it.
    try {
      const url = new URL(value);
      const itemParam = url.searchParams.get("item");
      if (itemParam) setValue("item_id", itemParam);
    } catch {
      // Not a URL — ignore (this scanner is mainly used to jump to this page)
    }
    router.replace("/withdraw");
  };

  const onSubmit = async (values: FormValues) => {
    if (selectedItem && values.quantity > selectedItem.current_stock) {
      toast.error(`Only ${selectedItem.current_stock} left in stock`);
      return;
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

      toast.success("Request submitted — item withdrawn from stock.");
      setSubmitted(true);
      reset();
      setItems((prev) =>
        prev.map((item) =>
          item.id === values.item_id
            ? { ...item, current_stock: item.current_stock - values.quantity }
            : item
        )
      );
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

  if (showScanner) {
    return (
      <div className="flex flex-col items-center gap-4">
        <QrScanner onResult={onScanResult} onClose={() => setShowScanner(false)} />
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        {submitted ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <p className="text-lg font-medium text-slate-900">Request submitted!</p>
            <p className="text-sm text-muted-foreground">Your item has been deducted from inventory.</p>
            <Button onClick={() => setSubmitted(false)}>Submit another request</Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="flex justify-end">
              <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => setShowScanner(true)}>
                <ScanLine className="h-4 w-4" /> Scan QR
              </Button>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="employee_name">Employee Name</Label>
              <Input id="employee_name" placeholder="Jane Doe" {...register("employee_name")} />
              {errors.employee_name && <p className="text-xs text-destructive">{errors.employee_name.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="employee_id">Employee ID (optional)</Label>
              <Input id="employee_id" placeholder="EMP-1024" {...register("employee_id")} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="department">Department</Label>
              <Input id="department" placeholder="Finance" {...register("department")} />
              {errors.department && <p className="text-xs text-destructive">{errors.department.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Item</Label>
              <Select value={selectedItemId} onValueChange={(v) => setValue("item_id", v, { shouldValidate: true })}>
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
              {errors.item_id && <p className="text-xs text-destructive">{errors.item_id.message}</p>}
              {selectedItem && selectedItem.current_stock <= selectedItem.minimum_threshold && (
                <p className="text-xs text-amber-600">⚠ Low stock — only {selectedItem.current_stock} remaining</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                min={1}
                max={selectedItem?.current_stock ?? undefined}
                {...register("quantity")}
              />
              {errors.quantity && <p className="text-xs text-destructive">{errors.quantity.message}</p>}
            </div>

            <Button type="submit" className="w-full" disabled={submitting || !selectedItem}>
              {submitting ? "Submitting..." : "Submit Request"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
