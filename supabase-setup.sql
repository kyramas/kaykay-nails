-- Run this once in Supabase: Dashboard > SQL Editor > New query > paste this whole file > Run

create table if not exists clients (
  id text primary key,
  name text not null,
  phone text default ''
);

create table if not exists services (
  id text primary key,
  name text not null,
  duration integer not null,
  price numeric not null,
  category text not null
);

create table if not exists appointments (
  id text primary key,
  client_id text references clients(id) on delete set null,
  service_ids jsonb not null default '[]',
  date text not null,
  time text not null,
  notes text default ''
);

-- Row Level Security: open policies since this is a single-business tool
-- accessed only via a private link. If you ever want to password-protect
-- it, that's a separate step (Supabase Auth) we can add later.
alter table clients enable row level security;
alter table services enable row level security;
alter table appointments enable row level security;

create policy "allow all on clients" on clients for all using (true) with check (true);
create policy "allow all on services" on services for all using (true) with check (true);
create policy "allow all on appointments" on appointments for all using (true) with check (true);

-- Seed data: your real client list and service menu.
-- Safe to re-run (ON CONFLICT DO NOTHING) without creating duplicates.

insert into clients (id, name, phone) values
  ('c1', 'Mom', '6946144417'),
  ('c2', 'Roula', '6932105021'),
  ('c3', 'Giota', '6977427745'),
  ('c4', 'Zoe', '6948308448'),
  ('c5', 'Valia', '6982775260'),
  ('c6', 'Erriketi', '6949115637'),
  ('c7', 'Despoina', '6948513191'),
  ('c8', 'Ksenia', '6949176864'),
  ('c9', 'Tina', '6971591146'),
  ('c10', 'Mia', '6936511623'),
  ('c11', 'Danae', '35797762808'),
  ('c12', 'Ariana', '6945011898'),
  ('c13', 'Kalliroi', ''),
  ('c14', 'Eri', '6940630653'),
  ('c15', 'Dimitra', ''),
  ('c16', 'Xristina', ''),
  ('c17', 'Olga', ''),
  ('c18', 'Jo', '6942931994'),
  ('c19', 'Errieta', ''),
  ('c20', 'Pinelopi', ''),
  ('c21', 'Athina', ''),
  ('c22', 'Dad', '6944898047')
on conflict (id) do nothing;

insert into services (id, name, duration, price, category) values
  ('s1', 'Extensions S', 120, 24, 'Extensions'),
  ('s2', 'Extensions M', 120, 26, 'Extensions'),
  ('s3', 'Extensions L', 120, 28, 'Extensions'),
  ('s4', 'Extensions XL', 120, 30, 'Extensions'),
  ('s5', 'Fill/Overlay S', 90, 18, 'Fill/Overlay'),
  ('s6', 'Fill/Overlay M', 90, 20, 'Fill/Overlay'),
  ('s7', 'Fill/Overlay L', 90, 22, 'Fill/Overlay'),
  ('s8', 'Fill/Overlay XL', 90, 24, 'Fill/Overlay'),
  ('s9', 'Manicure', 20, 5, 'Manicure'),
  ('s10', 'Gel Manicure', 45, 13, 'Manicure'),
  ('s11', 'Structured Gel Manicure', 60, 15, 'Manicure'),
  ('s12', 'Nail Art', 30, 3, 'Nail Art'),
  ('s13', '3D Nail Art', 60, 5, 'Nail Art'),
  ('s14', 'Chrome', 15, 2, 'Add-ons'),
  ('s15', 'Cat Eye', 10, 2, 'Add-ons'),
  ('s16', 'Charms', 10, 2, 'Add-ons'),
  ('s17', 'Airbrush', 20, 2, 'Add-ons'),
  ('s18', 'Nail Repair', 10, 1, 'Removal/Repair'),
  ('s19', 'Removal', 15, 0, 'Removal/Repair'),
  ('s20', 'Foreign Removal', 30, 2, 'Removal/Repair')
on conflict (id) do nothing;

-- No sample appointments — the calendar starts empty for real use.
