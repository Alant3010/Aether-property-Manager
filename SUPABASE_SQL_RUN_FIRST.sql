create extension if not exists "pgcrypto";

create table if not exists properties (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamp with time zone default now()
);

create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references properties(id) on delete cascade,
  guest_name text not null,
  phone text,
  source text,
  check_in date not null,
  check_out date not null,
  amount text,
  number_of_guests text,
  advance_paid text,
  payment_mode text,
  balance_amount text,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamp with time zone default now()
);

alter table properties enable row level security;
alter table bookings enable row level security;

drop policy if exists "Allow authenticated users full access to properties" on properties;
drop policy if exists "Allow authenticated users full access to bookings" on bookings;

create policy "Allow authenticated users full access to properties"
on properties for all to authenticated using (true) with check (true);

create policy "Allow authenticated users full access to bookings"
on bookings for all to authenticated using (true) with check (true);
