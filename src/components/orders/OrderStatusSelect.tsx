"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown } from "lucide-react";
import type { OrderStatus } from "@prisma/client";
import { updateOrderStatusAction } from "@/app/actions/inventory";

const LABEL: Record<OrderStatus, string> = {
  PENDING: "Chờ xử lý",
  CONFIRMED: "Đã xác nhận",
  SHIPPING: "Đang giao",
  COMPLETED: "Hoàn thành",
  CANCELLED: "Đã hủy",
};

const NEXT: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["SHIPPING", "CANCELLED"],
  SHIPPING: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

const COLOR: Record<OrderStatus, string> = {
  PENDING: "bg-amber-100 text-amber-800 border-amber-200",
  CONFIRMED: "bg-blue-100 text-blue-800 border-blue-200",
  SHIPPING: "bg-indigo-100 text-indigo-800 border-indigo-200",
  COMPLETED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  CANCELLED: "bg-rose-100 text-rose-800 border-rose-200",
};

/** Ô trạng thái đơn dạng khối màu (ảnh "Order Details"); chỉ cho chuyển theo luồng hợp lệ */
export function OrderStatusSelect({ orderId, status }: { orderId: string; status: OrderStatus }) {
  const router = useRouter();
  const [current, setCurrent] = useState(status);
  const [pending, startTransition] = useTransition();
  const options = NEXT[current];

  return (
    <span className={`relative inline-flex items-center w-52 h-11 rounded-xl border ${COLOR[current]}`}>
      <select
        value={current}
        disabled={pending || options.length === 0}
        title={options.length === 0 ? "Đơn đã kết thúc" : "Đổi trạng thái"}
        onChange={(e) => {
          const next = e.target.value as OrderStatus;
          if (next === current) return;
          if (next === "CANCELLED" && !confirm("Hủy đơn hàng này?")) return;
          startTransition(async () => {
            const res = await updateOrderStatusAction(orderId, next);
            if ("error" in res) return void toast.error(res.error);
            setCurrent(next);
            toast.success(`Đã chuyển sang "${LABEL[next]}"`);
            router.refresh();
          });
        }}
        className="appearance-none w-full h-full bg-transparent pl-4 pr-9 text-[16px] font-medium outline-none cursor-pointer disabled:cursor-default"
      >
        <option value={current}>{LABEL[current]}</option>
        {options.map((s) => (
          <option key={s} value={s}>
            → {LABEL[s]}
          </option>
        ))}
      </select>
      <ChevronDown className="w-4 h-4 absolute right-3 pointer-events-none" />
    </span>
  );
}
