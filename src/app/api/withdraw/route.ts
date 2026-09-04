import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  employee_name: z.string().min(2),
  employee_id: z.string().optional().nullable(),
  department: z.string().min(2),
  item_id: z.string().uuid(),
  quantity: z.coerce.number().int().min(1),
});

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const { employee_name, employee_id, department, item_id, quantity } = parsed.data;
  const supabase = createClient();

  // withdraw_item() is a SECURITY DEFINER Postgres function that locks the
  // item row (SELECT ... FOR UPDATE), re-checks stock, deducts, and inserts
  // the withdrawal record — all inside one transaction. This is what makes
  // concurrent withdrawals safe (no race condition between check and update).
  // @ts-ignore — supabase-js generic overload resolution quirk; payload is already validated by zod above
  const { data, error } = await supabase.rpc("withdraw_item", {
    p_item_id: item_id,
    p_employee_name: employee_name,
    p_employee_id: employee_id ?? null,
    p_department: department,
    p_quantity: quantity,
  });

  if (error) {
    const status = error.message.includes("Insufficient stock") ? 409 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }

  return NextResponse.json({ withdrawal: data }, { status: 201 });
}