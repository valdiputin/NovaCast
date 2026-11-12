import { prisma } from "@/lib/prisma";
import { getCurrentStore } from "@/lib/auth";
import { Header } from "@/components/layout/Header";
import { Card, CardTitle, KpiPill, PageBody, pctChange, IconTile } from "@/components/ui/kit";
import { Thumb } from "@/components/ui/Thumb";
import { FoodRevenueChart } from "@/components/charts/Charts";
import { RangeSelect } from "@/components/ui/RangeSelect";
import { dayRange, lastDays, bucketByDay } from "@/lib/stats";
import { formatCurrency } from "@/lib/format";
import { ShoppingCart, CircleDollarSign, Hourglass, CalendarDays, BarChart3, Trophy, PieChart, Users } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function FoodDashboard({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const store = await getCurrentStore("FOOD");
  const sp = await searchParams;
  const nDays = sp.days === "30" ? 30 : 7;
  const days = lastDays(nDays);

  const [today, yesterday, chartOrders, top] = await Promise.all([
    prisma.order.findMany({ where: { storeId: store.id, createdAt: dayRange(0) }, select: { status: true, totalAmount: true } }),
    prisma.order.findMany({ where: { storeId: store.id, createdAt: dayRange(1) }, select: { status: true, totalAmount: true } }),
    prisma.order.findMany({
      where: { storeId: store.id, createdAt: { gte: days[0].start }, status: { not: "CANCELLED" } },
      select: { createdAt: true, totalAmount: true },
    }),
    prisma.product.findMany({ where: { storeId: store.id, deletedAt: null }, orderBy: { soldCount: "desc" }, take: 5 }),
  ]);

  const sum = (rows: { status: string; totalAmount: bigint }[]) =>
    rows.filter((o) => o.status !== "CANCELLED").reduce((s, o) => s + Number(o.totalAmount), 0);
  const k = {
    orders: today.length,
    ordersY: yesterday.length,
    revenue: sum(today),
    revenueY: sum(yesterday),
    pending: today.filter((o) => o.status === "PENDING").length,
    pendingY: yesterday.filter((o) => o.status === "PENDING").length,
    cancelled: today.filter((o) => o.status === "CANCELLED"),
    cancelledY: yesterday.filter((o) => o.status === "CANCELLED").length,
  };
  const cancelledSum = k.cancelled.reduce((s, o) => s + Number(o.totalAmount), 0);
  const revenue = bucketByDay(days, chartOrders, (o) => o.createdAt, (o) => Number(o.totalAmount));
  const counts = bucketByDay(days, chartOrders, (o) => o.createdAt, () => 1);
  const chart = days.map((d, i) => ({ label: d.label, revenue: revenue[i], orders: counts[i] }));

  const stats = [
    { icon: <ShoppingCart className="w-8 h-8" fill="currentColor" />, tile: "bg-blue-50 text-[#1565F5]", value: String(k.orders), label: "Đơn hàng hôm nay", change: pctChange(k.orders, k.ordersY) ?? 0 },
    { icon: <CircleDollarSign className="w-8 h-8" />, tile: "bg-emerald-50 text-emerald-600", value: formatCurrency(k.revenue), label: "Doanh thu hôm nay", change: pctChange(k.revenue, k.revenueY) ?? 0 },
    { icon: <Hourglass className="w-8 h-8" />, tile: "bg-orange-50 text-orange-500", value: String(k.pending), label: "Đơn chờ xử lý", change: pctChange(k.pending, k.pendingY) ?? 0 },
    { icon: <CalendarDays className="w-8 h-8" />, tile: "bg-blue-50 text-[#1565F5]", value: String(k.cancelled.length), label: `Đơn hủy hôm nay (${formatCurrency(cancelledSum)})`, change: pctChange(k.cancelled.length, k.cancelledY) ?? 0 },
  ];

  return (
    <div className="flex-1 flex flex-col">
      <Header title="Tổng quan" />
      <PageBody>
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-5">
          {stats.map((s) => (
            <KpiPill key={s.label} icon={s.icon} tileClass={s.tile} value={s.value} label={s.label} change={s.change} />
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_440px] gap-5">
          <Card className="p-6">
            <CardTitle
              icon={<BarChart3 className="w-7 h-7 text-[#1565F5]" />}
              right={<RangeSelect param="days" value={String(nDays)} options={[{ value: "7", label: "7 ngày qua" }, { value: "30", label: "30 ngày qua" }]} />}
            >
              Doanh thu {nDays} ngày gần nhất
            </CardTitle>
            <FoodRevenueChart data={chart} />
          </Card>
          <Card className="p-6">
            <CardTitle icon={<Trophy className="w-7 h-7 text-amber-500" fill="currentColor" />}>Món bán chạy nhất</CardTitle>
            <ol className="space-y-3.5">
              {top.map((p, i) => (
                <li key={p.id} className="flex items-center gap-4">
                  <span className="w-9 h-9 rounded-full bg-rose-50 text-rose-500 font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                  <Thumb src={p.imageUrl} alt={p.name} size={52} />
                  <div className="min-w-0">
                    <div className="font-medium text-[#1E293B] truncate">{p.name}</div>
                    <div className="text-sm text-slate-500">{p.soldCount.toLocaleString("vi-VN")} đã bán</div>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <Card className="p-6">
          <CardTitle icon={<PieChart className="w-7 h-7 text-[#1565F5]" fill="currentColor" />}>Tổng quan</CardTitle>
          <div className="grid grid-cols-2 xl:grid-cols-4 divide-x divide-slate-200">
            {[
              { ...stats[0], icon: <ShoppingCart className="w-7 h-7" fill="currentColor" />, tile: "bg-blue-50 text-[#1565F5]" },
              { ...stats[1], icon: <CircleDollarSign className="w-7 h-7" />, tile: "bg-emerald-50 text-emerald-600" },
              { ...stats[2], icon: <Users className="w-7 h-7" fill="currentColor" />, tile: "bg-orange-50 text-orange-500" },
              { ...stats[3], icon: <CalendarDays className="w-7 h-7" />, tile: "bg-blue-50 text-[#1565F5]" },
            ].map((s) => (
              <div key={s.label} className="flex items-center gap-4 px-6 first:pl-2">
                <IconTile className={s.tile}>{s.icon}</IconTile>
                <div>
                  <div className="text-2xl font-bold text-[#1E293B]">{s.value}</div>
                  <div className="text-sm text-slate-500">{s.label}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </PageBody>
    </div>
  );
}
