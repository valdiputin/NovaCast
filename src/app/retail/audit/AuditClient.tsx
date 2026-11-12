"use client";

import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { Check, RefreshCw } from "lucide-react";
import { balanceStockAuditAction } from "@/app/actions/inventory";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface AuditItemView {
  id: string;
  sku: string;
  name: string;
  systemQty: number;
  actualQty: number;
}

export default function RetailAuditClient({
  initialItems,
}: {
  initialItems: AuditItemView[];
}) {
  const router = useRouter();
  const [items, setItems] = useState<AuditItemView[]>(initialItems);
  const [loading, setLoading] = useState(false);

  const updateActual = (index: number, val: number) => {
    const next = [...items];
    next[index].actualQty = val;
    setItems(next);
  };

  const handleAuditSave = async () => {
    setLoading(true);
    const res = await balanceStockAuditAction(
      `AUDIT-${Date.now()}`,
      items.map((it) => ({
        variantId: it.id,
        actualQty: it.actualQty,
        reason: "Kiểm đếm định kỳ bán lẻ",
      }))
    );
    setLoading(false);

    if (res?.error) {
      toast.error(res.error);
    } else {
      toast.success("Đã duyệt phiếu kiểm kê! Sổ cái sinh movement ADJUSTMENT cân bằng tồn kho.");
      router.refresh();
    }
  };

  return (
    <div className="flex-1 flex flex-col">
      <Header
        title="Kiểm Kê Tồn Kho & Quét Mobile"
        subtitle="Đối chiếu tồn hệ thống với thực tế đếm được và đồng bộ màn quét điện thoại"
      />

      <main className="p-8 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-sm">Bảng Đối Chiếu Số Liệu</h3>
              <button
                onClick={handleAuditSave}
                disabled={loading}
                className="px-4 py-2 bg-[#1565F5] text-white font-bold text-xs rounded-xl hover:bg-blue-700 shadow-md shadow-blue-500/20 disabled:opacity-50"
              >
                {loading ? "Đang xử lý..." : "Cân Bằng Kho"}
              </button>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-100">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-blue-50/50 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100">
                  <tr>
                    <th className="py-3 px-4">Sản Phẩm & SKU</th>
                    <th className="py-3 px-4 text-center">Tồn Hệ Thống</th>
                    <th className="py-3 px-4 text-center">Thực Tế Đếm</th>
                    <th className="py-3 px-4 text-center">Chênh Lệch</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((it, idx) => {
                    const diff = it.actualQty - it.systemQty;
                    return (
                      <tr key={it.id} className="hover:bg-slate-50/60">
                        <td className="py-3 px-4">
                          <p className="font-bold text-slate-800">{it.name}</p>
                          <p className="font-mono text-[10px] text-slate-400">{it.sku}</p>
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-slate-700">
                          {it.systemQty}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <input
                            type="number"
                            value={it.actualQty}
                            onChange={(e) => updateActual(idx, Number(e.target.value))}
                            className="w-20 px-2 py-1 rounded-lg border border-slate-200 text-center font-bold"
                          />
                        </td>
                        <td className="py-3 px-4 text-center font-bold">
                          <span
                            className={
                              diff === 0
                                ? "text-slate-400"
                                : diff > 0
                                ? "text-emerald-600"
                                : "text-rose-600"
                            }
                          >
                            {diff > 0 ? `+${diff}` : diff}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-xl flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <span className="font-bold text-sm">Giao Diện Quét Mobile</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-semibold border border-emerald-500/30">
                  Online
                </span>
              </div>

              <div className="h-40 rounded-2xl border-2 border-dashed border-blue-500/40 bg-slate-800/50 flex flex-col items-center justify-center p-4 text-center">
                <div className="w-12 h-12 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center mb-2 animate-pulse">
                  <RefreshCw className="w-6 h-6" />
                </div>
                <p className="text-xs font-semibold text-slate-300">Hướng camera vào mã vạch</p>
                <p className="text-[10px] text-slate-500">Tự động nhận diện EAN-13 / Code128</p>
              </div>
            </div>

            <button
              onClick={() => {
                if (items.length > 0) {
                  updateActual(0, items[0].systemQty);
                  toast.success("Đã đồng bộ số liệu quét từ điện thoại lên hệ thống!");
                }
              }}
              className="w-full mt-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center space-x-2 transition-colors"
            >
              <Check className="w-4 h-4" />
              <span>Khớp số liệu & Ghi nhận</span>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
