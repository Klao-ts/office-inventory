import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import { isBranch } from "@/lib/branches";
import { getCurrentStaff, hasAccess } from "@/lib/staff-auth";
import { createServiceClient } from "@/lib/supabase/service";
import { getNextCutoff } from "@/lib/pr-cutoff";

const lineSchema = z.object({
  item_id: z.string().uuid().nullable().optional(),
  item_name: z.string().trim().max(100).optional(),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1").max(9999),
  note: z.string().trim().max(300).optional(),
});

const bodySchema = z.object({
  branch: z.string(),
  lines: z.array(lineSchema).min(1, "Add at least one item").max(30, "Too many items in one request"),
});

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const { branch, lines } = parsed.data;
  if (!isBranch(branch)) {
    return NextResponse.json({ error: "Unknown branch" }, { status: 400 });
  }

  // Checked on every request: signed in with Google, approved, and switched on for THIS branch.
  const { member } = await getCurrentStaff(branch);
  if (!member || !hasAccess(member)) {
    return NextResponse.json({ error: "You don't have access to this branch." }, { status: 403 });
  }

  const service = createServiceClient();

  // Look up chosen items on the server: they must belong to this branch and be active.
  const ids = Array.from(new Set(lines.map((l) => l.item_id).filter((v): v is string => !!v)));
  const names = new Map<string, string>();
  if (ids.length > 0) {
    const { data, error } = await service
      .from("items")
      .select("id, name")
      .in("id", ids)
      .eq("branch", branch)
      .eq("is_active", true);
    if (error) {
      return NextResponse.json({ error: "Could not check the items. Please try again." }, { status: 500 });
    }
    for (const row of data ?? []) names.set(row.id, row.name);
  }

  const groupId = randomUUID();
  const cutoff = getNextCutoff();
  const rows: Record<string, unknown>[] = [];

  for (const line of lines) {
    let itemName: string;
    let itemId: string | null = null;

    if (line.item_id) {
      const found = names.get(line.item_id);
      if (!found) {
        return NextResponse.json({ error: "One of the items isn't available for this branch." }, { status: 400 });
      }
      itemId = line.item_id;
      itemName = found;
    } else {
      itemName = (line.item_name ?? "").trim();
      if (itemName.length < 2) {
        return NextResponse.json({ error: "Please type the item name." }, { status: 400 });
      }
    }

    rows.push({
      group_id: groupId,
      staff_id: member.id,
      branch,
      item_id: itemId,
      item_name: itemName,
      quantity: line.quantity,
      note: line.note || null,
      cutoff_date: cutoff.iso,
    });
  }

  const { error: insertError } = await service.from("purchase_requests").insert(rows);
  if (insertError) {
    console.error("Order request insert failed:", insertError.message);
    return NextResponse.json({ error: "Could not save your request. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, count: rows.length, cutoff: cutoff.label }, { status: 201 });
}