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

type ItemInfo = { distributor_item_id: string | null; unit: string | null; seller: string | null };

type Group = {
  id: string;
  names: Map<string, string>;
  units: Set<string>;
  sellers: Set<string>;
  office: number;
  factory: number;
};

export async function GET(request: Request) {
  if (!(await isAdminRequest())) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const url = new URL(request.url);
  const cutoff = url.searchParams.get("cutoff") ?? "";
  const branch = url.searchParams.get("branch") ?? "all";
  const status = url.searchParams.get("status") ?? "approved";
  const seller = url.searchParams.get("seller") ?? "all"; // "all", "__none__", or a seller name

  if (!/^\d{4}-\d{2}-\d{2}$/.test(cutoff)) {
    return new NextResponse("Choose a cut-off date first.", { status: 400 });
  }

  const service = createServiceClient();
  let query = service
    .from("purchase_requests")
    .select("branch, item_name, quantity, items(distributor_item_id, unit, seller)")
    .eq("cutoff_date", cutoff);
  if (isBranch(branch)) query = query.eq("branch", branch);
  if (STATUSES.includes(status)) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) {
    return new NextResponse(`Could not build the export: ${error.message}`, { status: 500 });
  }

  const wantSeller = seller.trim().toLowerCase();

  // Same Distributor ID = same product, so quantities from both branches are added together.
  const groups = new Map<string, Group>();
  for (const r of data ?? []) {
    const rel = r.items as ItemInfo | ItemInfo[] | null;
    const item = Array.isArray(rel) ? rel[0] ?? null : rel;
    const distId = (item?.distributor_item_id ?? "").trim();
    const itemSeller = (item?.seller ?? "").trim();
    const unit = (item?.unit ?? "").trim();

    // Seller filter. Typed items (no linked item) have no seller.
    if (seller === "__none__") {
      if (itemSeller) continue;
    } else if (seller !== "all") {
      if (itemSeller.toLowerCase() !== wantSeller) continue;
    }

    const name = String(r.item_name).trim();
    const key = distId ? `id:${distId.toLowerCase()}` : `name:${name.toLowerCase()}`;
    let g = groups.get(key);
    if (!g) {
      g = { id: distId, names: new Map(), units: new Set(), sellers: new Set(), office: 0, factory: 0 };
      groups.set(key, g);
    }
    const nameKey = name.toLowerCase();
    if (!g.names.has(nameKey)) g.names.set(nameKey, name);
    if (unit) g.units.add(unit);
    if (itemSeller) g.sellers.add(itemSeller);

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
    ["Distributor Item ID", "Item name", "Unit", "Total quantity", "Office", "Factory", "Seller", "Remark"]
      .map((h) => csvCell(h))
      .join(","),
  ];

  for (const g of sorted) {
    const names = Array.from(g.names.values());
    const remarks: string[] = [];
    if (!g.id) remarks.push("No Distributor ID yet");
    if (names.length > 1) remarks.push("Different names used in requests");
    if (g.units.size > 1) remarks.push("Different units used");
    if (g.sellers.size > 1) remarks.push("Different sellers");

    lines.push(
      [
        csvCell(g.id),
        csvCell(names.join(" / "), true),
        csvCell(Array.from(g.units).join(" / "), true),
        csvCell(g.office + g.factory),
        csvCell(g.office),
        csvCell(g.factory),
        csvCell(Array.from(g.sellers).join(" / "), true),
        csvCell(remarks.join("; ")),
      ].join(",")
    );
  }

  // The leading BOM makes Excel read Thai text correctly.
  const csv = "\uFEFF" + lines.join("\r\n");

  let suffix = "";
  if (seller === "__none__") suffix = "-no-seller";
  else if (seller !== "all") {
    const slug = seller.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30);
    suffix = `-${slug || "seller"}`;
  }

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="order-requests-${cutoff}${suffix}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}