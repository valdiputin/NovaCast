"use client";

import Link from "next/link";
import { X } from "lucide-react";
import { cn } from "../ui/common";

/** Khung panel chứng từ có thanh tiêu đề xanh (ảnh Nhập hàng / Trả hàng) */
export function DocPanel({ title, icon, closeHref, children, footer, badge }: { title: React.ReactNode; icon: React.ReactNode; closeHref: string; children: React.ReactNode; footer?: React.ReactNode; badge?: React.ReactNode }) {
  return (
    <section className="bg-white rounded-2xl border border-slate-100 shadow-[0_4px_20px_rgba(15,23,42,0.06)] overflow-hidden">
      <div className="h-[60px] bg-[#1565F5] text-white flex items-center justify-between px-6">
        <h2 className="flex items-center gap-3 text-[22px] font-bold">
          {icon}
          {title}
          {badge}
        </h2>
        <Link href={closeHref} scroll={false} className="p-1 hover:bg-white/10 rounded-lg" aria-label="Đóng">
          <X className="w-7 h-7" />
        </Link>
      </div>
      <div className="p-5 space-y-4">{children}</div>
      {footer && <div className="px-5 pb-5 flex flex-wrap items-center justify-end gap-4">{footer}</div>}
    </section>
  );
}

export function FieldBox({ label, required, icon, children, className }: { label: string; required?: boolean; icon?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className="text-[17px] font-semibold text-[#1E293B] mb-2">
        {label} {required && <span className="text-[#E5252A]">*</span>}
      </div>
      <div className="relative flex items-center">
        {icon && <span className="absolute left-4 text-[#1E293B] pointer-events-none">{icon}</span>}
        {children}
      </div>
    </div>
  );
}

export const panelInput = "w-full h-[52px] rounded-xl border border-slate-200 bg-white text-[17px] text-[#1E293B] focus:outline-none focus:border-blue-500 disabled:bg-slate-50";
