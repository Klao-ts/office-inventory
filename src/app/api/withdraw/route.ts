import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const reasonEnum = z.enum(["general_use", "client_meeting", "new_hire", "replacement", "project", "other"]);

const bodySchema = z.object({
  employee_name: z.string().min(2),
  department: z.string().min(2),
  items: z
    .array(
      z.object({
        item_id: z.string().uuid(),
        quantity: z.coerce.number().int().min(1),
        reason_category: reasonEnum,
        reason_note: z.string().optional().nullable(),
      })
    )
    .min(1, "Add at least one item"),
});

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const { employee_name, department, items } = parsed.data;
  const supabase = createClient();

  const rpcItems = items.map((row) => ({
    item_id: row.item_id,
    quantity: row.quantity,
    reason_category: row.reason_category,
    reason_note: row.reason_category === "other" ? row.reason_note ?? null : null,
  }));

  // @ts-ignore — supabase-js generic overload resolution quirk; payload is already validated by zod above
  const { data, error } = await supabase.rpc("withdraw_items", {
    p_employee_name: employee_name,
    p_department: department,
    p_items: rpcItems,
  });

  if (error) {
    const status = error.message.includes("Insufficient stock") ? 409 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }

  return NextResponse.json({ withdrawals: data }, { status: 201 });
}