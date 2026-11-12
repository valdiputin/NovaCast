"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Eye, FileText } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Pill } from "@/components/ui/kit";
import { ORDER_STATUS, PAYMENT_LABEL } from "@/lib/labels";
import { formatCurrency } from "@/lib/format";

export interface OrderView {
  id: string;
  code: string;
  customerName: string;
  customerPhone: string | null;
  customerAddress: string | null;
  note: string | null;
  paymentMethod: string;
  status: string;
  subtotal: number;
  discountAmount: number;
  shippingFee: number;
  totalAmount: number;
  voucherCode: string | null;
  items: { name: string; quantity: number; total: number }[];
}

/** Nút 👁 + modal chi tiết đơn (ảnh "Order Details Modal"); mở bằng ?view=<mã đơn> để chia sẻ link */
export function OrderDetail({ order }: { order: OrderView }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const open = sp.get("view") === order.code;
  const setOpen = (v: boolean) => {
    const q = new URLSearchParams(sp.toString());
    if (v) q.set("view", order.code);
    else q.delete("view");
    router.replace(`${pathname}?${q.toString()}`, { scroll: false });
  };
  const st = ORDER_STATUS[order.status];
  return (
    <>
      <button onClick={() => setOpen(true)} className="p-2 text-[#1E293B] hover:bg-slate-100 rounded-lg" title="Xem chi tiết">
        <Eye className="w-6 h-6" />
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={`Đơn hàng #${order.code}`} icon={<FileText className="w-8 h-8 text-white bg-[#1565F5] rounded-md p-1" />} width="max-w-[620px]">
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[17px]">
          <div className="text-slate-500">Khách hàng</div>
          <div className="text-slate-500">SĐT</div>
          <div className="font-semibold text-[#1E293B] text-[19px]">{order.customerName}</div>
          <div className="font-semibold text-[#1E293B] text-[19px]">{order.customerPhone ?? "—"}</div>
        </div>
        <div className="mt-4 text-[17px]">
          <div className="text-slate-500">Địa chỉ</div>
          <div className="font-semibold text-[#1E293B] text-[19px]">{order.customerAddress ?? "—"}</div>
          <div className="text-slate-500 mt-3">Ghi chú</div>
          <div className="text-[#1E293B]">{order.note || "Không có"}</div>
        </div>
        <div className="grid grid-cols-2 gap-x-6 mt-3 text-[17px] pb-4 border-b border-slate-100">
          <div>
            <div className="text-slate-500">Thanh toán</div>
            <div className="text-[#1E293B] text-[19px]">{PAYMENT_LABEL[order.paymentMethod] ?? order.paymentMethod}</div>
          </div>
          <div>
            <div className="text-slate-500">Trạng thái</div>
            <Pill mode="dot" label={st.label} tone={st.tone} className="mt-1 text-[16px] px-4" />
          </div>
        </div>
        <div className="pt-4 space-y-3 text-[18px]">
          <div className="font-bold text-[#1E293B]">Chi tiết món</div>
          {order.items.map((it, i) => (
            <div key={i} className="flex justify-between">
              <span className="text-[#1E293B]">{it.name}{it.quantity > 1 ? ` × ${it.quantity}` : ""}</span>
              <span className="font-bold text-[#1E293B]">{formatCurrency(it.total)}</span>
            </div>
          ))}
          {order.discountAmount > 0 && (
            <div className="flex justify-between text-emerald-600">
              <span>Giảm giá{order.voucherCode ? ` (${order.voucherCode})` : ""}</span>
              <span>-{formatCurrency(order.discountAmount)}</span>
            </div>
          )}
          <div className="flex justify-between text-slate-500">
            <span>Phí ship</span>
            <span>{formatCurrency(order.shippingFee)}</span>
          </div>
        </div>
        <div className="mt-4 -mx-3 px-5 py-4 rounded-2xl bg-blue-50 flex justify-between items-center">
          <span className="text-[24px] font-bold text-[#1E293B]">Tổng cộng</span>
          <span className="text-[26px] font-bold text-[#1565F5]">{formatCurrency(order.totalAmount)}</span>
        </div>
      </Modal>
    </>
  );
}
