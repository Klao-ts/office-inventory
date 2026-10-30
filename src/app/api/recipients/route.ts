import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdminRequest } from "@/lib/admin-guard";
import { createServiceClient } from "@/lib/supabase/service";

const createSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  label: z.string().trim().max(60).optional().nullable(),
  branch: z.enum(["office", "factory"]).nullable(),
  notify_low_stock: z.boolean(),
  notify_purchase_request: z.boolean(),
});

export async function POST(request: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("notification_recipients")
    .insert({ ...parsed.data, label: parsed.data.label || null })
    .select()
    .single();

  if (error) {
    const message = error.code === "23505" ? "That email is already on the list for this branch" : error.message;
    return NextResponse.json({ error: message }, { status: 400 });
  }

  return NextResponse.json({ recipient: data }, { status: 201 });
}