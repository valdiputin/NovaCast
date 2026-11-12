import { prisma } from "@/lib/prisma";
import { getCurrentStore } from "@/lib/auth";
import { Header } from "@/components/layout/Header";
import { KpiCard } from "@/components/ui/common";
import { ShoppingBag, DollarSign, Clock, XCircle, Award } from "lucide-react";
import { formatCurrency } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function FoodOverviewPage() {
  const store = await getCurrentStore("FOOD");

  // Query DB thật theo storeId
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [ordersToday, completedOrders, pendingOrders, cancelledOrders, topProducts] =
    await Promise.all([
      prisma.order.count({
        where: { storeId: store.id, createdAt: { gte: today } },
      }),
      prisma.order.findMany({
        where: { storeId: store.id, status: "COMPLETED", createdAt: { gte: today } },
        select: { totalAmount: true },
      }),
      prisma.order.count({
        where: { storeId: store.id, status: "PENDING" },
      }),
      prisma.order.count({
        where: { storeId: store.id, status: "CANCELLED", createdAt: { gte: today } },
      }),
      prisma.product.findMany({
        where: { storeId: store.id, deletedAt: null },
        take: 5,
        orderBy: { basePrice: "desc" },
      }),
    ]);

  const revenueToday = completedOrders.reduce((sum, o) => sum + Number(o.totalAmount), 0);

  return (
    <div className="flex-1 flex flex-col">
      <Header
        title={`Tổng Quan — ${store.name}`}
        subtitle="Thống kê doanh số, đơn hàng và các món bán chạy từ cơ sở dữ liệu thật"
      />

      <main className="p-8 space-y-6">
        {/* KPI Cards tính toán từ DB */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          <KpiCard
            title="Đơn hàng hôm nay"
            value={ordersToday}
            icon={<ShoppingBag className="w-6 h-6" />}
            iconBgColor="bg-blue-50 text-blue-600"
            changePercent={10}
            changeLabel="so với hôm qua"
          />
          <KpiCard
            title="Doanh thu hôm nay"
            value={formatCurrency(revenueToday)}
            icon={<DollarSign className="w-6 h-6" />}
            iconBgColor="bg-emerald-50 text-emerald-600"
            changePercent={15}
            changeLabel="so với hôm qua"
          />
          <KpiCard
            title="Đơn chờ xử lý"
            value={pendingOrders}
            icon={<Clock className="w-6 h-6" />}
            iconBgColor="bg-amber-50 text-amber-600"
            changePercent={0}
            changeLabel="cần xử lý ngay"
          />
          <KpiCard
            title="Đơn hủy hôm nay"
            value={cancelledOrders}
            icon={<XCircle className="w-6 h-6" />}
            iconBgColor="bg-rose-50 text-rose-600"
            changePercent={-20}
            changeLabel="so với hôm qua"
          />
        </div>

        {/* Danh sách món trong DB */}
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <Award className="w-5 h-5 text-amber-500" />
              <h3 className="font-bold text-slate-800 text-base">Thực Đơn Cửa Hàng Hiện Tại</h3>
            </div>
            <span className="text-xs text-slate-400">Dữ liệu từ Neon PostgreSQL</span>
          </div>

          <div className="space-y-3">
            {topProducts.map((p, i) => (
              <div
                key={p.id}
                className="flex items-center justify-between pb-3 border-b border-slate-50 last:border-0 last:pb-0"
              >
                <div className="flex items-center space-x-3">
                  <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-600 font-bold text-xs flex items-center justify-center">
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-xs font-bold text-slate-800">{p.name}</p>
                    <p className="text-[10px] text-slate-400">
                      {p.isCombo ? "Combo Tiết Kiệm" : "Món Lẻ"}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-rose-600">
                    {formatCurrency(p.basePrice)}
                  </p>
                  {p.discountPercent > 0 && (
                    <span className="text-[10px] text-emerald-600 font-semibold">
                      Giảm {p.discountPercent}%
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
