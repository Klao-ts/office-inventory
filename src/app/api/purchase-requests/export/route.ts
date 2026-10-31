import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-guard";
import { isBranch } from "@/lib/branches";
import { createServiceClient } from "@/lib/supabase/service";

const STATUSES = ["pending", "approved", "rejected", "ordered"];

/** Quotes a CSV cell. With guard on, text that Excel could treat as a formula is made safe. */
function csvCell(value: string | number, guard = false) {
  let s = String(value ?? "");
  if (guard && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

type Group = { id: string; names: Map<string, string>; office: number; factory: number };

export async function GET(request: Request) {
  if (!(await isAdminRequest())) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const url = new URL(request.url);
  const cutoff = url.searchParams.get("cutoff") ?? "";
  const branch = url.searchParams.get("branch") ?? "all";
  const status = url.searchParams.get("status") ?? "approved";

  if (!/^\d{4}-\d{2}-\d{2}$/.test(cutoff)) {
    return new NextResponse("Choose a cut-off date first.", { status: 400 });
  }

  const service = createServiceClient();
  let query = service
    .from("purchase_requests")
    .select("branch, item_name, quantity, items(distributor_item_id)")
    .eq("cutoff_date", cutoff);
  if (isBranch(branch)) query = query.eq("branch", branch);
  if (STATUSES.includes(status)) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) {
    return new NextResponse(`Could not build the export: ${error.message}`, { status: 500 });
  }

  // Same Distributor ID = same product, so quantities from both branches are added together.
  const groups = new Map<string, Group>();
  for (const r of data ?? []) {
    const rel = r.items as { distributor_item_id: string | null } | { distributor_item_id: string | null }[] | null;
    const rawId = Array.isArray(rel) ? rel[0]?.distributor_item_id : rel?.distributor_item_id;
    const distId = (rawId ?? "").trim();
    const name = String(r.item_name).trim();

    const key = distId ? `id:${distId.toLowerCase()}` : `name:${name.toLowerCase()}`;
    let g = groups.get(key);
    if (!g) {
      g = { id: distId, names: new Map(), office: 0, factory: 0 };
      groups.set(key, g);
    }
    const nameKey = name.toLowerCase();
    if (!g.names.has(nameKey)) g.names.set(nameKey, name);

    const qty = Number(r.quantity) || 0;
    if (r.branch === "factory") g.factory += qty;
    else g.office += qty;
  }

  const sorted = Array.from(groups.values()).sort((a, b) => {
    if (!!a.id !== !!b.id) return a.id ? -1 : 1; // items with an ID first
    const an = a.id || Array.from(a.names.values())[0];
    const bn = b.id || Array.from(b.names.values())[0];
    return an.localeCompare(bn);
  });

  const lines = [
    ["Distributor Item ID", "Item name", "Total quantity", "Office", "Factory", "Remark"]
      .map((h) => csvCell(h))
      .join(","),
  ];

  for (const g of sorted) {
    const names = Array.from(g.names.values());
    const remark = !g.id ? "No Distributor ID yet" : names.length > 1 ? "Different names used in requests" : "";
    lines.push(
      [
        csvCell(g.id),
        csvCell(names.join(" / "), true),
        csvCell(g.office + g.factory),
        csvCell(g.office),
        csvCell(g.factory),
        csvCell(remark),
      ].join(",")
    );
  }

  // The leading BOM makes Excel read Thai text correctly.
  const csv = "\uFEFF" + lines.join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="order-requests-${cutoff}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}