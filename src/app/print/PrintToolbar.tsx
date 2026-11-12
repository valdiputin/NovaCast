"use client";

import { useEffect } from "react";
import { Printer } from "lucide-react";

/** Tự mở hộp thoại in (chọn "Lưu dưới dạng PDF" để xuất PDF) */
export function PrintToolbar({ auto = true }: { auto?: boolean }) {
  useEffect(() => {
    if (auto) {
      const t = setTimeout(() => window.print(), 400);
      return () => clearTimeout(t);
    }
  }, [auto]);
  return (
    <div className="print:hidden flex justify-end gap-3 mb-6">
      <button onClick={() => window.print()} className="inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-[#1565F5] text-white font-semibold">
        <Printer className="w-5 h-5" /> In / Lưu PDF
      </button>
    </div>
  );
}
