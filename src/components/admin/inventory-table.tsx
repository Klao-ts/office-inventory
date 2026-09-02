"use client";

import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import type { Item } from "@/lib/supabase/database.types";
import { PackagePlus } from "lucide-react";

export function InventoryTable({ items, onRestock }: { items: Item[]; onRestock: (item: Item) => void }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Item</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>SKU</TableHead>
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
              <TableCell>{item.category}</TableCell>
              <TableCell className="text-muted-foreground">{item.sku ?? "—"}</TableCell>
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
                <Button size="sm" variant="outline" className="gap-2" onClick={() => onRestock(item)}>
                  <PackagePlus className="h-4 w-4" /> Restock
                </Button>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
