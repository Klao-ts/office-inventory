import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  item_id: z.string().uuid(),
  added_quantity: z.coerce.number().int().min(1),
  supplier: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
  unit_price: z.coerce.number().min(0).optional().nullable(),
});

export async function POST(request: Request) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || (user.app_metadata as { role?: string } | null)?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const { item_id, added_quantity, supplier, note, unit_price } = parsed.data;

  const { data, error } = await supabase.rpc("restock_item", {
    p_item_id: item_id,
    p_added_quantity: added_quantity,
    p_supplier: supplier ?? null,
    p_note: note ?? null,
    p_unit_price: unit_price ?? null,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ item: data }, { status: 200 });
}
