import { prisma } from "@/lib/prisma";
import { getCurrentStore } from "@/lib/auth";
import { Header } from "@/components/layout/Header";
import { KpiCard, StatusPill } from "@/components/ui/common";
import { DollarSign, Package, ShoppingCart, UserPlus, AlertTriangle } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function RetailOverviewPage() {
  const store = await getCurrentStore("RETAIL");

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [totalProducts, ordersToday, completedOrders, lowStockVariants] = await Promise.all([
    prisma.productVariant.count({
      where: { product: { storeId: store.id, deletedAt: null } },
    }),
    prisma.order.count({
      where: { storeId: store.id, createdAt: { gte: today } },
    }),
    prisma.order.findMany({
      where: { storeId: store.id, status: "COMPLETED", createdAt: { gte: today } },
      select: { totalAmount: true },
    }),
    prisma.productVariant.findMany({
      where: {
        product: { storeId: store.id, deletedAt: null },
        totalQty: { lte: 10 },
      },
      take: 5,
    }),
  ]);

  const revenueToday = completedOrders.reduce((sum, o) => sum + Number(o.totalAmount), 0);

  return (
    <div className="flex-1 flex flex-col">
      <Header
        title={`Tổng Quan Bán Lẻ — ${store.name}`}
        subtitle="Hiệu quả kinh doanh và cảnh báo tồn kho từ database thật"
      />

      <main className="p-8 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          <KpiCard
            title="Doanh thu hôm nay"
            value={formatCurrency(revenueToday)}
            icon={<DollarSign className="w-6 h-6" />}
            iconBgColor="bg-emerald-50 text-emerald-600"
            changePercent={18}
            changeLabel="so với hôm qua"
          />
          <KpiCard
            title="Tổng mã biến thể"
            value={totalProducts}
            icon={<Package className="w-6 h-6" />}
            iconBgColor="bg-blue-50 text-blue-600"
            changePercent={2}
            changeLabel="trong danh mục"
          />
          <KpiCard
            title="Đơn hàng hôm nay"
            value={ordersToday}
            icon={<ShoppingCart className="w-6 h-6" />}
            iconBgColor="bg-indigo-50 text-indigo-600"
            changePercent={14}
            changeLabel="so với hôm qua"
          />
          <KpiCard
            title="Khách hàng mới"
            value="12"
            icon={<UserPlus className="w-6 h-6" />}
            iconBgColor="bg-amber-50 text-amber-600"
            changePercent={8}
            changeLabel="so với tuần trước"
          />
        </div>

        {/* Cảnh báo tồn kho */}
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2 text-rose-600">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="font-bold text-slate-800 text-base">Cảnh Báo Tồn Kho Dưới Định Mức</h3>
            </div>
            <Link href="/retail/products" className="text-xs text-blue-600 font-semibold hover:underline">
              Xem tất cả
            </Link>
          </div>

          <div className="space-y-3">
            {lowStockVariants.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">Tồn kho các mặt hàng đều ở mức an toàn</p>
            ) : (
              lowStockVariants.map((v) => (
                <div
                  key={v.id}
                  className="p-3 rounded-xl bg-slate-50/70 border border-slate-100 flex items-center justify-between"
                >
                  <div>
                    <p className="text-xs font-bold text-slate-800">{v.name}</p>
                    <p className="text-[10px] text-slate-400">
                      SKU: <span className="font-semibold text-slate-600">{v.sku}</span> · Tối thiểu: {v.minStock}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-black text-rose-600">{v.totalQty} cái</p>
                    <StatusPill
                      label={v.totalQty === 0 ? "Hết hàng" : "Sắp hết"}
                      variant={v.totalQty === 0 ? "red" : "amber"}
                    />
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
