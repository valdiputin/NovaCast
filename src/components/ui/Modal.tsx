"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "./common";

export function Modal({ open, onClose, title, icon, children, width = "max-w-xl" }: { open: boolean; onClose: () => void; title: React.ReactNode; icon?: React.ReactNode; children: React.ReactNode; width?: string }) {
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/45" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={cn("w-full bg-white rounded-3xl shadow-2xl max-h-[92vh] overflow-y-auto text-left font-normal whitespace-normal", width)}>
        <div className="flex items-center justify-between px-7 pt-6 pb-4 border-b border-slate-100">
          <h3 className="flex items-center gap-3 text-2xl font-bold text-[#1E293B]">
            {icon}
            {title}
          </h3>
          <button onClick={onClose} className="p-1 text-slate-500 hover:text-slate-800" aria-label="Đóng">
            <X className="w-7 h-7" />
          </button>
        </div>
        <div className="px-7 py-5">{children}</div>
      </div>
    </div>
  );
}

export const field = "w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-white text-[15px] focus:outline-none focus:border-blue-500";
export const labelCls = "block text-sm font-semibold text-[#1E293B] mb-1.5";
export const btnPrimary = "inline-flex items-center justify-center gap-2 h-12 px-6 rounded-xl bg-[#1565F5] hover:bg-[#0F55D8] text-white font-semibold text-[16px] disabled:opacity-50";
export const btnRed = "inline-flex items-center justify-center gap-2 h-12 px-6 rounded-xl bg-[#E5252A] hover:bg-[#CC1F24] text-white font-semibold text-[16px] disabled:opacity-50";
export const btnGhost = "inline-flex items-center justify-center gap-2 h-12 px-5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-[#1E293B] font-semibold text-[16px] disabled:opacity-50";
