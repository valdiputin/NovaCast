import { getCurrentStore } from "@/lib/auth";
import { Header } from "@/components/layout/Header";
import { Users } from "lucide-react";

export default async function WarehousePartnersPage() {
  const store = await getCurrentStore("WAREHOUSE");

  return (
    <div className="flex-1 flex flex-col">
      <Header
        title="Đối Tác Cung Ứng & Phân Phối"
        subtitle={`Quản lý danh sách nhà cung ứng vật tư và đại lý phân phối của ${store.name}`}
      />
      <main className="p-8">
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-100 shadow-sm space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-slate-800 text-base">Danh Bạ Đối Tác Kho Doanh Nghiệp</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Quản lý hợp đồng cung ứng nguyên vật liệu, điều khoản giao nhận và công nợ với các đối tác chiến lược.
          </p>
        </div>
      </main>
    </div>
  );
}
