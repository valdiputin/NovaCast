import { getCurrentStore } from "@/lib/auth";
import { Header } from "@/components/layout/Header";
import { prisma } from "@/lib/prisma";
import { Card, PageBody, TH, TD, Pagination, withParams } from "@/components/ui/kit";
import { SearchBox, RangeSelect } from "@/components/ui/RangeSelect";
import { OrderStatusSelect } from "@/components/orders/OrderStatusSelect";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { ORDER_STATUS, PAYMENT_LABEL } from "@/lib/labels";
import { RANGE_OPTIONS, rangeFilter } from "@/lib/stats";
import type { OrderStatus, Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 20;

export default async function RetailOrdersPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; range?: string; page?: string }> }) {
  const store = await getCurrentStore("RETAIL");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const range = sp.range ?? (sp.status ? "all" : "today");
  const where: Prisma.OrderWhereInput = {
    storeId: store.id,
    ...(rangeFilter(range) ? { createdAt: rangeFilter(range) } : {}),
    ...(sp.status && sp.status in ORDER_STATUS ? { status: sp.status as OrderStatus } : {}),
    ...(sp.q ? { OR: [{ code: { contains: sp.q, mode: "insensitive" } }, { customerName: { contains: sp.q, mode: "insensitive" } }] } : {}),
  };
  const [orders, total] = await Promise.all([
    prisma.order.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    prisma.order.count({ where }),
  ]);
  const params = { q: sp.q, status: sp.status, range: sp.range };

  return (
    <div className="flex-1 flex flex-col">
      <Header title="Đơn hàng" subtitle="Đơn bán tại quầy (POS) và đơn online" />
      <PageBody>
        <Card className="p-5">
          <div className="flex flex-wrap gap-3 mb-4">
            <SearchBox placeholder="Tìm theo mã đơn, tên khách..." value={sp.q} className="w-[380px] [&_input]:h-12" />
            <RangeSelect param="status" value={sp.status} placeholder="Tất cả trạng thái" options={Object.entries(ORDER_STATUS).map(([v, s]) => ({ value: v, label: s.label }))} />
            <RangeSelect param="range" value={range} icon options={[{ value: "today", label: "Hôm nay" }, ...RANGE_OPTIONS.filter((o) => o.value !== "today")]} />
          </div>
          <table className="w-full">
            <thead className="bg-[#F1F5FD]">
              <tr>
                <th className={TH + " rounded-l-xl"}>Mã đơn</th>
                <th className={TH}>Khách hàng</th>
                <th className={TH}>Kênh bán</th>
                <th className={TH}>Thanh toán</th>
                <th className={TH + " text-right"}>Tổng tiền</th>
                <th className={TH}>Trạng thái</th>
                <th className={TH + " rounded-r-xl"}>Thời gian</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[15px] text-[#1E293B]">
              {orders.map((o) => (
                <tr key={o.id}>
                  <td className={TD + " font-semibold text-[#1565F5]"}>{o.code}</td>
                  <td className={TD}>{o.customerName}</td>
                  <td className={TD}>{o.isPosOrder ? "Tại quầy (POS)" : "Online"}</td>
                  <td className={TD}>{PAYMENT_LABEL[o.paymentMethod]}</td>
                  <td className={TD + " text-right font-semibold"}>{formatCurrency(o.totalAmount)}</td>
                  <td className={TD}><OrderStatusSelect orderId={o.id} status={o.status} /></td>
                  <td className={TD + " text-slate-500"}>{formatDateTime(o.createdAt)}</td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400">Không có đơn hàng phù hợp</td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="flex items-center justify-between mt-4">
            <span className="text-slate-500">{total.toLocaleString("vi-VN")} đơn hàng</span>
            <Pagination page={page} totalPages={Math.max(1, Math.ceil(total / PAGE_SIZE))} hrefFor={(p) => withParams("/retail/orders", params, { page: p })} />
          </div>
        </Card>
      </PageBody>
    </div>
  );
}
