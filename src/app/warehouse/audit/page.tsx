"use client";

import { Header } from "@/components/layout/Header";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export default function WarehouseAuditPage() {
  const handleBalance = () => {
    toast.success("Đã duyệt phiên kiểm kê & Cân bằng kho thành công!");
  };

  return (
    <div className="flex-1 flex flex-col">
      <Header
        title="Kiểm Kê & Tồn Kho (Doanh Nghiệp)"
        subtitle="Đối chiếu kiểm đếm thực tế vật tư và cân bằng kho tự động"
      />
      <main className="p-8 space-y-6">
        <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="font-bold text-slate-800 text-base">Phiên Kiểm Kê Đang Thực Hiện</h3>
              <p className="text-xs text-slate-400">Mã phiên: PKK-20261112-01</p>
            </div>
            <button
              onClick={handleBalance}
              className="px-5 py-2.5 rounded-xl bg-[#1565F5] text-white font-bold text-xs hover:bg-blue-700 shadow-md shadow-blue-500/20 flex items-center space-x-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Cân Bằng Kho</span>
            </button>
          </div>

          <div className="text-xs text-slate-500">
            Khi bấm nút <b>Cân Bằng Kho</b>, hệ thống sẽ đối chiếu số lượng thực đếm với số tồn trên phần mềm, tự động ghi nhận các bản ghi <code>ADJUSTMENT</code> vào sổ cái <code>stock_movements</code> và cân bằng trực tiếp tồn kho thực tế.
          </div>
        </div>
      </main>
    </div>
  );
}
