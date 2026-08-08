"use client";

import React, { useState, useEffect } from "react";
import { X, Loader2, Pencil, Trash2, Check, Calendar, Gauge, Coins, StickyNote } from "lucide-react";
import { fetchLogsByPart, updateMaintenanceLog, deleteMaintenanceLog } from "@/lib/api";
import { vibrate } from "@/lib/haptics";

const formatDateVN = (d) => new Date(d).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
const formatKm = (n) => n.toLocaleString("vi-VN");
const formatVND = (n) => (n ? n.toLocaleString("vi-VN") + "đ" : "—");

/**
 * PartHistoryModal — xem toàn bộ lịch sử bảo dưỡng của 1 phụ tùng,
 * sửa hoặc xoá từng bản ghi. Sau khi có thay đổi (sửa/xoá), gọi
 * onChanged() để trang cha refetch lại `parts` — vì trigger DB có
 * thể đã tính lại last_service_odo/last_service_date của phụ tùng.
 *
 * Props: part { id, name }, onClose(), onChanged()
 */
export default function PartHistoryModal({ part, onClose, onChanged }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const data = await fetchLogsByPart(part.id);
      setLogs(data);
      setLoading(false);
    })();
  }, [part.id]);

  async function handleUpdate(logId, values) {
    const updated = await updateMaintenanceLog(logId, values);
    setLogs((prev) => prev.map((l) => (l.id === logId ? updated : l)));
    setEditingId(null);
    onChanged?.();
    vibrate([10, 20]);
  }

  async function handleDelete(logId) {
    await deleteMaintenanceLog(logId);
    setLogs((prev) => prev.filter((l) => l.id !== logId));
    setConfirmDeleteId(null);
    onChanged?.();
    vibrate(200);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md max-h-[85vh] flex flex-col bg-[var(--surface)] border-t border-[var(--border)] rounded-t-3xl px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
        <div className="w-9 h-1 bg-black/10 dark:bg-white/15 rounded-full mx-auto mb-3 shrink-0" />
        <div className="flex items-center justify-between mb-4 shrink-0">
          <h3 className="text-base font-semibold">Lịch sử: {part.name}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center">
            <X className="w-4 h-4 text-[var(--text-muted)]" />
          </button>
        </div>

        <div className="overflow-y-auto space-y-2.5">
          {loading && (
            <div className="flex justify-center py-10">
              <Loader2 className="w-5 h-5 text-[var(--accent)] animate-spin" />
            </div>
          )}

          {!loading && logs.length === 0 && (
            <p className="text-sm text-[var(--text-muted)] text-center py-10">
              Chưa có lịch sử nào cho phụ tùng này.
            </p>
          )}

          {!loading &&
            logs.map((log) =>
              editingId === log.id ? (
                <EditLogForm
                  key={log.id}
                  log={log}
                  onCancel={() => setEditingId(null)}
                  onSave={(values) => handleUpdate(log.id, values)}
                />
              ) : (
                <div key={log.id} className="rounded-2xl bg-black/5 dark:bg-white/5 border border-[var(--border)] p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{formatDateVN(log.service_date)}</div>
                      <div className="text-xs text-[var(--text-muted)] mt-0.5">
                        {formatKm(log.odo_at_service)} km · {formatVND(log.cost)}
                      </div>
                      {log.note && <div className="text-xs text-[var(--text-muted)] mt-1 italic">"{log.note}"</div>}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => { vibrate(10); setEditingId(log.id); }}
                        className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center"
                      >
                        <Pencil className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                      </button>

                      {confirmDeleteId === log.id ? (
                        <button
                          onClick={() => handleDelete(log.id)}
                          className="h-8 px-2.5 rounded-full bg-[var(--danger-bg)] text-white text-xs font-medium whitespace-nowrap"
                        >
                          Xoá luôn?
                        </button>
                      ) : (
                        <button
                          onClick={() => { vibrate(10); setConfirmDeleteId(log.id); setTimeout(() => setConfirmDeleteId((id) => (id === log.id ? null : id)), 3000); }}
                          className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-[var(--danger-text)]" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            )}
        </div>
      </div>
    </div>
  );
}

// --- Form sửa inline ngay trong danh sách ---
function EditLogForm({ log, onCancel, onSave }) {
  const [date, setDate] = useState(log.service_date);
  const [odo, setOdo] = useState(String(log.odo_at_service));
  const [cost, setCost] = useState(log.cost ? String(log.cost) : "");
  const [note, setNote] = useState(log.note || "");
  const [saving, setSaving] = useState(false);
  const isValid = odo !== "" && Number(odo) >= 0;

  async function handleSubmit() {
    setSaving(true);
    try {
      await onSave({ date, odo: Number(odo), cost: cost ? Number(cost) : 0, note });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl bg-black/5 dark:bg-white/5 border border-[var(--accent)]/40 p-3.5 space-y-2.5">
      <MiniField icon={<Calendar className="w-3.5 h-3.5" />}>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-transparent w-full text-sm focus:outline-none" />
      </MiniField>
      <MiniField icon={<Gauge className="w-3.5 h-3.5" />}>
        <input type="number" inputMode="numeric" value={odo} onChange={(e) => setOdo(e.target.value)} className="bg-transparent w-full text-sm focus:outline-none font-mono tabular-nums" />
      </MiniField>
      <MiniField icon={<Coins className="w-3.5 h-3.5" />}>
        <input type="number" inputMode="numeric" placeholder="Chi phí (VNĐ)" value={cost} onChange={(e) => setCost(e.target.value)} className="bg-transparent w-full text-sm focus:outline-none placeholder:text-[var(--text-muted)]" />
      </MiniField>
      <MiniField icon={<StickyNote className="w-3.5 h-3.5" />}>
        <input type="text" placeholder="Ghi chú" value={note} onChange={(e) => setNote(e.target.value)} className="bg-transparent w-full text-sm focus:outline-none placeholder:text-[var(--text-muted)]" />
      </MiniField>

      <div className="flex gap-2 pt-1">
        <button onClick={onCancel} className="flex-1 rounded-xl bg-black/5 dark:bg-white/10 text-sm py-2">Huỷ</button>
        <button
          disabled={!isValid || saving}
          onClick={handleSubmit}
          className="flex-1 rounded-xl bg-[var(--accent)] disabled:opacity-40 text-[var(--accent-contrast)] text-sm font-medium py-2 flex items-center justify-center gap-1.5"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Lưu
        </button>
      </div>
    </div>
  );
}

function MiniField({ icon, children }) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-black/5 dark:bg-white/5 border border-[var(--border)] px-3 py-2">
      <span className="text-[var(--text-muted)] shrink-0">{icon}</span>
      {children}
    </div>
  );
}