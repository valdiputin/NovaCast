"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, ChevronDown, Ticket, Tag } from "lucide-react";
import { setProductDiscountAction } from "@/app/actions/catalog";
import { cn } from "../ui/common";

const OPTIONS = [
  { v: 0, label: "Không giảm", icon: null, color: "" },
  { v: 5, label: "Giảm 5%", icon: Ticket, color: "text-orange-500" },
  { v: 10, label: "Giảm 10%", icon: Tag, color: "text-blue-600" },
  { v: 15, label: "Giảm 15%", icon: Tag, color: "text-purple-600" },
  { v: 20, label: "Giảm 20%", icon: Tag, color: "text-emerald-600" },
];

/**
 * Dropdown voucher theo sản phẩm (ảnh "Product Management"): đổi là lưu ngay.
 * variant "pill": kiểu ảnh Voucher bán lẻ (pill xanh, "Không áp dụng").
 */
export function DiscountSelect({ productId, value, variant = "box" }: { productId: string; value: number; variant?: "box" | "pill" }) {
  const router = useRouter();
  const [current, setCurrent] = useState(value);
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  const choose = (next: number) => {
    setOpen(false);
    if (next === current) return;
    const prev = current;
    setCurrent(next);
    start(async () => {
      const res = await setProductDiscountAction(productId, next);
      if ("error" in res) {
        setCurrent(prev);
        return void toast.error(res.error);
      }
      toast.success(next === 0 ? "Đã bỏ giảm giá" : `Đã áp dụng giảm ${next}%`);
      router.refresh();
    });
  };
  const label = current === 0 ? (variant === "pill" ? "Không áp dụng" : "Không giảm") : `Giảm ${current}%`;
  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        disabled={pending}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "inline-flex items-center justify-between gap-3 h-11 min-w-[150px] px-4 text-[15px] disabled:opacity-60",
          variant === "pill"
            ? cn("rounded-full font-semibold", current > 0 ? "bg-blue-50 text-blue-700" : "bg-slate-50 border border-slate-200 text-slate-700")
            : cn("rounded-xl border bg-white", open ? "border-blue-500 ring-2 ring-blue-100" : "border-slate-200", "text-[#1E293B]")
        )}
      >
        {label}
        <ChevronDown className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-44 bg-white rounded-xl shadow-xl border border-slate-100 py-1">
          {OPTIONS.map((o) => (
            <button
              key={o.v}
              type="button"
              onClick={() => choose(o.v)}
              className={cn("w-full flex items-center gap-2.5 px-3 py-2 text-[15px] hover:bg-slate-50", o.v === current && "bg-blue-50", o.color || "text-slate-700")}
            >
              {o.icon ? <o.icon className="w-4 h-4" fill="currentColor" stroke="white" /> : <Check className={cn("w-4 h-4", o.v === current ? "opacity-100" : "opacity-0")} />}
              {o.v === 0 && variant === "pill" ? "Không áp dụng" : o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
