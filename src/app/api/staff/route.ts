import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdminRequest } from "@/lib/admin-guard";
import { createServiceClient } from "@/lib/supabase/service";

const bodySchema = z.object({
  branch: z.enum(["office", "factory", "store"]),
  rows: z
    .array(
      z.object({
        email: z.string().trim().toLowerCase().email("One of the emails is not valid"),
        full_name: z.string().trim().min(1).max(100),
        department: z.string().trim().min(1).max(100),
      })
    )
    .min(1, "Add at least one person")
    .max(500),
});

export async function POST(request: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const { branch, rows } = parsed.data;

  // If the same email appears twice in one paste, the last line wins.
  const unique = new Map(rows.map((r) => [r.email, r]));
  const payload = Array.from(unique.values()).map((r) => ({ ...r, branch, is_active: true }));

  // Re-pasting a corrected list updates existing people instead of failing.
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("staff")
    .upsert(payload, { onConflict: "email,branch" })
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ staff: data }, { status: 201 });
}