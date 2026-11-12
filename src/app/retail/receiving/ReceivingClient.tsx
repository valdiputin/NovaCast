"use client";

import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { Trash2, CheckCircle } from "lucide-react";
import { completeRetailReceivingAction } from "@/app/actions/inventory";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface ReceivingItem {
  variantId: string;
  sku: string;
  name: string;
  quantity: number;
  costPrice: number;
  discountRate: number;
}

export default function ReceivingClientPage({
  availableVariants,
}: {
  availableVariants: { id: string; sku: string; name: string; costPrice: number }[];
}) {
  const router = useRouter();
  const [items, setItems] = useState<ReceivingItem[]>(
    availableVariants.slice(0, 2).map((v) => ({
      variantId: v.id,
      sku: v.sku,
      name: v.name,
      quantity: 50,
      costPrice: v.costPrice,
      discountRate: 5,
    }))
  );

  const [barcodeInput, setBarcodeInput] = useState("");
  const [supplier, setSupplier] = useState("Công ty Dệt Kim Thành");
  const [note, setNote] = useState("Nhập bổ sung hàng mùa đông đợt 1");
  const [loading, setLoading] = useState(false);

  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput) return;

    const matched = availableVariants.find(
      (v) => v.sku.toLowerCase() === barcodeInput.toLowerCase()
    );

    if (matched) {
      const idx = items.findIndex((i) => i.variantId === matched.id);
      if (idx >= 0) {
        const next = [...items];
        next[idx].quantity += 1;
        setItems(next);
        toast.success(`Đã tăng số lượng ${matched.sku} lên ${next[idx].quantity}`);
      } else {
        setItems([
          ...items,
          {
            variantId: matched.id,
            sku: matched.sku,
            name: matched.name,
            quantity: 1,
            costPrice: matched.costPrice,
            discountRate: 0,
          },
        ]);
        toast.success(`Đã thêm mã ${matched.sku} vào phiếu nhập`);
      }
    } else {
      toast.error(`Không tìm thấy sản phẩm có mã SKU: ${barcodeInput}`);
    }
    setBarcodeInput("");
  };

  const updateItem = (index: number, field: keyof ReceivingItem, value: string | number) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    setItems(updated);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleComplete = async () => {
    if (items.length === 0) {
      toast.error("Vui lòng thêm ít nhất một sản phẩm vào phiếu nhập");
      return;
    }
    setLoading(true);
    const res = await completeRetailReceivingAction({
      supplierName: supplier,
      note,
      items: items.map((i) => ({
        variantId: i.variantId,
        quantity: i.quantity,
        costPrice: i.costPrice,
        discountRate: i.discountRate,
      })),
    });

    setLoading(false);
    if (res?.error) {
      toast.error(res.error);
    } else {
      toast.success(`Hoàn thành nhập kho thành công! Mã phiếu: ${res.code}`);
      router.refresh();
    }
  };

  const subtotal = items.reduce(
    (acc, it) => acc + it.quantity * it.costPrice * (1 - it.discountRate / 100),
    0
  );

  return (
    <div className="flex-1 flex flex-col">
      <Header
        title="Nhập Hàng (Từ Nhà Cung Cấp)"
        subtitle="Tạo phiếu nhập kho, quét mã vạch và cập nhật trực tiếp sổ cái stock_movements"
      />

      <main className="p-8 space-y-6">
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Nhà Cung Cấp *
              </label>
              <select
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:border-blue-500"
              >
                <option value="Công ty Dệt Kim Thành">Công ty Dệt Kim Thành</option>
                <option value="Công ty Vải Việt">Công ty Vải Việt</option>
                <option value="Công ty Phụ Liệu An Phát">Công ty Phụ Liệu An Phát</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Ngày Chứng Từ
              </label>
              <input
                type="text"
                disabled
                value={new Date().toLocaleDateString("vi-VN")}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-500 font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Ghi Chú Đơn Nhập
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <form onSubmit={handleBarcodeSubmit} className="relative">
            <input
              type="text"
              autoFocus
              placeholder="[F2] Quét mã vạch SKU liên tục (VD: AT-BS-W-M, AT-BS-B-L) rồi Enter..."
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border-2 border-dashed border-blue-400 bg-blue-50/30 text-xs font-medium text-slate-700 placeholder-blue-400 focus:outline-none focus:border-blue-600 focus:bg-white transition-all"
            />
          </form>

          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-blue-50/50 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100">
                <tr>
                  <th className="py-3 px-4">Sản Phẩm & SKU</th>
                  <th className="py-3 px-4 w-32">Số Lượng Nhập</th>
                  <th className="py-3 px-4 w-40">Giá Nhập (VND)</th>
                  <th className="py-3 px-4 w-28">Chiết Khấu (%)</th>
                  <th className="py-3 px-4 text-right">Thành Tiền</th>
                  <th className="py-3 px-4 text-center w-16">Xóa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((it, idx) => {
                  const lineTotal = it.quantity * it.costPrice * (1 - it.discountRate / 100);
                  return (
                    <tr key={it.variantId} className="hover:bg-slate-50/60">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-800">{it.name}</div>
                        <div className="font-mono text-[10px] text-slate-400">{it.sku}</div>
                      </td>
                      <td className="py-3 px-4">
                        <input
                          type="number"
                          min={1}
                          value={it.quantity}
                          onChange={(e) =>
                            updateItem(idx, "quantity", Number(e.target.value))
                          }
                          className="w-24 px-2 py-1 rounded-lg border border-slate-200 font-bold text-slate-800 text-center"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <input
                          type="number"
                          step={1000}
                          value={it.costPrice}
                          onChange={(e) =>
                            updateItem(idx, "costPrice", Number(e.target.value))
                          }
                          className="w-32 px-2 py-1 rounded-lg border border-slate-200 text-slate-800 text-right font-medium"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={it.discountRate}
                          onChange={(e) =>
                            updateItem(idx, "discountRate", Number(e.target.value))
                          }
                          className="w-20 px-2 py-1 rounded-lg border border-slate-200 text-slate-800 text-center"
                        />
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900">
                        {new Intl.NumberFormat("vi-VN").format(Math.round(lineTotal))}đ
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => removeItem(idx)}
                          className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between pt-4 border-t border-slate-100 space-y-4 md:space-y-0">
            <div className="text-sm">
              <span className="text-slate-500 mr-2">Tổng giá trị đơn nhập:</span>
              <span className="text-xl font-black text-blue-600">
                {new Intl.NumberFormat("vi-VN").format(Math.round(subtotal))}đ
              </span>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={handleComplete}
                disabled={loading}
                className="px-6 py-2.5 rounded-xl bg-[#1565F5] hover:bg-blue-700 text-white font-bold text-xs shadow-lg shadow-blue-500/25 flex items-center space-x-2 transition-all disabled:opacity-50"
              >
                <CheckCircle className="w-4 h-4" />
                <span>{loading ? "Đang xử lý..." : "Hoàn thành nhập kho"}</span>
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
