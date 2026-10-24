-- Sửa lỗ hổng: v_monthly_cost và v_top_cost_parts mặc định chạy với quyền của
-- người tạo view (postgres) nên BỎ QUA RLS — ai có anon key (công khai trong
-- bundle JS của site) cũng đọc được chi phí/tên phụ tùng của MỌI người dùng.
-- security_invoker = true: view chạy với quyền người gọi -> RLS của các bảng
-- gốc (maintenance_logs, parts...) được áp dụng như khi truy vấn trực tiếp.
--
-- Chạy trong Supabase Dashboard -> SQL Editor (cần Postgres 15+, Supabase đã có).

alter view public.v_monthly_cost set (security_invoker = true);
alter view public.v_top_cost_parts set (security_invoker = true);
