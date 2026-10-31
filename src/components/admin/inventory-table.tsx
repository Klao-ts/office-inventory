"use client";

import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EditItemDialog } from "@/components/admin/edit-item-dialog";
import { formatCurrency } from "@/lib/utils";
import type { Item } from "@/lib/supabase/database.types";
import { PackagePlus } from "lucide-react";

const branchLabel = (b: string) => (b === "factory" ? "Factory" : b === "office" ? "Office" : b);

export function InventoryTable({ items, onRestock }: { items: Item[]; onRestock: (item: Item) => void }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Item</TableHead>
          <TableHead>Branch</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Distributor ID</TableHead>
          <TableHead>Unit Price</TableHead>
          <TableHead>Stock</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => {
          const isLow = item.current_stock <= item.minimum_threshold;
          return (
            <TableRow key={item.id}>
              <TableCell className="font-medium">{item.name}</TableCell>
              <TableCell>
                <Badge variant="secondary">{branchLabel(item.branch)}</Badge>
              </TableCell>
              <TableCell>{item.category}</TableCell>
              <TableCell className="text-muted-foreground">{item.distributor_item_id ?? "—"}</TableCell>
              <TableCell>{formatCurrency(item.unit_price)}</TableCell>
              <TableCell>{item.current_stock}</TableCell>
              <TableCell>
                {isLow ? (
                  <Badge variant="warning">Low stock</Badge>
                ) : (
                  <Badge variant="success">In stock</Badge>
                )}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <EditItemDialog item={item} />
                  <Button size="sm" variant="outline" className="gap-2" onClick={() => onRestock(item)}>
                    <PackagePlus className="h-4 w-4" /> Restock
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}