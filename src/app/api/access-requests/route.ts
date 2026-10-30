import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getMembership, isAllowedEmail } from "@/lib/staff-auth";

const bodySchema = z.object({
  branch: z.enum(["office", "factory", "store"]),
  department: z.string().trim().min(2, "Enter your department").max(100),
});

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user?.email?.toLowerCase();

  if (!user || !email) {
    return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
  }
  if (!user.identities?.some((i) => i.provider === "google")) {
    return NextResponse.json({ error: "Please sign in with Google." }, { status: 403 });
  }
  if (!isAllowedEmail(email)) {
    return NextResponse.json({ error: "Only company accounts can request access." }, { status: 403 });
  }

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const { branch, department } = parsed.data;

  const existing = await getMembership(email, branch);
  if (existing) {
    return NextResponse.json({ error: "You already have a request or access for this branch." }, { status: 409 });
  }

  const meta = (user.user_metadata ?? {}) as { full_name?: string; name?: string };
  const fullName = (meta.full_name || meta.name || email.split("@")[0]).trim();

  const service = createServiceClient();
  const { error } = await service.from("staff").insert({
    email,
    full_name: fullName,
    department,
    branch,
    status: "pending",
    is_active: true,
    requested_at: new Date().toISOString(),
  });

  if (error) {
    const message = error.code === "23505" ? "You already have a request for this branch." : "Could not send your request.";
    return NextResponse.json({ error: message }, { status: error.code === "23505" ? 409 : 500 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}