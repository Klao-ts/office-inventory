# Office Supplies Inventory & Withdrawal System

Next.js 14 (App Router, TypeScript) + Tailwind + shadcn-style UI + Supabase (Postgres, Auth, RLS, Realtime), deployable to Vercel.

## Features
- Public QR-code-driven withdrawal form (mobile-first) with live stock display
- Built-in QR scanner (`@yudiel/react-qr-scanner`) and QR generator (`qrcode.react`)
- **Atomic** stock deduction via a Postgres `SECURITY DEFINER` function using row locking (`SELECT ... FOR UPDATE`) — safe under concurrent submissions
- Admin dashboard: add items, restock, live low-stock badges, realtime updates via Supabase Realtime
- Row Level Security: public can only read active items and submit withdrawals through the RPC; only admins can write to `items`/`restocks` or read the full `withdrawals` log
- Optional low-stock email notification via a Postgres trigger → `pg_net` → Supabase Edge Function → Resend

## Folder Structure
```
office-inventory/
├── supabase/
│   ├── schema.sql                 # tables, RLS, atomic functions, triggers
│   └── functions/low-stock-email/ # optional Edge Function (Resend email)
├── src/
│   ├── middleware.ts              # session refresh + /admin route guard
│   ├── app/
│   │   ├── page.tsx               # home: QR code + quick links
│   │   ├── withdraw/page.tsx      # public withdrawal form
│   │   ├── login/page.tsx         # admin login
│   │   ├── admin/                 # protected admin dashboard
│   │   └── api/
│   │       ├── withdraw/route.ts  # POST -> calls withdraw_item() RPC
│   │       ├── restock/route.ts   # POST -> calls restock_item() RPC (admin)
│   │       └── items/route.ts     # GET list / POST create item (admin)
│   ├── components/
│   │   ├── ui/                    # shadcn-style primitives (button, input, ...)
│   │   ├── admin/                 # dashboard, tables, dialogs
│   │   ├── qr-generator.tsx
│   │   ├── qr-scanner.tsx
│   │   └── withdrawal-form.tsx
│   └── lib/
│       ├── supabase/{client,server}.ts
│       └── utils.ts
├── package.json
├── tailwind.config.ts
└── .env.example
```

## 1. Create the Supabase project
1. Go to https://supabase.com/dashboard → New Project.
2. Open **SQL Editor** → paste the contents of `supabase/schema.sql` → Run.
   This creates `items`, `withdrawals`, `restocks`, the `withdraw_item()` / `restock_item()` atomic functions, RLS policies, the low-stock view/trigger, and seed data.
3. Go to **Project Settings → API** and copy:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (server-only, never expose client-side)

## 2. Create an admin user
Sign-up is intentionally **not** self-service for admins. Create the user, then promote them:

1. **Authentication → Users → Add user** (email + password, or invite by email).
2. Promote to admin — run in SQL Editor (replace the UUID with the new user's id):
   ```sql
   update auth.users
   set raw_app_meta_data = raw_app_meta_data || '{"role": "admin"}'::jsonb
   where id = '<user-uuid>';
   ```
   `app_metadata` is only settable server-side, so employees can never grant themselves admin.

## 3. Local setup
```bash
git clone <your-repo-url> office-inventory
cd office-inventory
npm install
cp .env.example .env.local
# fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
npm run dev
```
Visit `http://localhost:3000` — the home page renders a QR code pointing at `/withdraw`. Scan it (or click **Request Item**) to test the withdrawal flow; sign in at `/login` with your admin account to test the dashboard.

## 4. (Optional) Low-stock email notifications
1. Install the Supabase CLI and link your project: `supabase link --project-ref <ref>`.
2. `supabase functions deploy low-stock-email --no-verify-jwt`
3. `supabase secrets set RESEND_API_KEY=... LOW_STOCK_ALERT_EMAIL=admin@yourcompany.com`
4. In the SQL Editor:
   ```sql
   alter database postgres set app.settings.low_stock_webhook_url =
     'https://<project-ref>.supabase.co/functions/v1/low-stock-email';
   ```
   The existing `notify_low_stock()` trigger (already created by `schema.sql`) will now POST to this function whenever stock crosses the threshold.

## 5. Deploy to Vercel (GitHub integration)
1. Push this project to a new GitHub repository.
2. In [Vercel](https://vercel.com/new), **Import Project** → select the repo.
3. Framework preset: Next.js (auto-detected).
4. Add Environment Variables (Project Settings → Environment Variables), same as `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_APP_URL` → your production URL, e.g. `https://inventory.yourcompany.com` (used to build the QR code target)
5. Deploy. Every push to `main` auto-deploys; PRs get preview deployments.
6. In Supabase → **Authentication → URL Configuration**, add your Vercel domain to the allowed **Redirect URLs** / **Site URL**.

## Notes on the atomicity guarantee
`withdraw_item()` runs as a single Postgres transaction:
```
SELECT current_stock FROM items WHERE id = ? FOR UPDATE;  -- row lock
-- check stock >= requested quantity
UPDATE items SET current_stock = current_stock - qty ...;
INSERT INTO withdrawals (...);
```
Two employees scanning the QR code and submitting at the same instant will be serialized by Postgres's row lock — the second request re-reads the already-decremented stock and correctly fails with "Insufficient stock" if it would go negative. This is safer than a client-side check-then-write, which is vulnerable to race conditions.

## Extending
- **Search/autocomplete item dropdown**: swap the `Select` in `withdrawal-form.tsx` for a combobox (Radix `Command` + `Popover`) if the catalog grows large.
- **CSV export**: add a route handler that streams `withdrawals`/`restocks` as CSV for admins.
- **Multi-location inventory**: add a `locations` table and a `location_id` FK on `items`.
