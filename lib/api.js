// lib/api.js
// Tập hợp các hàm CRUD gọi Supabase — thay thế toàn bộ mock data ở Bước 2.
// Import và gọi trực tiếp trong component (hoặc bọc thêm React Query nếu muốn cache).

import { supabase } from "./supabaseClient";

// ------------------------------------------------------------
// VEHICLES
// ------------------------------------------------------------

/** Lấy xe đầu tiên của user hiện tại (app cá nhân — giả định 1 xe chính) */
export async function fetchVehicle() {
  const { data, error } = await supabase
    .from("vehicles")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  if (error) throw error;
  return data;
}

/** Cập nhật ODO hiện tại của xe */
export async function updateVehicleOdo(vehicleId, newOdo) {
  const { data, error } = await supabase
    .from("vehicles")
    .update({
      current_odo: newOdo,
      odo_updated_at: new Date().toISOString(),
    })
    .eq("id", vehicleId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ------------------------------------------------------------
// PARTS
// ------------------------------------------------------------

/** Lấy danh sách phụ tùng đang active của 1 xe, sắp theo sort_order */
export async function fetchParts(vehicleId) {
  const { data, error } = await supabase
    .from("parts")
    .select("*")
    .eq("vehicle_id", vehicleId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return data;
}

// ------------------------------------------------------------
// MAINTENANCE LOGS
// ------------------------------------------------------------

/**
 * Thêm 1 bản ghi bảo dưỡng mới.
 * Lưu ý: KHÔNG cần tự update lại parts.last_service_odo ở đây —
 * trigger `trg_update_part_cache` trong Postgres sẽ tự làm việc đó.
 */
export async function addMaintenanceLog({
  partId,
  vehicleId,
  date,
  odo,
  cost,
  note,
}) {
  const { data, error } = await supabase
    .from("maintenance_logs")
    .insert({
      part_id: partId,
      vehicle_id: vehicleId,
      service_date: date,
      odo_at_service: odo,
      cost: cost || null,
      note: note || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/** Lấy lịch sử bảo dưỡng của 1 phụ tùng cụ thể, mới nhất trước */
export async function fetchLogsByPart(partId) {
  const { data, error } = await supabase
    .from("maintenance_logs")
    .select("*")
    .eq("part_id", partId)
    .order("service_date", { ascending: false });

  if (error) throw error;
  return data;
}