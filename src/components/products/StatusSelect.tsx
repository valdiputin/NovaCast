"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown } from "lucide-react";
import { setProductStatusAction } from "@/app/actions/catalog";
import type { Tone } from "@/lib/labels";
import { cn } from "../ui/common";

const TONE: Record<Tone, string> = {
  green: "bg-emerald-50 text-emerald-600",
  amber: "bg-amber-50 text-amber-600",
  red: "bg-rose-50 text-rose-600",
  gray: "bg-slate-100 text-slate-500",
  blue: "bg-blue-50 text-blue-600",
  purple: "bg-purple-50 text-purple-600",
};

/**
 * Pill trạng thái có dropdown (ảnh Voucher bán lẻ).
 * "Đang bán" = tự tính theo tồn (Đang bán / Sắp hết hàng / Hết hàng); có thể đặt tay Hết hàng / Ngừng bán.
 */
export function StatusSelect({ productId, value, label, tone }: { productId: string; value: string; label: string; tone: Tone }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <span className={cn("relative inline-flex items-center h-11 rounded-full pl-4 pr-9 font-semibold text-[15px]", TONE[tone])}>
      {label}
      <ChevronDown className="w-4 h-4 absolute right-3 pointer-events-none" />
      <select
        aria-label="Đổi trạng thái"
        value={value}
        disabled={pending}
        onChange={(e) =>
          start(async () => {
            const res = await setProductStatusAction(productId, e.target.value as "ACTIVE" | "INACTIVE" | "OUT_OF_STOCK");
            if ("error" in res) return void toast.error(res.error);
            toast.success("Đã cập nhật trạng thái");
            router.refresh();
          })
        }
        className="absolute inset-0 opacity-0 cursor-pointer"
      >
        <option value="ACTIVE">Đang bán (tự động theo tồn kho)</option>
        <option value="OUT_OF_STOCK">Hết hàng</option>
        <option value="INACTIVE">Ngừng bán</option>
      </select>
    </span>
  );
}
