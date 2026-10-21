import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdminRequest } from "@/lib/admin-guard";
import { createServiceClient } from "@/lib/supabase/service";

const idSchema = z.string().uuid();

const updateSchema = z
  .object({
    notify_low_stock: z.boolean().optional(),
    notify_purchase_request: z.boolean().optional(),
    is_active: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to update" });

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!idSchema.safeParse(params.id).success) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const json = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("notification_recipients")
    .update(parsed.data)
    .eq("id", params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ recipient: data });
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!idSchema.safeParse(params.id).success) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { error } = await supabase.from("notification_recipients").delete().eq("id", params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}