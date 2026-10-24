-- Schema gốc của MotoCare, lấy từ database production ngày 2026-10-25
-- (pg_catalog qua Supabase SQL Editor), tương ứng các script step4…step9 đã
-- chạy tay trước đây. Dùng để dựng lại database nếu cần.
--
-- Database này còn chứa bảng của app khác (accounts, budgets, categories,
-- transactions, seed_default_financial_data) — KHÔNG đưa vào đây.
--
-- Hai view được tạo KHÔNG có security_invoker (đúng như production lúc đó);
-- migration 20261024000000 bật lại. Thiếu khoá ngoại parts/maintenance_logs
-- -> vehicles cũng được giữ nguyên như production; xem migration 20261025000000.

-- ------------------------------------------------------------
-- Bảng
-- ------------------------------------------------------------

create table public.vehicles (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  brand text,
  model text,
  plate_number text,
  year smallint,
  current_odo integer not null default 0,
  odo_updated_at timestamp with time zone default now(),
  avatar_url text,
  created_at timestamp with time zone default now(),
  avg_km_per_day numeric(6,1) default 20
);

create table public.parts (
  id uuid not null default gen_random_uuid(),
  vehicle_id uuid not null,
  name text not null,
  category text,
  interval_km integer,
  interval_months integer,
  last_service_odo integer default 0,
  last_service_date date default current_date,
  is_active boolean default true,
  sort_order smallint default 0
);

create table public.maintenance_logs (
  id uuid not null default gen_random_uuid(),
  part_id uuid not null,
  vehicle_id uuid not null,
  service_date date not null default current_date,
  odo_at_service integer not null,
  cost numeric(12,0),
  note text,
  created_at timestamp with time zone default now()
);

create table public.fuel_logs (
  id uuid not null default gen_random_uuid(),
  vehicle_id uuid not null,
  fill_date date not null,
  odo_at_fill integer not null,
  liters numeric(6,2) not null,
  total_cost numeric(12,0),
  station text,
  notes text,
  created_at timestamp with time zone not null default now()
);

-- ------------------------------------------------------------
-- Ràng buộc
-- ------------------------------------------------------------

alter table public.vehicles add constraint vehicles_pkey primary key (id);
alter table public.vehicles add constraint vehicles_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.parts add constraint parts_pkey primary key (id);

alter table public.maintenance_logs add constraint maintenance_logs_pkey primary key (id);
alter table public.maintenance_logs add constraint maintenance_logs_part_id_fkey
  foreign key (part_id) references public.parts(id) on delete cascade;

alter table public.fuel_logs add constraint fuel_logs_pkey primary key (id);
alter table public.fuel_logs add constraint fuel_logs_vehicle_id_fkey
  foreign key (vehicle_id) references public.vehicles(id) on delete cascade;

-- ------------------------------------------------------------
-- Index
-- ------------------------------------------------------------

create index idx_logs_service_date on public.maintenance_logs using btree (service_date);
create index idx_logs_vehicle_date on public.maintenance_logs using btree (vehicle_id, service_date);
create index idx_fuel_logs_vehicle_odo on public.fuel_logs using btree (vehicle_id, odo_at_fill);

-- ------------------------------------------------------------
-- Trigger: tự tính lại last_service_odo/date của phụ tùng từ log mới nhất
-- ------------------------------------------------------------

create or replace function public.fn_recompute_part_cache()
returns trigger
language plpgsql
security definer
as $function$
declare
  v_part_id uuid := coalesce(new.part_id, old.part_id);
  v_latest record;
begin
  select service_date, odo_at_service
    into v_latest
    from public.maintenance_logs
   where part_id = v_part_id
   order by service_date desc, odo_at_service desc
   limit 1;

  if v_latest is not null then
    update public.parts
       set last_service_odo = v_latest.odo_at_service,
           last_service_date = v_latest.service_date
     where id = v_part_id;
  end if;
  -- Nếu xoá hết log (v_latest null) -> CỐ TÌNH giữ nguyên cache cũ,
  -- không reset về 0, để tránh phụ tùng đột ngột "quá hạn" toàn phần.

  return coalesce(new, old);
end;
$function$;

create trigger trg_recompute_part_cache
  after insert or delete or update on public.maintenance_logs
  for each row execute function public.fn_recompute_part_cache();

-- ------------------------------------------------------------
-- View thống kê
-- ------------------------------------------------------------

create or replace view public.v_monthly_cost as
  select vehicle_id,
         (date_trunc('month', service_date::timestamp with time zone))::date as month,
         sum(cost) as total_cost,
         count(*) as service_count
    from public.maintenance_logs
   where cost is not null
   group by vehicle_id, date_trunc('month', service_date::timestamp with time zone);

create or replace view public.v_top_cost_parts as
  select p.id as part_id,
         p.vehicle_id,
         p.name,
         coalesce(sum(l.cost), 0) as total_cost,
         count(l.id) as times_serviced
    from public.parts p
    left join public.maintenance_logs l on l.part_id = p.id
   group by p.id, p.vehicle_id, p.name
   order by coalesce(sum(l.cost), 0) desc;

-- ------------------------------------------------------------
-- Row Level Security
-- ------------------------------------------------------------

alter table public.vehicles enable row level security;
alter table public.parts enable row level security;
alter table public.maintenance_logs enable row level security;
alter table public.fuel_logs enable row level security;

create policy vehicles_select_own on public.vehicles for select using (auth.uid() = user_id);
create policy vehicles_insert_own on public.vehicles for insert with check (auth.uid() = user_id);
create policy vehicles_update_own on public.vehicles for update using (auth.uid() = user_id);
create policy vehicles_delete_own on public.vehicles for delete using (auth.uid() = user_id);

-- parts không có policy DELETE: app chỉ xoá mềm (is_active = false)
create policy parts_select_own on public.parts for select
  using (exists (select 1 from public.vehicles v where v.id = parts.vehicle_id and v.user_id = auth.uid()));
create policy parts_insert_own on public.parts for insert
  with check (exists (select 1 from public.vehicles v where v.id = parts.vehicle_id and v.user_id = auth.uid()));
create policy parts_update_own on public.parts for update
  using (exists (select 1 from public.vehicles v where v.id = parts.vehicle_id and v.user_id = auth.uid()));

create policy logs_select_own on public.maintenance_logs for select
  using (exists (select 1 from public.vehicles v where v.id = maintenance_logs.vehicle_id and v.user_id = auth.uid()));
create policy logs_insert_own on public.maintenance_logs for insert
  with check (exists (select 1 from public.vehicles v where v.id = maintenance_logs.vehicle_id and v.user_id = auth.uid()));
create policy logs_update_own on public.maintenance_logs for update
  using (exists (select 1 from public.vehicles v where v.id = maintenance_logs.vehicle_id and v.user_id = auth.uid()));
create policy logs_delete_own on public.maintenance_logs for delete
  using (exists (select 1 from public.vehicles v where v.id = maintenance_logs.vehicle_id and v.user_id = auth.uid()));

create policy fuel_logs_select_own on public.fuel_logs for select
  using (exists (select 1 from public.vehicles v where v.id = fuel_logs.vehicle_id and v.user_id = auth.uid()));
create policy fuel_logs_insert_own on public.fuel_logs for insert
  with check (exists (select 1 from public.vehicles v where v.id = fuel_logs.vehicle_id and v.user_id = auth.uid()));
create policy fuel_logs_update_own on public.fuel_logs for update
  using (exists (select 1 from public.vehicles v where v.id = fuel_logs.vehicle_id and v.user_id = auth.uid()));
create policy fuel_logs_delete_own on public.fuel_logs for delete
  using (exists (select 1 from public.vehicles v where v.id = fuel_logs.vehicle_id and v.user_id = auth.uid()));
