import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdminRequest } from "@/lib/admin-guard";
import { createServiceClient } from "@/lib/supabase/service";

const idSchema = z.string().uuid();

const updateSchema = z
  .object({
    status: z.enum(["pending", "approved", "rejected", "ordered"]).optional(),
    admin_note: z.string().trim().max(300).optional().nullable(),
  })
  .refine((v) => v.status !== undefined || v.admin_note !== undefined, { message: "Nothing to change" });

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!idSchema.safeParse(params.id).success) {
    return NextResponse.json({ error: "Invalid request id" }, { status: 400 });
  }

  const json = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const changes: Record<string, unknown> = {};
  if (parsed.data.status !== undefined) {
    changes.status = parsed.data.status;
    changes.decided_at = parsed.data.status === "pending" ? null : new Date().toISOString();
  }
  if (parsed.data.admin_note !== undefined) {
    changes.admin_note = parsed.data.admin_note?.trim() || null;
  }

  const service = createServiceClient();
  const { data, error } = await service
    .from("purchase_requests")
    .update(changes)
    .eq("id", params.id)
    .select("id, status, admin_note, decided_at")
    .single();

  if (error) {
    const notFound = error.code === "PGRST116";
    return NextResponse.json(
      { error: notFound ? "Request not found" : error.message },
      { status: notFound ? 404 : 400 }
    );
  }

  return NextResponse.json({ request: data });
}