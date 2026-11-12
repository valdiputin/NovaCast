import { getCurrentStore } from "@/lib/auth";
import { Header } from "@/components/layout/Header";
import { Users } from "lucide-react";

export default async function RetailPartnersPage() {
  const store = await getCurrentStore("RETAIL");

  return (
    <div className="flex-1 flex flex-col">
      <Header
        title="Quản Lý Đối Tác (NCC & Khách Hàng)"
        subtitle={`Thông tin nhà cung cấp và danh bạ khách hàng của ${store.name}`}
      />
      <main className="p-8">
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-100 shadow-sm space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-slate-800 text-base">Quản Lý Đối Tác & Công Nợ</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Lưu trữ thông tin liên hệ, mã số thuế, địa chỉ và theo dõi công nợ chi tiết của Nhà Cung Cấp và Khách Hàng thân thiết.
          </p>
        </div>
      </main>
    </div>
  );
}
