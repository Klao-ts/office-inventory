"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { LowStockAlert } from "@/components/admin/low-stock-alert";
import { InventoryTable } from "@/components/admin/inventory-table";
import { RestockDialog } from "@/components/admin/restock-dialog";
import { AddItemDialog } from "@/components/admin/add-item-dialog";
import { formatDate } from "@/lib/utils";
import type { Item } from "@/lib/supabase/database.types";
import { Boxes, AlertTriangle, ClipboardList } from "lucide-react";

type WithdrawalRow = {
  id: string;
  employee_name: string;
  department: string;
  quantity: number;
  requested_at: string;
  items: { name: string } | null;
};

export function InventoryDashboard({
  initialItems,
  initialWithdrawals,
}: {
  initialItems: Item[];
  initialWithdrawals: WithdrawalRow[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState<Item[]>(initialItems);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRow[]>(initialWithdrawals);
  const [restockTarget, setRestockTarget] = useState<Item | null>(null);
  const [restockOpen, setRestockOpen] = useState(false);

  const lowStockCount = items.filter((i) => i.current_stock <= i.minimum_threshold && i.is_active).length;

  // Realtime: reflect withdrawals/restocks made from any device instantly
  useEffect(() => {
    const channel = supabase
      .channel("admin-dashboard")
      .on("postgres_changes", { event: "*", schema: "public", table: "items" }, (payload) => {
        if (payload.eventType === "INSERT") {
          setItems((prev) => [...prev, payload.new as Item]);
        } else if (payload.eventType === "UPDATE") {
          setItems((prev) => prev.map((i) => (i.id === payload.new.id ? (payload.new as Item) : i)));
        }
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "withdrawals" }, async (payload) => {
        const item = items.find((i) => i.id === payload.new.item_id);
        setWithdrawals((prev) => [
          {
            id: payload.new.id,
            employee_name: payload.new.employee_name,
            department: payload.new.department,
            quantity: payload.new.quantity,
            requested_at: payload.new.requested_at,
            items: item ? { name: item.name } : null,
          },
          ...prev,
        ]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  return (
    <div className="space-y-8">
      <LowStockAlert items={items} />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Items</CardTitle>
            <Boxes className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="text-2xl font-bold">{items.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Low Stock</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent className="text-2xl font-bold text-amber-600">{lowStockCount}</CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Recent Withdrawals</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="text-2xl font-bold">{withdrawals.length}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Inventory</CardTitle>
          <AddItemDialog onCreated={(item) => setItems((prev) => [...prev, item])} />
        </CardHeader>
        <CardContent>
          <InventoryTable
            items={items}
            onRestock={(item) => {
              setRestockTarget(item);
              setRestockOpen(true);
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Withdrawals</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {withdrawals.map((w) => (
                <TableRow key={w.id}>
                  <TableCell>{w.employee_name}</TableCell>
                  <TableCell>{w.department}</TableCell>
                  <TableCell>{w.items?.name ?? "—"}</TableCell>
                  <TableCell>{w.quantity}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(w.requested_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <RestockDialog
        item={restockTarget}
        open={restockOpen}
        onOpenChange={setRestockOpen}
        onRestocked={(updated) => setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)))}
      />
    </div>
  );
}
