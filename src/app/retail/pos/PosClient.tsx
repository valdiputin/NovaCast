"use client";

import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { Trash2, Printer, CreditCard } from "lucide-react";
import { checkoutPosAction } from "@/app/actions/inventory";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface PosItem {
  variantId: string;
  sku: string;
  name: string;
  price: number;
  quantity: number;
}

export default function PosClientPage({
  availableVariants,
}: {
  availableVariants: { id: string; sku: string; name: string; price: number }[];
}) {
  const router = useRouter();
  const [cart, setCart] = useState<PosItem[]>(
    availableVariants.slice(0, 1).map((v) => ({
      variantId: v.id,
      sku: v.sku,
      name: v.name,
      price: v.price,
      quantity: 1,
    }))
  );
  const [customerCash, setCustomerCash] = useState<number>(200000);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [loading, setLoading] = useState(false);

  const subtotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const changeMoney = Math.max(0, customerCash - subtotal);

  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput) return;

    const matched = availableVariants.find(
      (v) => v.sku.toLowerCase() === barcodeInput.toLowerCase()
    );

    if (matched) {
      const idx = cart.findIndex((i) => i.variantId === matched.id);
      if (idx >= 0) {
        const next = [...cart];
        next[idx].quantity += 1;
        setCart(next);
      } else {
        setCart([
          ...cart,
          {
            variantId: matched.id,
            sku: matched.sku,
            name: matched.name,
            price: matched.price,
            quantity: 1,
          },
        ]);
      }
      toast.success(`Đã thêm ${matched.name} vào giỏ`);
    } else {
      toast.error(`Không tìm thấy mã sản phẩm: ${barcodeInput}`);
    }
    setBarcodeInput("");
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setLoading(true);
    const res = await checkoutPosAction({
      items: cart.map((i) => ({
        variantId: i.variantId,
        quantity: i.quantity,
      })),
      paymentMethod: "CASH",
    });

    setLoading(false);
    if ("error" in res) {
      toast.error(res.error);
    } else {
      toast.success(`Thanh toán thành công đơn hàng #${res.orderCode}! Tồn Kệ đã được trừ.`);
      setCart([]);
      router.refresh();
    }
  };

  return (
    <div className="flex-1 flex flex-col h-screen">
      <Header
        title="Bán Hàng Tại Quầy (POS)"
        subtitle="Quét mã vạch bán hàng nhanh, trừ trực tiếp tồn kho Kệ qua InventoryService"
      />

      <main className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 overflow-hidden">
        <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col justify-between overflow-hidden">
          <form onSubmit={handleBarcodeSubmit} className="mb-4">
            <input
              type="text"
              autoFocus
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              placeholder="[F2] Quét mã vạch SKU (VD: AT-BS-W-M, AT-BS-B-L) rồi Enter..."
              className="w-full px-4 py-3 rounded-2xl border-2 border-blue-500/30 text-sm font-semibold focus:outline-none focus:border-blue-600 bg-blue-50/20"
            />
          </form>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 text-xs">
            {cart.map((item, idx) => (
              <div key={item.variantId} className="py-3 flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-800 text-sm">{item.name}</p>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">{item.sku}</p>
                </div>
                <div className="flex items-center space-x-6">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => {
                        const next = [...cart];
                        if (next[idx].quantity > 1) next[idx].quantity -= 1;
                        setCart(next);
                      }}
                      className="w-6 h-6 rounded bg-slate-100 text-slate-700 font-bold"
                    >
                      -
                    </button>
                    <span className="font-bold text-sm text-slate-800 w-6 text-center">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => {
                        const next = [...cart];
                        next[idx].quantity += 1;
                        setCart(next);
                      }}
                      className="w-6 h-6 rounded bg-slate-100 text-slate-700 font-bold"
                    >
                      +
                    </button>
                  </div>
                  <span className="font-bold text-slate-900 w-24 text-right">
                    {new Intl.NumberFormat("vi-VN").format(item.price * item.quantity)}đ
                  </span>
                  <button
                    onClick={() => setCart(cart.filter((_, i) => i !== idx))}
                    className="text-rose-500 hover:text-rose-700 p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="space-y-4">
            <h3 className="font-bold text-slate-800 text-base flex items-center space-x-2">
              <CreditCard className="w-5 h-5 text-blue-600" />
              <span>Thanh Toán Đơn Hàng</span>
            </h3>

            <div className="space-y-2 text-xs pt-4 border-t border-slate-100">
              <div className="flex justify-between text-slate-500">
                <span>Số lượng món:</span>
                <span className="font-semibold text-slate-800">
                  {cart.reduce((a, b) => a + b.quantity, 0)}
                </span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Tổng tiền hàng:</span>
                <span className="font-black text-slate-900 text-base">
                  {new Intl.NumberFormat("vi-VN").format(subtotal)}đ
                </span>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Tiền khách đưa (VND)
                </label>
                <input
                  type="number"
                  step={10000}
                  value={customerCash}
                  onChange={(e) => setCustomerCash(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-800"
                />
              </div>

              <div className="flex justify-between text-xs font-bold text-slate-800 pt-2">
                <span>Tiền thối lại:</span>
                <span className="text-emerald-600 text-base">
                  {new Intl.NumberFormat("vi-VN").format(changeMoney)}đ
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={handleCheckout}
            disabled={cart.length === 0 || loading}
            className="w-full py-3.5 rounded-2xl bg-[#1565F5] hover:bg-blue-700 text-white font-bold text-sm shadow-xl shadow-blue-500/25 flex items-center justify-center space-x-2 transition-all disabled:opacity-50"
          >
            <Printer className="w-4 h-4" />
            <span>{loading ? "Đang xử lý..." : "[F9] Thanh Toán & Trừ Kho"}</span>
          </button>
        </div>
      </main>
    </div>
  );
}

