import { createServiceClient } from "@/lib/supabase/service";

type NotifyKind = "low_stock" | "purchase_request";

export type LowStockItem = {
  name: string;
  branch: string;
  current_stock: number;
  minimum_threshold: number;
};

const BRANCH_LABELS: Record<string, string> = {
  office: "Office",
  factory: "Factory",
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Sends one email through Resend. Returns true on success; never throws. */
export async function sendEmail(to: string, subject: string, html: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !from) {
    console.error("Email not sent: RESEND_API_KEY or RESEND_FROM_EMAIL is missing");
    return false;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: [to], subject, html }),
    });

    if (!res.ok) {
      console.error("Resend rejected the email:", res.status, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error("Could not reach Resend:", err);
    return false;
  }
}

/** Active recipients who opted in to this kind of notification. */
export async function getRecipients(kind: NotifyKind) {
  const supabase = createServiceClient();
  const column = kind === "low_stock" ? "notify_low_stock" : "notify_purchase_request";

  const { data, error } = await supabase
    .from("notification_recipients")
    .select("email, branch")
    .eq("is_active", true)
    .eq(column, true);

  if (error) {
    console.error("Could not load notification recipients:", error.message);
    return [];
  }
  return (data ?? []) as { email: string; branch: string | null }[];
}

/** Emails each recipient about the low-stock items that belong to their branch(es). */
export async function notifyLowStock(items: LowStockItem[]) {
  if (items.length === 0) return;

  const recipients = await getRecipients("low_stock");

  // One person can be listed for several branches; group by email so they get one email.
  const scopes = new Map<string, Array<string | null>>();
  for (const r of recipients) {
    scopes.set(r.email, [...(scopes.get(r.email) ?? []), r.branch]);
  }

  for (const [email, branches] of scopes) {
    const mine = items.filter((i) => branches.includes(null) || branches.includes(i.branch));
    if (mine.length === 0) continue;

    const rows = mine
      .map(
        (i) =>
          `<tr>
            <td style="padding:6px 12px;border-bottom:1px solid #eee">${escapeHtml(i.name)}</td>
            <td style="padding:6px 12px;border-bottom:1px solid #eee">${escapeHtml(BRANCH_LABELS[i.branch] ?? i.branch)}</td>
            <td style="padding:6px 12px;border-bottom:1px solid #eee"><b>${i.current_stock}</b></td>
            <td style="padding:6px 12px;border-bottom:1px solid #eee">${i.minimum_threshold}</td>
          </tr>`
      )
      .join("");

    const html = `
      <div style="font-family:Arial,sans-serif;font-size:14px;color:#111">
        <p>The following item(s) have reached their minimum stock level:</p>
        <table style="border-collapse:collapse">
          <thead>
            <tr style="text-align:left;background:#f5f5f5">
              <th style="padding:6px 12px">Item</th>
              <th style="padding:6px 12px">Branch</th>
              <th style="padding:6px 12px">In stock</th>
              <th style="padding:6px 12px">Minimum</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <p style="color:#666">Sent automatically by the Office Supplies Inventory system.</p>
      </div>`;

    const subject = mine.length === 1 ? `Low stock: ${mine[0].name}` : `Low stock: ${mine.length} items`;
    await sendEmail(email, subject, html);
  }
}

/**
 * Call after a successful withdrawal. Works out which items just dropped to or
 * below their minimum threshold during THIS request, and alerts the right people.
 */
export async function checkAndNotifyLowStock(withdrawn: { item_id: string; quantity: number }[]) {
  const qtyById = new Map<string, number>();
  for (const w of withdrawn) {
    qtyById.set(w.item_id, (qtyById.get(w.item_id) ?? 0) + w.quantity);
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("items")
    .select("id, name, branch, current_stock, minimum_threshold")
    .in("id", Array.from(qtyById.keys()));

  if (error || !data) {
    console.error("Could not check stock levels for notifications:", error?.message);
    return;
  }

  const crossed: LowStockItem[] = [];
  for (const item of data as Array<LowStockItem & { id: string }>) {
    const before = item.current_stock + (qtyById.get(item.id) ?? 0);
    if (before > item.minimum_threshold && item.current_stock <= item.minimum_threshold) {
      crossed.push(item);
    }
  }

  await notifyLowStock(crossed);
}

export type OrderRequestEmail = {
  staffName: string;
  department: string;
  branch: string;
  cutoffLabel: string;
  lines: { name: string; quantity: number; note: string | null }[];
};

/** Tells the admin(s) about a new order request. One email per request, however many items it has. */
export async function notifyPurchaseRequest(req: OrderRequestEmail) {
  const recipients = await getRecipients("purchase_request");

  // Same person may be listed for several branches; they still get one email.
  const scopes = new Map<string, Array<string | null>>();
  for (const r of recipients) {
    scopes.set(r.email, [...(scopes.get(r.email) ?? []), r.branch]);
  }

  const branchLabel = BRANCH_LABELS[req.branch] ?? req.branch;
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");

  const rows = req.lines
    .map(
      (l) =>
        `<tr>
          <td style="padding:6px 12px;border-bottom:1px solid #eee">${escapeHtml(l.name)}</td>
          <td style="padding:6px 12px;border-bottom:1px solid #eee"><b>${l.quantity}</b></td>
          <td style="padding:6px 12px;border-bottom:1px solid #eee">${l.note ? escapeHtml(l.note) : ""}</td>
        </tr>`
    )
    .join("");

  const html = `
    <div style="font-family:Arial,sans-serif;font-size:14px;color:#111">
      <p><b>${escapeHtml(req.staffName)}</b> (${escapeHtml(req.department)}, ${escapeHtml(branchLabel)})
         sent an order request. It counts toward the ${escapeHtml(req.cutoffLabel)} cut-off.</p>
      <table style="border-collapse:collapse">
        <thead>
          <tr style="text-align:left;background:#f5f5f5">
            <th style="padding:6px 12px">Item</th>
            <th style="padding:6px 12px">Qty</th>
            <th style="padding:6px 12px">Note</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      ${appUrl ? `<p><a href="${appUrl}/admin/orders">Open Order Requests</a></p>` : ""}
      <p style="color:#666">Sent automatically by the Office Supplies Inventory system.</p>
    </div>`;

  const subject = `Order request: ${req.staffName} (${branchLabel}), ${req.lines.length} item${
    req.lines.length === 1 ? "" : "s"
  }`;

  for (const [email, branches] of scopes) {
    if (!branches.includes(null) && !branches.includes(req.branch)) continue;
    await sendEmail(email, subject, html);
  }
}