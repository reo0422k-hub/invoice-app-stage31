create extension if not exists pgcrypto;

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_name text,
  email text,
  phone text,
  address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique,
  client_id uuid not null references clients(id) on delete restrict,
  title text not null,
  issue_date date not null,
  due_date date not null,
  status text not null default 'draft',
  subtotal numeric(12, 2) not null default 0,
  tax_amount numeric(12, 2) not null default 0,
  total_amount numeric(12, 2) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invoices_status_check
    check (status in ('draft', 'pending', 'sent', 'paid', 'overdue', 'rejected')),
  constraint invoices_subtotal_check check (subtotal >= 0),
  constraint invoices_tax_amount_check check (tax_amount >= 0),
  constraint invoices_total_amount_check check (total_amount >= 0)
);

create table if not exists invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  item_name text not null,
  description text,
  quantity numeric(12, 2) not null default 1,
  unit_price numeric(12, 2) not null default 0,
  amount numeric(12, 2) not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint invoice_items_quantity_check check (quantity > 0),
  constraint invoice_items_unit_price_check check (unit_price >= 0),
  constraint invoice_items_amount_check check (amount >= 0)
);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  payment_date date not null,
  amount numeric(12, 2) not null,
  payment_method text,
  notes text,
  created_at timestamptz not null default now(),
  constraint payments_amount_check check (amount >= 0)
);

create index if not exists idx_invoices_client_id
  on invoices (client_id);

create index if not exists idx_invoice_items_invoice_id
  on invoice_items (invoice_id);

create index if not exists idx_payments_invoice_id
  on payments (invoice_id);

drop trigger if exists trg_clients_updated_at on clients;
create trigger trg_clients_updated_at
before update on clients
for each row
execute function set_updated_at();

drop trigger if exists trg_invoices_updated_at on invoices;
create trigger trg_invoices_updated_at
before update on invoices
for each row
execute function set_updated_at();

comment on table clients is '取引先情報を管理するテーブル';
comment on table invoices is '請求書ヘッダー情報を管理するテーブル';
comment on table invoice_items is '請求書ごとの品目明細を管理するテーブル';
comment on table payments is '請求書ごとの入金情報を管理するテーブル';
