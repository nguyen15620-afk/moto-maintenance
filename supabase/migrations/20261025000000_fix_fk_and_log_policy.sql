-- 1) Thiếu khoá ngoại parts.vehicle_id / maintenance_logs.vehicle_id -> vehicles.
--    Xoá xe chỉ cascade sang fuel_logs, còn phụ tùng (và lịch sử bảo dưỡng của
--    chúng) nằm lại làm dữ liệu mồ côi: không ai xem được nữa (RLS dựa vào xe)
--    nhưng vẫn chiếm chỗ, trái với hộp thoại "xoá vĩnh viễn" của app.
--    Ngày 2026-10-25 production có 24 phụ tùng mồ côi như vậy.
--
-- 2) logs_insert_own / logs_update_own chỉ kiểm tra vehicle_id thuộc user, KHÔNG
--    kiểm tra part_id. Trigger fn_recompute_part_cache chạy SECURITY DEFINER (bỏ
--    qua RLS), nên ai biết part_id của người khác có thể chèn log vào xe MÌNH với
--    part_id đó -> trigger ghi đè last_service_odo/date của phụ tùng người kia.
--    (part_id từng lộ qua view v_top_cost_parts, đã sửa ở migration 20261024000000.)

begin;

-- Dọn dữ liệu mồ côi trước khi thêm khoá ngoại (log của chúng bị xoá theo
-- nhờ maintenance_logs_part_id_fkey ... on delete cascade)
delete from public.parts p
 where not exists (select 1 from public.vehicles v where v.id = p.vehicle_id);
delete from public.maintenance_logs l
 where not exists (select 1 from public.vehicles v where v.id = l.vehicle_id);

alter table public.parts add constraint parts_vehicle_id_fkey
  foreign key (vehicle_id) references public.vehicles(id) on delete cascade;
alter table public.maintenance_logs add constraint maintenance_logs_vehicle_id_fkey
  foreign key (vehicle_id) references public.vehicles(id) on delete cascade;

create index if not exists idx_parts_vehicle on public.parts using btree (vehicle_id, sort_order);
create index if not exists idx_logs_part on public.maintenance_logs using btree (part_id);

-- Log chỉ hợp lệ khi phụ tùng thuộc ĐÚNG xe đó và xe thuộc user hiện tại
drop policy logs_insert_own on public.maintenance_logs;
create policy logs_insert_own on public.maintenance_logs for insert
  with check (exists (
    select 1
      from public.parts p
      join public.vehicles v on v.id = p.vehicle_id
     where p.id = maintenance_logs.part_id
       and p.vehicle_id = maintenance_logs.vehicle_id
       and v.user_id = auth.uid()
  ));

drop policy logs_update_own on public.maintenance_logs;
create policy logs_update_own on public.maintenance_logs for update
  using (exists (
    select 1 from public.vehicles v
     where v.id = maintenance_logs.vehicle_id and v.user_id = auth.uid()
  ))
  with check (exists (
    select 1
      from public.parts p
      join public.vehicles v on v.id = p.vehicle_id
     where p.id = maintenance_logs.part_id
       and p.vehicle_id = maintenance_logs.vehicle_id
       and v.user_id = auth.uid()
  ));

-- Hàm SECURITY DEFINER nên cố định search_path (khuyến nghị của Supabase linter)
alter function public.fn_recompute_part_cache() set search_path = public;

commit;
