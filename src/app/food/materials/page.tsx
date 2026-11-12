import { getCurrentStore } from "@/lib/auth";
import { Header } from "@/components/layout/Header";
import { Boxes } from "lucide-react";

export default async function FoodMaterialsPage() {
  const store = await getCurrentStore("FOOD");

  return (
    <div className="flex-1 flex flex-col">
      <Header
        title="Quản Lý Nguyên Liệu & Định Lượng"
        subtitle={`Quản lý định mức NVL và công thức chế biến của ${store.name}`}
      />
      <main className="p-8">
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-100 shadow-sm space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <Boxes className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-slate-800 text-base">Định Lượng & Nguyên Liệu Bếp</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Hệ thống tự động trừ tồn kho nguyên liệu (thịt gà, bột, tương...) theo công thức khi đơn hàng chuyển sang trạng thái Hoàn Thành.
          </p>
        </div>
      </main>
    </div>
  );
}

