import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import { getCurrentStaff, hasAccess } from "@/lib/staff-auth";
import { checkAndNotifyLowStock } from "@/lib/notify";

const reasonEnum = z.enum(["general_use", "client_meeting", "new_hire", "replacement", "project", "other"]);

const bodySchema = z.object({
  branch: z.enum(["office", "factory"]),
  items: z
    .array(
      z
        .object({
          item_id: z.string().uuid(),
          quantity: z.coerce.number().int().min(1).max(10000),
          reason_category: reasonEnum,
          reason_note: z.string().trim().max(300).optional().nullable(),
        })
        .refine((row) => row.reason_category !== "other" || !!row.reason_note?.trim(), {
          message: "Please describe the reason",
          path: ["reason_note"],
        })
    )
    .min(1, "Add at least one item")
    .max(30),
});

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const { branch, items } = parsed.data;

  // Who is this, and are they approved for this branch RIGHT NOW? The browser is never trusted for this.
  const { member } = await getCurrentStaff(branch);
  if (!member || !hasAccess(member)) {
    return NextResponse.json({ error: "You don't have access to this branch." }, { status: 403 });
  }

  // Per-item limit: counted across the whole request and checked here, not in the browser.
  {
    const wanted = new Map<string, number>();
    for (const row of items) wanted.set(row.item_id, (wanted.get(row.item_id) ?? 0) + row.quantity);

    const { data: limited, error: limitError } = await createServiceClient()
      .from("items")
      .select("id, name, unit, max_withdraw_qty")
      .in("id", Array.from(wanted.keys()))
      .eq("branch", branch)
      .not("max_withdraw_qty", "is", null);
    if (limitError) {
      return NextResponse.json({ error: "Could not check item limits. Please try again." }, { status: 500 });
    }
    for (const it of limited ?? []) {
      const total = wanted.get(it.id as string) ?? 0;
      if (total > (it.max_withdraw_qty as number)) {
        return NextResponse.json(
          { error: `${it.name}: max ${it.max_withdraw_qty} ${it.unit} per withdrawal` },
          { status: 400 }
        );
      }
    }
  }

  const rpcItems = items.map((row) => ({
    item_id: row.item_id,
    quantity: row.quantity,
    reason_category: row.reason_category,
    reason_note: row.reason_category === "other" ? row.reason_note ?? null : null,
  }));

  // The database fills in the name and department from the roster, never from the browser.
  const service = createServiceClient();
  const { data, error } = await service.rpc("withdraw_items_for_staff", {
    p_staff_id: member.id,
    p_items: rpcItems,
  });

  if (error) {
    const message = error.message;
    const status = message.includes("Insufficient stock")
      ? 409
      : message.includes("not belong") || message.includes("not approved")
        ? 403
        : 400;
    return NextResponse.json({ error: message }, { status });
  }

  // The withdrawal already succeeded. An email problem must never turn it into an error.
  try {
    await checkAndNotifyLowStock(items.map((row) => ({ item_id: row.item_id, quantity: row.quantity })));
  } catch (err) {
    console.error("Low-stock notification failed:", err);
  }

  return NextResponse.json({ withdrawals: data }, { status: 201 });
}