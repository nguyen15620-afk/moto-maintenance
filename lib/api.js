// lib/api.js — BẢN MỞ RỘNG BƯỚC 4
// Giữ nguyên các hàm cũ ở Bước 3 (fetchVehicle → đổi thành fetchVehicles số nhiều),
// bổ sung: multi-vehicle, cập nhật avg_km_per_day, thống kê chi phí.

import { supabase } from "./supabaseClient";

// ------------------------------------------------------------
// VEHICLES
// ------------------------------------------------------------

/** Lấy TẤT CẢ xe của user hiện tại (phục vụ multi-vehicle switcher) */
export async function fetchVehicles() {
  const { data, error } = await supabase
    .from("vehicles")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data;
}

export async function updateVehicleOdo(vehicleId, newOdo) {
  const { data, error } = await supabase
    .from("vehicles")
    .update({ current_odo: newOdo, odo_updated_at: new Date().toISOString() })
    .eq("id", vehicleId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Cập nhật số km trung bình đi mỗi ngày — dùng cho Smart Forecasting */
export async function updateAvgKmPerDay(vehicleId, avgKmPerDay) {
  const { data, error } = await supabase
    .from("vehicles")
    .update({ avg_km_per_day: avgKmPerDay })
    .eq("id", vehicleId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Sửa thông tin xe: tên, hãng, dòng xe, biển số — KHÔNG đụng tới current_odo */
export async function updateVehicleInfo(vehicleId, { name, brand, model, plateNumber }) {
  const { data, error } = await supabase
    .from("vehicles")
    .update({ name, brand, model, plate_number: plateNumber })
    .eq("id", vehicleId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Thêm 1 xe mới (multi-vehicle) — user_id lấy từ session hiện tại */
export async function addVehicle({ name, brand, model, plateNumber, currentOdo }) {
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("vehicles")
    .insert({
      user_id: userData.user.id,
      name,
      brand,
      model,
      plate_number: plateNumber,
      current_odo: currentOdo || 0,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ------------------------------------------------------------
// PARTS
// ------------------------------------------------------------

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

/** Thêm 1 phụ tùng tuỳ ý cho xe — user tự đặt tên + chu kỳ km/tháng */
export async function addPart({ vehicleId, name, intervalKm, intervalMonths, lastServiceOdo, lastServiceDate }) {
  // Lấy sort_order lớn nhất hiện tại để phụ tùng mới luôn xếp cuối danh sách
  const { data: existing, error: fetchErr } = await supabase
    .from("parts")
    .select("sort_order")
    .eq("vehicle_id", vehicleId)
    .order("sort_order", { ascending: false })
    .limit(1);
  if (fetchErr) throw fetchErr;
  const nextSortOrder = existing?.length ? (existing[0].sort_order || 0) + 1 : 0;

  const { data, error } = await supabase
    .from("parts")
    .insert({
      vehicle_id: vehicleId,
      name,
      interval_km: intervalKm || null,
      interval_months: intervalMonths || null,
      last_service_odo: lastServiceOdo,
      last_service_date: lastServiceDate,
      is_active: true,
      sort_order: nextSortOrder,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Sửa tên/chu kỳ của phụ tùng — KHÔNG đụng last_service_odo/date, việc đó
 * để trigger DB tự tính lại từ maintenance_logs (xem step5-log-crud.sql) */
export async function updatePart(partId, { name, intervalKm, intervalMonths }) {
  const { data, error } = await supabase
    .from("parts")
    .update({
      name,
      interval_km: intervalKm || null,
      interval_months: intervalMonths || null,
    })
    .eq("id", partId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Xoá mềm — ẩn khỏi danh sách nhưng GIỮ lại lịch sử bảo dưỡng cũ của nó */
export async function deactivatePart(partId) {
  const { error } = await supabase.from("parts").update({ is_active: false }).eq("id", partId);
  if (error) throw error;
}

// ------------------------------------------------------------
// MAINTENANCE LOGS
// ------------------------------------------------------------

export async function addMaintenanceLog({ partId, vehicleId, date, odo, cost, note }) {
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

export async function fetchLogsByPart(partId) {
  const { data, error } = await supabase
    .from("maintenance_logs")
    .select("*")
    .eq("part_id", partId)
    .order("service_date", { ascending: false });
  if (error) throw error;
  return data;
}

/** Sửa 1 bản ghi bảo dưỡng đã có — trigger DB sẽ tự tính lại cache của part */
export async function updateMaintenanceLog(logId, { date, odo, cost, note }) {
  const { data, error } = await supabase
    .from("maintenance_logs")
    .update({
      service_date: date,
      odo_at_service: odo,
      cost: cost || null,
      note: note || null,
    })
    .eq("id", logId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Xoá 1 bản ghi bảo dưỡng — trigger DB sẽ tự tính lại cache của part */
export async function deleteMaintenanceLog(logId) {
  const { error } = await supabase.from("maintenance_logs").delete().eq("id", logId);
  if (error) throw error;
}

// ------------------------------------------------------------
// ANALYTICS — dùng 2 view đã tạo trong sql/step4-updates.sql
// ------------------------------------------------------------

/** Chi phí theo tháng của 1 xe, mới nhất trước — dùng vẽ biểu đồ/list */
export async function fetchMonthlyCost(vehicleId) {
  const { data, error } = await supabase
    .from("v_monthly_cost")
    .select("*")
    .eq("vehicle_id", vehicleId)
    .order("month", { ascending: false });
  if (error) throw error;
  return data;
}

/** Top phụ tùng tốn chi phí nhất của 1 xe (toàn bộ lịch sử) */
export async function fetchTopCostParts(vehicleId, limit = 5) {
  const { data, error } = await supabase
    .from("v_top_cost_parts")
    .select("*")
    .eq("vehicle_id", vehicleId)
    .order("total_cost", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

/** Tổng chi phí + tổng số lần bảo dưỡng trong năm hiện tại */
export async function fetchYearSummary(vehicleId, year) {
  const { data, error } = await supabase
    .from("maintenance_logs")
    .select("cost, service_date")
    .eq("vehicle_id", vehicleId)
    .gte("service_date", `${year}-01-01`)
    .lte("service_date", `${year}-12-31`);
  if (error) throw error;
  const totalCost = data.reduce((sum, l) => sum + (l.cost || 0), 0);
  return { totalCost, serviceCount: data.length };
}

// ------------------------------------------------------------
// FUEL LOGS — nhật ký đổ xăng, dùng tính L/100km
// ------------------------------------------------------------

/** Lấy nhật ký đổ xăng, sắp theo ODO tăng dần (để tính chênh lệch quãng đường) */
export async function fetchFuelLogs(vehicleId) {
  const { data, error } = await supabase
    .from("fuel_logs")
    .select("*")
    .eq("vehicle_id", vehicleId)
    .order("odo_at_fill", { ascending: true });
  if (error) throw error;
  return data;
}

export async function addFuelLog({ vehicleId, fillDate, odoAtFill, liters, totalCost, station, notes }) {
  const { data, error } = await supabase
    .from("fuel_logs")
    .insert({
      vehicle_id: vehicleId,
      fill_date: fillDate,
      odo_at_fill: odoAtFill,
      liters,
      total_cost: totalCost || null,
      station: station || null,
      notes: notes || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateFuelLog(logId, { fillDate, odoAtFill, liters, totalCost, station, notes }) {
  const { data, error } = await supabase
    .from("fuel_logs")
    .update({
      fill_date: fillDate,
      odo_at_fill: odoAtFill,
      liters,
      total_cost: totalCost || null,
      station: station || null,
      notes: notes || null,
    })
    .eq("id", logId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Xoá hẳn — không có gì phụ thuộc vào fuel_logs nên không cần xoá mềm */
export async function deleteFuelLog(logId) {
  const { error } = await supabase.from("fuel_logs").delete().eq("id", logId);
  if (error) throw error;
}