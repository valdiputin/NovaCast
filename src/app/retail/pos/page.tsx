"use client";

import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { Trash2, Printer, CreditCard } from "lucide-react";
import { toast } from "sonner";

interface PosItem {
  id: string;
  sku: string;
  name: string;
  price: number;
  quantity: number;
}

export default function RetailPosPage() {
  const [cart, setCart] = useState<PosItem[]>([
    { id: "1", sku: "AT-BS-W-M", name: "Áo thun Basic Unisex (Trắng / M)", price: 180000, quantity: 1 },
  ]);
  const [customerCash, setCustomerCash] = useState<number>(200000);
  const [barcodeInput, setBarcodeInput] = useState("");

  const subtotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const changeMoney = Math.max(0, customerCash - subtotal);

  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput) return;
    setCart((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        sku: barcodeInput,
        name: `Sản phẩm quét mã (${barcodeInput})`,
        price: 150000,
        quantity: 1,
      },
    ]);
    setBarcodeInput("");
    toast.success("Đã thêm sản phẩm vào đơn");
  };

  const handleCheckout = () => {
    toast.success("Thanh toán thành công! Trừ tồn kho Kệ và in hóa đơn khổ 80mm");
    setCart([]);
  };

  return (
    <div className="flex-1 flex flex-col h-screen">
      <Header
        title="Bán Hàng Tại Quầy (POS)"
        subtitle="Quét mã vạch bán hàng nhanh, trừ trực tiếp tồn kho Kệ"
      />

      <main className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 overflow-hidden">
        {/* Khung quét mã & Giỏ hàng */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col justify-between overflow-hidden">
          <form onSubmit={handleBarcodeSubmit} className="mb-4">
            <input
              type="text"
              autoFocus
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              placeholder="[F2] Quét mã vạch hoặc gõ SKU rồi Enter..."
              className="w-full px-4 py-3 rounded-2xl border-2 border-blue-500/30 text-sm font-semibold focus:outline-none focus:border-blue-600 bg-blue-50/20"
            />
          </form>

          {/* Bảng sản phẩm trong giỏ */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 text-xs">
            {cart.map((item, idx) => (
              <div key={item.id} className="py-3 flex items-center justify-between">
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

        {/* Khung thanh toán */}
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
            disabled={cart.length === 0}
            className="w-full py-3.5 rounded-2xl bg-[#1565F5] hover:bg-blue-700 text-white font-bold text-sm shadow-xl shadow-blue-500/25 flex items-center justify-center space-x-2 transition-all disabled:opacity-50"
          >
            <Printer className="w-4 h-4" />
            <span>[F9] Thanh Toán & In Bill</span>
          </button>
        </div>
      </main>
    </div>
  );
}
