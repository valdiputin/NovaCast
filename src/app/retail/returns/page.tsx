"use client";

import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { RotateCcw, AlertTriangle, ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";

export default function RetailReturnsPage() {
  const [tab, setTab] = useState<"return" | "dispose" | "transfer">("return");

  return (
    <div className="flex-1 flex flex-col">
      <Header
        title="Xuất & Trả Hàng / Chuyển Kho"
        subtitle="Quản lý khách trả hàng, xuất hủy hàng lỗi và điều chuyển vị trí Kho ↔ Kệ"
      />

      <main className="p-8 space-y-6">
        {/* 3 Tabs */}
        <div className="flex space-x-3 border-b border-slate-200 pb-3">
          <button
            onClick={() => setTab("return")}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              tab === "return"
                ? "bg-[#1565F5] text-white shadow-md shadow-blue-500/20"
                : "bg-white text-slate-600 hover:bg-slate-100"
            }`}
          >
            <RotateCcw className="w-4 h-4" />
            <span>Khách Trả Hàng (Hoàn Kho)</span>
          </button>

          <button
            onClick={() => setTab("dispose")}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              tab === "dispose"
                ? "bg-rose-600 text-white shadow-md shadow-red-500/20"
                : "bg-white text-slate-600 hover:bg-slate-100"
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            <span>Xuất Hủy / Hàng Lỗi</span>
          </button>

          <button
            onClick={() => setTab("transfer")}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              tab === "transfer"
                ? "bg-amber-600 text-white shadow-md shadow-amber-500/20"
                : "bg-white text-slate-600 hover:bg-slate-100"
            }`}
          >
            <ArrowRightLeft className="w-4 h-4" />
            <span>Chuyển Kho (Kho ↔ Kệ)</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm space-y-6">
          {tab === "return" && (
            <div className="space-y-4">
              <h3 className="font-bold text-slate-800 text-sm">
                Tạo Phiếu Khách Trả Hàng (Hoàn Kho)
              </h3>
              <p className="text-xs text-slate-400">
                Ghi nhận hàng khách trả. Hàng nguyên vẹn sẽ được hoàn lại tồn Kệ để tiếp tục bán; hàng lỗi được đưa vào vị trí Hàng Lỗi và không cộng vào tồn bán được.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                <input
                  type="text"
                  placeholder="Khách hàng (*)"
                  className="px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs"
                />
                <input
                  type="text"
                  placeholder="Mã đơn hàng gốc (tùy chọn)"
                  className="px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs"
                />
                <select className="px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs">
                  <option value="GOOD">Hàng nguyên vẹn (Hoàn tồn bán)</option>
                  <option value="DAMAGED">Hàng lỗi (Vào kho lỗi, không bán)</option>
                </select>
              </div>
              <button
                onClick={() => toast.success("Đã ghi nhận phiếu hoàn hàng vào sổ cái stock_movements")}
                className="px-5 py-2.5 rounded-xl bg-[#1565F5] text-white font-bold text-xs hover:bg-blue-700"
              >
                Hoàn thành trả hàng
              </button>
            </div>
          )}

          {tab === "dispose" && (
            <div className="space-y-4">
              <h3 className="font-bold text-slate-800 text-sm">
                Xuất Hủy Hàng Hỏng / Hết Hạn
              </h3>
              <p className="text-xs text-slate-400">
                Ghi nhận movement type DISPOSE trừ trực tiếp số lượng tồn kho và ghi lý do vào sổ cái.
              </p>
              <button
                onClick={() => toast.success("Đã xuất hủy hàng hỏng")}
                className="px-5 py-2.5 rounded-xl bg-rose-600 text-white font-bold text-xs hover:bg-rose-700"
              >
                Xác nhận xuất hủy
              </button>
            </div>
          )}

          {tab === "transfer" && (
            <div className="space-y-4">
              <h3 className="font-bold text-slate-800 text-sm">
                Điều Chuyển Vị Trí Kho ↔ Kệ
              </h3>
              <p className="text-xs text-slate-400">
                Chuyển hàng từ Kho sau ra Kệ trưng bày hoặc ngược lại mà không làm thay đổi tổng tồn toàn cửa hàng.
              </p>
              <button
                onClick={() => toast.success("Đã điều chuyển vị trí Kho ↔ Kệ")}
                className="px-5 py-2.5 rounded-xl bg-amber-600 text-white font-bold text-xs hover:bg-amber-700"
              >
                Thực hiện chuyển kho
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

