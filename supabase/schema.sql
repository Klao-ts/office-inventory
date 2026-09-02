-- ============================================================================
-- Office Supplies Inventory & Withdrawal System — Supabase Schema
-- Run this in the Supabase SQL Editor (or via `supabase db push`)
-- ============================================================================

-- Extensions
create extension if not exists "pgcrypto"; -- for gen_random_uuid()

-- ----------------------------------------------------------------------------
-- ROLES: we use Supabase Auth. Admin = any authenticated user with
-- raw_app_meta_data->>'role' = 'admin' (set manually or via a trigger below).
-- ----------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin',
    false
  );
$$;

-- ----------------------------------------------------------------------------
-- TABLE: items
-- ----------------------------------------------------------------------------
create table if not exists public.items (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  category          text not null default 'General',
  sku               text unique,
  unit_price        numeric(10,2) not null default 0 check (unit_price >= 0),
  current_stock     integer not null default 0 check (current_stock >= 0),
  minimum_threshold integer not null default 5 check (minimum_threshold >= 0),
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_items_active on public.items (is_active);
create index if not exists idx_items_low_stock on public.items (current_stock, minimum_threshold);

-- ----------------------------------------------------------------------------
-- TABLE: withdrawals
-- ----------------------------------------------------------------------------
create table if not exists public.withdrawals (
  id             uuid primary key default gen_random_uuid(),
  item_id        uuid not null references public.items(id) on delete restrict,
  employee_name  text not null,
  employee_id    text,
  department     text not null,
  quantity       integer not null check (quantity > 0),
  status         text not null default 'completed'
                   check (status in ('pending', 'completed', 'cancelled')),
  requested_at   timestamptz not null default now()
);

create index if not exists idx_withdrawals_item on public.withdrawals (item_id);
create index if not exists idx_withdrawals_date on public.withdrawals (requested_at desc);

-- ----------------------------------------------------------------------------
-- TABLE: restocks
-- ----------------------------------------------------------------------------
create table if not exists public.restocks (
  id             uuid primary key default gen_random_uuid(),
  item_id        uuid not null references public.items(id) on delete restrict,
  added_quantity integer not null check (added_quantity > 0),
  supplier       text,
  note           text,
  unit_price     numeric(10,2),
  created_by     uuid references auth.users(id),
  created_at     timestamptz not null default now()
);

create index if not exists idx_restocks_item on public.restocks (item_id);

-- ----------------------------------------------------------------------------
-- updated_at trigger for items
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_items_updated_at on public.items;
create trigger trg_items_updated_at
  before update on public.items
  for each row execute function public.set_updated_at();

-- ============================================================================
-- ATOMIC WITHDRAWAL FUNCTION
-- Locks the item row, verifies stock, deducts, and inserts the withdrawal
-- in a single transaction — prevents race conditions on simultaneous requests.
-- Called via supabase.rpc('withdraw_item', {...}) so it runs server-side
-- inside Postgres, not as separate read-then-write calls from the client.
-- ============================================================================
create or replace function public.withdraw_item(
  p_item_id uuid,
  p_employee_name text,
  p_employee_id text,
  p_department text,
  p_quantity integer
)
returns public.withdrawals
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stock integer;
  v_active boolean;
  v_result public.withdrawals;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Quantity must be greater than zero' using errcode = '22023';
  end if;

  -- Lock the item row so concurrent withdrawals serialize on this item
  select current_stock, is_active
    into v_stock, v_active
    from public.items
   where id = p_item_id
   for update;

  if not found then
    raise exception 'Item not found' using errcode = 'P0002';
  end if;

  if not v_active then
    raise exception 'Item is no longer available' using errcode = '22023';
  end if;

  if v_stock < p_quantity then
    raise exception 'Insufficient stock: only % left', v_stock using errcode = '22023';
  end if;

  update public.items
     set current_stock = current_stock - p_quantity
   where id = p_item_id;

  insert into public.withdrawals (item_id, employee_name, employee_id, department, quantity, status)
  values (p_item_id, p_employee_name, p_employee_id, p_department, p_quantity, 'completed')
  returning * into v_result;

  return v_result;
end;
$$;

-- ============================================================================
-- RESTOCK FUNCTION (admin only, enforced by RLS on the call + is_admin check)
-- ============================================================================
create or replace function public.restock_item(
  p_item_id uuid,
  p_added_quantity integer,
  p_supplier text,
  p_note text,
  p_unit_price numeric
)
returns public.items
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result public.items;
begin
  if not public.is_admin() then
    raise exception 'Only admins can restock items' using errcode = '42501';
  end if;

  if p_added_quantity is null or p_added_quantity <= 0 then
    raise exception 'Added quantity must be greater than zero' using errcode = '22023';
  end if;

  insert into public.restocks (item_id, added_quantity, supplier, note, unit_price, created_by)
  values (p_item_id, p_added_quantity, p_supplier, p_note, p_unit_price, auth.uid());

  update public.items
     set current_stock = current_stock + p_added_quantity,
         unit_price = coalesce(p_unit_price, unit_price)
   where id = p_item_id
   returning * into v_result;

  return v_result;
end;
$$;

-- ============================================================================
-- LOW STOCK VIEW
-- ============================================================================
create or replace view public.low_stock_items as
  select * from public.items
   where is_active = true
     and current_stock <= minimum_threshold
   order by current_stock asc;

-- ============================================================================
-- LOW STOCK NOTIFICATION (pg_net -> Edge Function webhook)
-- Fires whenever a withdrawal or restock update pushes stock <= threshold.
-- Requires the `pg_net` extension (enabled by default on Supabase) and the
-- Edge Function `low-stock-email` deployed (see supabase/functions/).
-- ============================================================================
create extension if not exists pg_net;

create or replace function public.notify_low_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.current_stock <= new.minimum_threshold
     and (old.current_stock is null or old.current_stock > old.minimum_threshold) then
    perform net.http_post(
      url := current_setting('app.settings.low_stock_webhook_url', true),
      body := jsonb_build_object(
        'item_id', new.id,
        'name', new.name,
        'current_stock', new.current_stock,
        'minimum_threshold', new.minimum_threshold
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_low_stock on public.items;
create trigger trg_notify_low_stock
  after update of current_stock on public.items
  for each row execute function public.notify_low_stock();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
alter table public.items enable row level security;
alter table public.withdrawals enable row level security;
alter table public.restocks enable row level security;

-- items: anyone (including anon, for the public withdrawal form) can read
-- active items; only admins can insert/update/delete directly.
drop policy if exists "items_select_all" on public.items;
create policy "items_select_all" on public.items
  for select using (is_active = true or public.is_admin());

drop policy if exists "items_admin_write" on public.items;
create policy "items_admin_write" on public.items
  for insert with check (public.is_admin());

drop policy if exists "items_admin_update" on public.items;
create policy "items_admin_update" on public.items
  for update using (public.is_admin());

drop policy if exists "items_admin_delete" on public.items;
create policy "items_admin_delete" on public.items
  for delete using (public.is_admin());

-- withdrawals: public/anon can INSERT only through the RPC function
-- (security definer bypasses table RLS for the insert itself), but we still
-- lock down direct table access. Only admins can SELECT the full log.
drop policy if exists "withdrawals_admin_select" on public.withdrawals;
create policy "withdrawals_admin_select" on public.withdrawals
  for select using (public.is_admin());

-- No direct insert/update/delete policy for withdrawals -> only reachable
-- via the SECURITY DEFINER withdraw_item() function. This is intentional.

-- restocks: admin-only read (writes happen via restock_item() function)
drop policy if exists "restocks_admin_select" on public.restocks;
create policy "restocks_admin_select" on public.restocks
  for select using (public.is_admin());

-- ============================================================================
-- REALTIME: expose items + withdrawals for live dashboard updates
-- ============================================================================
alter publication supabase_realtime add table public.items;
alter publication supabase_realtime add table public.withdrawals;

-- ============================================================================
-- SEED DATA (optional — remove in production)
-- ============================================================================
insert into public.items (name, category, sku, unit_price, current_stock, minimum_threshold)
values
  ('A4 Paper Ream', 'Paper', 'PAP-A4-001', 3.50, 40, 10),
  ('Ballpoint Pen (Blue)', 'Writing', 'PEN-BL-001', 0.30, 8, 5),
  ('Stapler', 'Tools', 'TL-STP-001', 4.20, 3, 5),
  ('Whiteboard Marker', 'Writing', 'MRK-WB-001', 1.10, 15, 5),
  ('Sticky Notes 3x3', 'Paper', 'NOT-33-001', 1.80, 25, 8)
on conflict (sku) do nothing;
