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