-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Stores
create table stores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  created_at timestamptz default now()
);

-- Store users (staff, managers)
create table store_users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password_hash text not null,
  display_name text not null,
  store_id uuid references stores(id) on delete cascade,
  role text not null check (role in ('admin', 'manager', 'staff')),
  created_at timestamptz default now()
);

-- Products catalog
create table products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  barcode text not null,
  name text not null,
  price decimal(10,2) not null,
  category text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(store_id, barcode)
);

-- Scan events (analytics)
create table scan_events (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  barcode text not null,
  scanned_at timestamptz default now()
);

-- Branding (store appearance + social links)
create table store_branding (
  store_id uuid primary key references stores(id) on delete cascade,
  logo_url text,
  primary_color text default '#6366f1',
  accent_color text default '#10b981',
  display_name text,
  contact_email text,
  contact_phone text,
  footer_text text,
  instagram_url text,
  tiktok_url text,
  website_url text
);

-- Import mappings (one per store)
create table import_mappings (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  column_mapping jsonb not null,
  parser_options jsonb,
  is_verified boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(store_id)
);

-- Pending imports (uploaded files awaiting admin or auto-map confirmation)
create table pending_imports (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  original_filename text not null,
  file_type text not null,
  raw_content text not null,
  row_count integer default 0,
  detected_columns jsonb,
  sample_rows jsonb,
  mapping_id uuid references import_mappings(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'auto-mapped', 'imported', 'rejected')),
  created_at timestamptz default now(),
  imported_at timestamptz
);

-- Indexes
create index idx_products_store_barcode on products(store_id, barcode);
create index idx_scan_events_store on scan_events(store_id);
create index idx_scan_events_scanned_at on scan_events(scanned_at);
create index idx_pending_imports_store on pending_imports(store_id);
create index idx_pending_imports_status on pending_imports(status);

-- Row Level Security
alter table stores enable row level security;
alter table store_users enable row level security;
alter table products enable row level security;
alter table scan_events enable row level security;

-- RLS policies
create policy "Stores are viewable by authenticated users"
  on stores for select using (auth.role() = 'authenticated');

create policy "Products are viewable by anyone"
  on products for select using (true);

create policy "Products are editable by store staff"
  on products for all using (
    exists (
      select 1 from store_users
      where store_users.store_id = products.store_id
      and store_users.email = auth.email()
    )
  );

create policy "Scan events are insertable by anyone"
  on scan_events for insert with check (true);

create policy "Scan events are viewable by store staff"
  on scan_events for select using (
    exists (
      select 1 from store_users
      where store_users.store_id = scan_events.store_id
      and store_users.email = auth.email()
    )
  );
