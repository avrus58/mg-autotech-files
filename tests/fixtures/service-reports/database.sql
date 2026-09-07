-- Disposable database fixture only. Never run on a linked or existing database.
create role anon;
create role authenticated;
create role service_role bypassrls;
grant usage on schema public to anon, authenticated, service_role;
create table public.profiles (id uuid primary key, company_name text, full_name text);
create table public.orders (
  id uuid primary key, customer_id uuid references public.profiles(id), status text,
  service_type text, vehicle_brand text, vehicle_model text, vehicle_generation text,
  vehicle_engine text, vehicle_year text, ecu text, gearbox text, license_plate text
);
grant select, insert, update, delete on public.orders, public.profiles to service_role;
insert into public.profiles values
  ('22222222-2222-4222-8222-222222222222','Synthetic Workshop','Synthetic Owner'),
  ('33333333-3333-4333-8333-333333333333','Other Synthetic Workshop','Other Owner');
insert into public.orders values
  ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','completed','Stage 1 + Diagnostics','Test','Car','Generation','Engine','2022','ECU','Gearbox','TEST-001'),
  ('55555555-5555-4555-8555-555555555555','22222222-2222-4222-8222-222222222222','in_progress','Diagnostics','Test','Car',null,null,null,null,null,null);
