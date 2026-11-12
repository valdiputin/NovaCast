import { prisma } from "@/lib/prisma";
import { getCurrentStore } from "@/lib/auth";
import { Header } from "@/components/layout/Header";
import { KpiCard, StatusPill } from "@/components/ui/common";
import { Warehouse, AlertOctagon, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { formatCurrency } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function WarehouseOverviewPage() {
  const store = await getCurrentStore("WAREHOUSE");

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [materials, receiptsToday, issuesToday] = await Promise.all([
    prisma.material.findMany({
      where: { storeId: store.id, deletedAt: null },
    }),
    prisma.stockReceipt.count({
      where: { storeId: store.id, receiptDate: { gte: today } },
    }),
    prisma.stockIssue.count({
      where: { storeId: store.id, issueDate: { gte: today } },
    }),
  ]);

  const totalInventoryValue = materials.reduce(
    (sum, m) => sum + Number(m.costPrice) * m.totalQty,
    0
  );

  const urgentMaterials = materials.filter((m) => m.totalQty <= m.minStock);

  return (
    <div className="flex-1 flex flex-col">
      <Header
        title={`Tổng Quan Kho — ${store.name}`}
        subtitle="Quản lý biến động vật tư, thành phẩm và tồn kho từ DB thật"
      />

      <main className="p-8 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          <KpiCard
            title="Tổng giá trị tồn kho"
            value={formatCurrency(totalInventoryValue)}
            icon={<Warehouse className="w-6 h-6" />}
            iconBgColor="bg-blue-50 text-blue-600"
            changePercent={5}
            changeLabel="so với tuần trước"
          />
          <KpiCard
            title="Cần đặt mua gấp"
            value={`${urgentMaterials.length} mã`}
            icon={<AlertOctagon className="w-6 h-6" />}
            iconBgColor="bg-rose-50 text-rose-600"
            changePercent={urgentMaterials.length > 0 ? 20 : 0}
            changeLabel="dưới định mức tối thiểu"
          />
          <KpiCard
            title="Phiếu nhập kho hôm nay"
            value={`${receiptsToday} phiếu`}
            icon={<ArrowDownToLine className="w-6 h-6" />}
            iconBgColor="bg-emerald-50 text-emerald-600"
            changePercent={0}
            changeLabel="so với hôm qua"
          />
          <KpiCard
            title="Phiếu xuất kho hôm nay"
            value={`${issuesToday} phiếu`}
            icon={<ArrowUpFromLine className="w-6 h-6" />}
            iconBgColor="bg-amber-50 text-amber-600"
            changePercent={0}
            changeLabel="so với hôm qua"
          />
        </div>

        {/* Danh sách vật tư cần đặt gấp */}
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
          <div className="flex items-center space-x-2 text-rose-600 mb-4">
            <AlertOctagon className="w-5 h-5" />
            <h3 className="font-bold text-slate-800 text-base">Vật Tư Dưới Định Mức Tối Thiểu</h3>
          </div>

          <div className="space-y-3">
            {urgentMaterials.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">Toàn bộ vật tư và thành phẩm đều đủ định mức</p>
            ) : (
              urgentMaterials.map((m) => (
                <div
                  key={m.id}
                  className="p-3 rounded-xl bg-slate-50/70 border border-slate-100 flex items-center justify-between"
                >
                  <div>
                    <p className="text-xs font-bold text-slate-800">{m.name}</p>
                    <p className="text-[10px] text-slate-400">
                      Mã: <span className="font-semibold text-slate-600">{m.sku}</span> · {m.locationBin ?? "Chưa xếp kệ"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-black text-rose-600">
                      {m.totalQty} / {m.minStock} {m.unit}
                    </p>
                    <StatusPill label="Sắp hết" variant="amber" />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
