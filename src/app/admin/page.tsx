import { createClient } from "@/lib/supabase/server";
import { InventoryDashboard } from "@/components/admin/inventory-dashboard";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const supabase = createClient();

  const [{ data: items }, { data: withdrawals }] = await Promise.all([
    supabase.from("items").select("*").order("name"),
    supabase
      .from("withdrawals")
      .select("*, items(name)")
      .order("requested_at", { ascending: false })
      .limit(25),
  ]);

  return (
    <InventoryDashboard
      initialItems={items ?? []}
      initialWithdrawals={
        (withdrawals ?? []) as unknown as Array<{
          id: string;
          employee_name: string;
          department: string;
          quantity: number;
          requested_at: string;
          items: { name: string } | null;
        }>
      }
    />
  );
}
