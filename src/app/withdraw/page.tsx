import { createClient } from "@/lib/supabase/server";
import { WithdrawalForm } from "@/components/withdrawal-form";

export const dynamic = "force-dynamic"; // always fetch fresh stock levels

export default async function WithdrawPage() {
  const supabase = createClient();

  const { data: items, error } = await supabase
    .from("items")
    .select("id, name, category, current_stock, minimum_threshold")
    .eq("is_active", true)
    .order("name");

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-10">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Request Office Supplies</h1>
        <p className="mt-1 text-sm text-slate-500">Fill in your details to withdraw an item from stock.</p>
      </div>
      <WithdrawalForm initialItems={items ?? []} fetchError={error?.message ?? null} />
    </main>
  );
}
