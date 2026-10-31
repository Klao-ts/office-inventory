import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const updateSchema = z.object({
  name: z.string().min(2),
  category: z.string().min(1),
  distributor_item_id: z.string().optional().nullable(),
  unit_price: z.coerce.number().min(0),
  minimum_threshold: z.coerce.number().int().min(0),
});

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || (user.app_metadata as { role?: string } | null)?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const changes = {
    ...parsed.data,
    distributor_item_id: parsed.data.distributor_item_id?.trim() || null,
  };

  // @ts-ignore: supabase-js update() overload quirk; the payload is already validated by zod above
  const { data, error } = await supabase.from("items").update(changes).eq("id", params.id).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ item: data });
}