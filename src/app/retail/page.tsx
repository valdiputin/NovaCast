import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentStore } from "@/lib/auth";
import { Header } from "@/components/layout/Header";
import { Card, CardTitle, Change, KpiStat, PageBody, Pill, pctChange, TH, TD, IconTile } from "@/components/ui/kit";
import { LinkTabs } from "@/components/ui/Tabs";
import { Thumb } from "@/components/ui/Thumb";
import { RetailComboChart, TopProductsChart } from "@/components/charts/Charts";
import { RangeSelect } from "@/components/ui/RangeSelect";
import { dayRange, lastDays, bucketByDay, daysAgoDate } from "@/lib/stats";
import { lowStockVariants, sellable } from "@/lib/retailStats";
import { stockState } from "@/lib/labels";
import { startOfVnDay } from "@/lib/date";
import {
  ShoppingBag, Box, ShoppingCart, Users, BarChart3, AlertTriangle, ArrowRight, ChevronRight, Undo2, Tag, CircleDollarSign, Clock3,
} from "lucide-react";

export const dynamic = "force-dynamic";
const money = (n: number) => `${n.toLocaleString("vi-VN")} ₫`;

export default async function RetailDashboard({ searchParams }: { searchParams: Promise<{ tab?: string; days?: string }> }) {
  const store = await getCurrentStore("RETAIL");
  const sp = await searchParams;
  const tab = sp.tab === "stock" ? "stock" : "sales";
  const tabs = (
    <LinkTabs
      active={tab}
      tabs={[
        { key: "sales", label: "Bán hàng", href: "/retail" },
        { key: "stock", label: "Tồn kho", href: "/retail?tab=stock" },
      ]}
    />
  );
  return (
    <div className="flex-1 flex flex-col">
      <Header title="Tổng quan" actions={tabs} />
      <PageBody>{tab === "sales" ? <SalesTab storeId={store.id} /> : <StockTab storeId={store.id} days={sp.days === "30" ? 30 : 7} />}</PageBody>
    </div>
  );
}

async function SalesTab({ storeId }: { storeId: string }) {
  const days = lastDays(7);
  const weekAgo = new Date(startOfVnDay().getTime() - 6 * 86_400_000);
  const [ordersToday, ordersY, chartOrders, variants, variantsOld, custToday, custY, pending, returnsToday, low, weekItems, moves7] = await Promise.all([
    prisma.order.findMany({ where: { storeId, createdAt: dayRange(0), status: { not: "CANCELLED" } }, select: { totalAmount: true } }),
    prisma.order.findMany({ where: { storeId, createdAt: dayRange(1), status: { not: "CANCELLED" } }, select: { totalAmount: true } }),
    prisma.order.findMany({ where: { storeId, createdAt: { gte: days[0].start }, status: { not: "CANCELLED" } }, select: { createdAt: true, totalAmount: true } }),
    prisma.productVariant.findMany({ where: { deletedAt: null, product: { storeId, deletedAt: null } }, select: { shelfQty: true, warehouseQty: true } }),
    prisma.productVariant.count({ where: { deletedAt: null, product: { storeId, deletedAt: null }, createdAt: { lt: weekAgo } } }),
    prisma.partner.count({ where: { storeId, type: "CUSTOMER", createdAt: dayRange(0) } }),
    prisma.partner.count({ where: { storeId, type: "CUSTOMER", createdAt: dayRange(1) } }),
    prisma.order.count({ where: { storeId, status: "PENDING" } }),
    prisma.returnSlip.count({ where: { storeId, kind: "CUSTOMER_RETURN", slipDate: dayRange(0), status: { not: "CANCELLED" } } }),
    lowStockVariants(storeId, 5),
    prisma.orderItem.groupBy({ by: ["productName"], where: { order: { storeId, createdAt: { gte: weekAgo }, status: { not: "CANCELLED" } } }, _sum: { quantity: true }, orderBy: { _sum: { quantity: "desc" } }, take: 1 }),
    prisma.stockMovement.aggregate({ where: { storeId, createdAt: { gte: weekAgo }, variantId: { not: null }, toLocation: { kind: { not: "DAMAGED" } } }, _sum: { quantityChange: true } }),
  ]);
  const sum = (r: { totalAmount: bigint }[]) => r.reduce((s, o) => s + Number(o.totalAmount), 0);
  const revenue = bucketByDay(days, chartOrders, (o) => o.createdAt, (o) => Number(o.totalAmount));
  const counts = bucketByDay(days, chartOrders, (o) => o.createdAt, () => 1);
  const stockNow = variants.reduce((s, v) => s + sellable(v), 0);
  const stockWeekAgo = stockNow - (moves7._sum.quantityChange ?? 0);

  return (
    <>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-5">
        <KpiStat icon={<ShoppingBag className="w-8 h-8" strokeWidth={2.2} />} tileClass="bg-blue-50 text-[#1565F5]" value={money(sum(ordersToday))} label="Doanh thu hôm nay" sub={<Change value={pctChange(sum(ordersToday), sum(ordersY))} />} />
        <KpiStat icon={<Box className="w-8 h-8" />} tileClass="bg-blue-50 text-[#1565F5]" value={variants.length.toLocaleString("vi-VN")} label="Tổng sản phẩm" sub={<Change value={pctChange(variants.length, variantsOld)} />} />
        <KpiStat icon={<ShoppingCart className="w-8 h-8" fill="currentColor" />} tileClass="bg-emerald-50 text-emerald-600" value={ordersToday.length.toLocaleString("vi-VN")} label="Đơn hàng hôm nay" sub={<Change value={pctChange(ordersToday.length, ordersY.length)} />} />
        <KpiStat icon={<Users className="w-8 h-8" fill="currentColor" />} tileClass="bg-blue-50 text-[#1565F5]" value={custToday} label="Khách hàng mới" sub={<Change value={pctChange(custToday, custY)} />} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_590px] gap-5">
        <Card className="p-6">
          <CardTitle icon={<BarChart3 className="w-7 h-7 text-[#1565F5]" />}>Doanh thu 7 ngày gần nhất</CardTitle>
          <RetailComboChart data={days.map((d, i) => ({ label: d.label, revenue: revenue[i], orders: counts[i] }))} />
        </Card>
        <Card className="p-6">
          <CardTitle
            icon={<AlertTriangle className="w-8 h-8 text-white" fill="#E5252A" />}
            right={
              <Link href="/retail/products?stock=low" className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-50 text-[#1565F5] text-sm font-semibold">
                Xem tất cả <ArrowRight className="w-4 h-4" />
              </Link>
            }
          >
            Cảnh báo tồn kho
          </CardTitle>
          <table className="w-full">
            <thead className="bg-[#F1F5FD]">
              <tr>
                <th className={TH + " rounded-l-xl"}>Sản phẩm</th>
                <th className={TH + " text-center"}>Tồn kho</th>
                <th className={TH + " text-center"}>Mức tối thiểu</th>
                <th className={TH + " text-center rounded-r-xl"}>Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[15px]">
              {low.rows.map(({ v, qty }) => {
                const s = stockState(qty, v.minStock);
                return (
                  <tr key={v.id}>
                    <td className={TD + " py-2.5"}>
                      <span className="flex items-center gap-3">
                        <Thumb src={v.product.imageUrl} alt={v.product.name} size={42} />
                        <span>
                          <span className="block font-medium text-[#1E293B]">{v.product.name}</span>
                          <span className="block text-sm text-slate-500">{v.name}</span>
                        </span>
                      </span>
                    </td>
                    <td className={TD + " text-center text-[17px]"}>{qty}</td>
                    <td className={TD + " text-center text-[17px]"}>{v.minStock}</td>
                    <td className={TD + " text-center"}><Pill label={s.label} tone={s.tone} /></td>
                  </tr>
                );
              })}
              {low.rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-400">Không có sản phẩm nào sắp hết</td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-5">
        <BottomCard icon={<Box className="w-8 h-8" />} tile="bg-blue-50 text-[#1565F5]" label="Tồn kho hiện tại" value={<>{stockNow.toLocaleString("vi-VN")} <span className="text-base font-medium">sản phẩm</span></>} extra={<Change value={pctChange(stockNow, stockWeekAgo)} />} />
        <BottomCard icon={<ShoppingCart className="w-8 h-8" fill="currentColor" />} tile="bg-purple-50 text-purple-600" label="Đơn hàng chờ xử lý" value={`${pending} đơn`} href="/retail/orders?status=PENDING" />
        <BottomCard icon={<Undo2 className="w-8 h-8" />} tile="bg-emerald-50 text-emerald-600" label="Trả hàng hôm nay" value={`${returnsToday} đơn`} href="/retail/returns" />
        <BottomCard icon={<Tag className="w-8 h-8" />} tile="bg-purple-50 text-purple-600" label="Sản phẩm bán chạy" value={<>{weekItems[0]?.productName ?? "—"} 🔥</>} href="/retail?tab=stock" />
      </div>
    </>
  );
}

function BottomCard({ icon, tile, label, value, extra, href }: { icon: React.ReactNode; tile: string; label: string; value: React.ReactNode; extra?: React.ReactNode; href?: string }) {
  const body = (
    <Card className="p-5 flex items-center gap-4 h-full hover:border-blue-200 transition">
      <IconTile className={tile}>{icon}</IconTile>
      <div className="flex-1 min-w-0">
        <div className="text-[15px] text-slate-600">{label}</div>
        <div className="text-[24px] font-bold text-[#1E293B] flex items-center gap-2 flex-wrap">
          {value} {extra}
        </div>
      </div>
      {href && <ChevronRight className="w-6 h-6 text-slate-500" />}
    </Card>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

async function StockTab({ storeId, days }: { storeId: string; days: number }) {
  const since = new Date(startOfVnDay().getTime() - (days - 1) * 86_400_000);
  const [ordersToday, ordersY, variants, low, top, recentSold] = await Promise.all([
    prisma.order.findMany({ where: { storeId, createdAt: dayRange(0), status: { not: "CANCELLED" } }, select: { subtotal: true } }),
    prisma.order.findMany({ where: { storeId, createdAt: dayRange(1), status: { not: "CANCELLED" } }, select: { subtotal: true } }),
    prisma.productVariant.findMany({ where: { deletedAt: null, product: { storeId, deletedAt: null } }, select: { id: true, shelfQty: true, warehouseQty: true, costPrice: true, product: { select: { createdAt: true } } } }),
    lowStockVariants(storeId, 5),
    prisma.orderItem.groupBy({ by: ["productName"], where: { order: { storeId, createdAt: { gte: since }, status: { not: "CANCELLED" } } }, _sum: { quantity: true }, orderBy: { _sum: { quantity: "desc" } }, take: 5 }),
    prisma.orderItem.findMany({ where: { order: { storeId, createdAt: { gte: daysAgoDate(30) } }, variantId: { not: null } }, distinct: ["variantId"], select: { variantId: true } }),
  ]);
  const sumSub = (r: { subtotal: bigint }[]) => r.reduce((s, o) => s + Number(o.subtotal), 0);
  const value = variants.reduce((s, v) => s + sellable(v) * Number(v.costPrice), 0);
  const sold = new Set(recentSold.map((r) => r.variantId));
  const monthAgo = daysAgoDate(30);
  const longStock = variants.filter((v) => sellable(v) > 0 && !sold.has(v.id) && v.product.createdAt < monthAgo).length;
  const imgs = await prisma.product.findMany({ where: { storeId, name: { in: top.map((t) => t.productName) } }, select: { name: true, imageUrl: true } });

  return (
    <>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-5">
        <KpiStat icon={<CircleDollarSign className="w-8 h-8" fill="currentColor" stroke="white" />} tileClass="bg-blue-50 text-[#1565F5]" value={money(sumSub(ordersToday))} label="Doanh thu / Giá trị xuất bán hôm nay" sub={<Change value={pctChange(sumSub(ordersToday), sumSub(ordersY))} />} />
        <KpiStat icon={<Box className="w-8 h-8" />} tileClass="bg-blue-50 text-[#1565F5]" value={money(value)} label="Tổng giá trị hàng tồn" />
        <KpiStat icon={<AlertTriangle className="w-8 h-8" fill="currentColor" stroke="white" />} tileClass="bg-amber-50 text-amber-500" value={low.count} label="Cảnh báo sắp hết hàng" sub={<span className="text-sm font-semibold text-rose-500">Cần nhập thêm hàng</span>} href="/retail/products?stock=low" />
        <KpiStat icon={<Clock3 className="w-8 h-8" />} tileClass="bg-purple-50 text-purple-600" value={longStock} label="Hàng tồn kho lâu (30–60 ngày)" sub={<span className="text-sm font-semibold text-amber-600">Không phát sinh bán 30 ngày</span>} />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_640px] gap-5">
        <Card className="p-6">
          <CardTitle
            icon={<BarChart3 className="w-7 h-7 text-[#1565F5]" />}
            right={<RangeSelect param="days" value={String(days)} options={[{ value: "7", label: "7 ngày gần nhất" }, { value: "30", label: "30 ngày gần nhất" }]} />}
          >
            Top 5 sản phẩm bán chạy nhất {days === 7 ? "tuần" : "30 ngày"}
          </CardTitle>
          <TopProductsChart data={top.map((t) => ({ name: t.productName, qty: t._sum.quantity ?? 0, img: imgs.find((i) => i.name === t.productName)?.imageUrl ?? "" }))} />
        </Card>
        <Card className="p-6">
          <CardTitle
            icon={<AlertTriangle className="w-8 h-8 text-white" fill="#E5252A" />}
            right={
              <Link href="/retail/products?stock=low" className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-50 text-[#1565F5] text-sm font-semibold">
                Xem tất cả <ArrowRight className="w-4 h-4" />
              </Link>
            }
          >
            Cảnh báo hàng sắp hết
          </CardTitle>
          <table className="w-full">
            <thead className="bg-[#F1F5FD]">
              <tr>
                <th className={TH + " rounded-l-xl"}>Mã hàng</th>
                <th className={TH}>Tên sản phẩm</th>
                <th className={TH + " text-center"}>Tồn kho</th>
                <th className={TH + " text-center"}>Mức tối thiểu</th>
                <th className={TH + " text-center rounded-r-xl"}>Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[15px]">
              {low.rows.map(({ v, qty }) => {
                const s = stockState(qty, v.minStock);
                return (
                  <tr key={v.id}>
                    <td className={TD}>
                      <span className="flex items-center gap-2.5 font-medium whitespace-nowrap">
                        <Thumb src={v.product.imageUrl} alt={v.product.name} size={40} />
                        {v.sku}
                      </span>
                    </td>
                    <td className={TD + " whitespace-nowrap"}>{v.product.name}</td>
                    <td className={TD + " text-center"}>{qty}</td>
                    <td className={TD + " text-center"}>{v.minStock}</td>
                    <td className={TD + " text-center"}><Pill label={s.label} tone={s.tone} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      </div>
    </>
  );
}
