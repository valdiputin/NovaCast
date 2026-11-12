"use client";

import { useState, useTransition } from "react";
import { History, Eye } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "../ui/Modal";
import { getStockHistoryAction, type HistoryRow } from "@/app/actions/catalog";
import { MOVEMENT_LABEL } from "@/lib/labels";
import { formatDateTime } from "@/lib/format";
import { cn } from "../ui/common";

/** Nút ⟲ / 👁 mở lịch sử biến động (sổ cái) của một mặt hàng */
export function HistoryButton({ item, name, icon = "history", className }: { item: { materialId?: string; variantId?: string }; name: string; icon?: "history" | "eye"; className?: string }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<HistoryRow[] | null>(null);
  const [pending, start] = useTransition();
  const Icon = icon === "eye" ? Eye : History;
  return (
    <>
      <button
        type="button"
        title="Lịch sử biến động"
        className={cn("w-11 h-11 rounded-xl bg-blue-50 text-[#1565F5] inline-flex items-center justify-center hover:bg-blue-100", className)}
        onClick={() => {
          setOpen(true);
          start(async () => {
            const res = await getStockHistoryAction(item);
            if ("error" in res) return void toast.error(res.error);
            setRows(res.rows);
          });
        }}
      >
        <Icon className="w-6 h-6" />
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={`Lịch sử biến động — ${name}`} icon={<History className="w-7 h-7 text-[#1565F5]" />} width="max-w-3xl">
        {pending || !rows ? (
          <div className="py-10 text-center text-slate-400">Đang tải...</div>
        ) : rows.length === 0 ? (
          <div className="py-10 text-center text-slate-400">Chưa có biến động</div>
        ) : (
          <table className="w-full text-[15px]">
            <thead className="bg-[#F1F5FD]">
              <tr className="[&>th]:px-3 [&>th]:py-2.5 [&>th]:text-left">
                <th>Thời gian</th>
                <th>Loại</th>
                <th>Vị trí</th>
                <th className="!text-right">Thay đổi</th>
                <th>Diễn giải</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.id} className="[&>td]:px-3 [&>td]:py-2">
                  <td className="whitespace-nowrap text-slate-500">{formatDateTime(r.at)}</td>
                  <td>{MOVEMENT_LABEL[r.type] ?? r.type}</td>
                  <td>{r.location}</td>
                  <td className={cn("text-right font-semibold", r.change >= 0 ? "text-emerald-600" : "text-rose-600")}>{r.change > 0 ? `+${r.change}` : r.change}</td>
                  <td className="text-slate-600">{r.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Modal>
    </>
  );
}
