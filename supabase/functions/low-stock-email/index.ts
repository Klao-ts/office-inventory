// Supabase Edge Function: low-stock-email
// Triggered by the `notify_low_stock()` Postgres trigger (via pg_net.http_post)
// whenever an item's stock drops to or below its minimum_threshold.
//
// Deploy:
//   supabase functions deploy low-stock-email --no-verify-jwt
// Set secrets:
//   supabase secrets set RESEND_API_KEY=xxxx LOW_STOCK_ALERT_EMAIL=admin@company.com
//
// Then in the SQL editor, set the webhook URL the trigger calls:
//   alter database postgres set app.settings.low_stock_webhook_url =
//     'https://<project-ref>.supabase.co/functions/v1/low-stock-email';

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

interface LowStockPayload {
  item_id: string;
  name: string;
  current_stock: number;
  minimum_threshold: number;
}

serve(async (req) => {
  try {
    const payload: LowStockPayload = await req.json();
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const alertEmail = Deno.env.get("LOW_STOCK_ALERT_EMAIL");

    if (!resendApiKey || !alertEmail) {
      return new Response(JSON.stringify({ error: "Missing RESEND_API_KEY or LOW_STOCK_ALERT_EMAIL" }), {
        status: 500,
      });
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Inventory Alerts <alerts@yourdomain.com>",
        to: [alertEmail],
        subject: `Low Stock Alert: ${payload.name}`,
        html: `
          <p><strong>${payload.name}</strong> has reached a low stock level.</p>
          <ul>
            <li>Current stock: ${payload.current_stock}</li>
            <li>Minimum threshold: ${payload.minimum_threshold}</li>
          </ul>
          <p>Please restock soon.</p>
        `,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return new Response(JSON.stringify({ error: err }), { status: 502 });
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500 });
  }
});
