import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import { isBranch } from "@/lib/branches";
import { getCurrentStaff, hasAccess } from "@/lib/staff-auth";
import { createServiceClient } from "@/lib/supabase/service";
import { getNextCutoff } from "@/lib/pr-cutoff";
import { notifyPurchaseRequest } from "@/lib/notify";

const bodySchema = z.object({
  branch: z.string(),
  lines: z
    .array(
      z.object({
        id: z.string().uuid(),
        quantity: z.coerce.number().int().min(1, "Quantity must be at least 1").max(9999),
        note: z.string().trim().max(300).optional(),
      })
    )
    .min(1, "Choose at least one item")
    .max(30, "Too many items in one request"),
});

type Original = { id: string; item_id: string | null; item_name: string; status: string };

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

  const ids = lines.map((l) => l.id);
  if (new Set(ids).size !== ids.length) {
    return NextResponse.json({ error: "The same item was chosen twice." }, { status: 400 });
  }

  const service = createServiceClient();

  // Only this person's own lines, in this branch.
  const { data: found, error: findError } = await service
    .from("purchase_requests")
    .select("id, item_id, item_name, status")
    .in("id", ids)
    .eq("staff_id", member.id)
    .eq("branch", branch);
  if (findError) {
    return NextResponse.json({ error: "Could not check your request. Please try again." }, { status: 500 });
  }

  const originals = (found ?? []) as Original[];
  if (originals.length !== ids.length) {
    return NextResponse.json({ error: "Some of these items can't be resubmitted." }, { status: 400 });
  }
  if (originals.some((o) => o.status !== "rejected")) {
    return NextResponse.json({ error: "Only declined items can be resubmitted." }, { status: 400 });
  }

  const { data: already, error: alreadyError } = await service
    .from("purchase_requests")
    .select("id")
    .in("resubmitted_from", ids);
  if (alreadyError) {
    return NextResponse.json({ error: "Could not check your request. Please try again." }, { status: 500 });
  }
  if ((already ?? []).length > 0) {
    return NextResponse.json(
      { error: "Some of these items were already resubmitted. Please refresh the page." },
      { status: 409 }
    );
  }

  // Keep the link to the item only if it is still active in this branch.
  const itemIds = Array.from(new Set(originals.map((o) => o.item_id).filter((v): v is string => !!v)));
  const activeItems = new Set<string>();
  if (itemIds.length > 0) {
    const { data: items } = await service
      .from("items")
      .select("id")
      .in("id", itemIds)
      .eq("branch", branch)
      .eq("is_active", true);
    for (const it of items ?? []) activeItems.add(it.id as string);
  }

  // Per-item limit: counted across the whole resubmission.
  {
    const wantedById = new Map<string, number>();
    for (const l of lines) {
      const orig = originals.find((o) => o.id === l.id);
      if (orig?.item_id && activeItems.has(orig.item_id)) {
        wantedById.set(orig.item_id, (wantedById.get(orig.item_id) ?? 0) + l.quantity);
      }
    }
    if (wantedById.size > 0) {
      const { data: limited, error: limitError } = await service
        .from("items")
        .select("id, name, unit, max_request_qty")
        .in("id", Array.from(wantedById.keys()))
        .not("max_request_qty", "is", null);
      if (limitError) {
        return NextResponse.json({ error: "Could not check item limits. Please try again." }, { status: 500 });
      }
      for (const it of limited ?? []) {
        const total = wantedById.get(it.id as string) ?? 0;
        if (total > (it.max_request_qty as number)) {
          return NextResponse.json(
            { error: `${it.name}: max ${it.max_request_qty} ${it.unit} per request` },
            { status: 400 }
          );
        }
      }
    }
  }

  const byId = new Map(originals.map((o) => [o.id, o]));
  const groupId = randomUUID();
  const cutoff = getNextCutoff();

  const rows = lines.map((l) => {
    const orig = byId.get(l.id)!;
    return {
      group_id: groupId,
      staff_id: member.id,
      branch,
      item_id: orig.item_id && activeItems.has(orig.item_id) ? orig.item_id : null,
      item_name: orig.item_name,
      quantity: l.quantity,
      note: l.note || null,
      cutoff_date: cutoff.iso,
      resubmitted_from: orig.id,
    };
  });

  const { error: insertError } = await service.from("purchase_requests").insert(rows);
  if (insertError) {
    if (insertError.code === "23505") {
      return NextResponse.json(
        { error: "Some of these items were already resubmitted. Please refresh the page." },
        { status: 409 }
      );
    }
    console.error("Resubmit insert failed:", insertError.message);
    return NextResponse.json({ error: "Could not save your request. Please try again." }, { status: 500 });
  }

  // The request is already saved. If the email fails, the staff member still sees success.
  try {
    await notifyPurchaseRequest({
      staffName: member.full_name,
      department: member.department,
      branch,
      cutoffLabel: cutoff.label,
      resubmission: true,
      lines: rows.map((r) => ({ name: r.item_name, quantity: r.quantity, note: r.note })),
    });
  } catch (err) {
    console.error("Resubmission email failed:", err);
  }

  return NextResponse.json({ ok: true, count: rows.length, cutoff: cutoff.label }, { status: 201 });
}