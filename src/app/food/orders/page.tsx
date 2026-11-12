import { prisma } from "@/lib/prisma";
import { getCurrentStore } from "@/lib/auth";
import { Header } from "@/components/layout/Header";
import { Card, PageBody, TH, TD, Pagination, withParams } from "@/components/ui/kit";
import { SearchBox, RangeSelect } from "@/components/ui/RangeSelect";
import { OrderStatusSelect } from "@/components/orders/OrderStatusSelect";
import { OrderDetail } from "./OrderDetail";
import { rangeFilter } from "@/lib/stats";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { ORDER_STATUS } from "@/lib/labels";
import type { OrderStatus, Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 10;

export default async function FoodOrdersPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; range?: string; page?: string }> }) {
  const store = await getCurrentStore("FOOD");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const range = sp.range ?? "today";
  const where: Prisma.OrderWhereInput = {
    storeId: store.id,
    ...(rangeFilter(range) ? { createdAt: rangeFilter(range) } : {}),
    ...(sp.status && sp.status in ORDER_STATUS ? { status: sp.status as OrderStatus } : {}),
    ...(sp.q
      ? { OR: [{ code: { contains: sp.q, mode: "insensitive" } }, { customerName: { contains: sp.q, mode: "insensitive" } }, { customerPhone: { contains: sp.q } }] }
      : {}),
  };
  const [orders, total] = await Promise.all([
    prisma.order.findMany({ where, include: { items: true }, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    prisma.order.count({ where }),
  ]);
  const params = { q: sp.q, status: sp.status, range: sp.range };

  return (
    <div className="flex-1 flex flex-col">
      <Header title="Đơn hàng" />
      <PageBody>
        <Card className="p-6">
          <div className="flex flex-wrap gap-3 mb-5">
            <SearchBox placeholder="Tìm theo mã đơn, tên, SĐT..." value={sp.q} icon={false} className="w-[420px] [&_input]:h-14 [&_input]:text-[17px]" />
            <RangeSelect param="status" value={sp.status} placeholder="Tất cả trạng thái" options={Object.entries(ORDER_STATUS).map(([v, s]) => ({ value: v, label: s.label }))} className="h-14 w-56" />
            <RangeSelect param="range" value={range} options={[{ value: "today", label: "Hôm nay" }, { value: "7d", label: "7 ngày gần nhất" }, { value: "30d", label: "30 ngày gần nhất" }, { value: "all", label: "Tất cả" }]} className="h-14" />
          </div>
          <table className="w-full">
            <thead className="bg-[#F1F5FD]">
              <tr className="[&>th]:uppercase [&>th]:text-[14px] [&>th]:text-slate-500">
                <th className={TH + " rounded-l-xl"}>Mã đơn</th>
                <th className={TH}>Khách hàng</th>
                <th className={TH}>SĐT</th>
                <th className={TH + " text-right"}>Tổng tiền</th>
                <th className={TH}>Trạng thái</th>
                <th className={TH}>Thời gian</th>
                <th className={TH + " rounded-r-xl"} />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.map((o) => (
                <tr key={o.id}>
                  <td className={TD + " font-semibold text-[#E5252A] text-[17px] py-4"}>{o.code}</td>
                  <td className={TD + " text-[17px]"}>{o.customerName}</td>
                  <td className={TD + " text-[17px]"}>{o.customerPhone ?? "—"}</td>
                  <td className={TD + " text-right font-semibold text-[17px]"}>{formatCurrency(o.totalAmount)}</td>
                  <td className={TD}><OrderStatusSelect orderId={o.id} status={o.status} /></td>
                  <td className={TD + " text-slate-400 text-[16px]"}>{formatDateTime(o.createdAt)}</td>
                  <td className={TD + " text-right"}>
                    <OrderDetail
                      order={{
                        id: o.id, code: o.code, customerName: o.customerName, customerPhone: o.customerPhone, customerAddress: o.customerAddress,
                        note: o.note, paymentMethod: o.paymentMethod, status: o.status, subtotal: Number(o.subtotal), discountAmount: Number(o.discountAmount),
                        shippingFee: Number(o.shippingFee), totalAmount: Number(o.totalAmount), voucherCode: o.voucherCode,
                        items: o.items.map((i) => ({ name: i.productName, quantity: i.quantity, total: Number(i.totalPrice) })),
                      }}
                    />
                  </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400">Không có đơn hàng nào</td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="flex items-center justify-between mt-5">
            <span className="text-[17px] text-slate-500">{total} đơn hàng</span>
            {total > PAGE_SIZE && <Pagination page={page} totalPages={Math.ceil(total / PAGE_SIZE)} hrefFor={(p) => withParams("/food/orders", params, { page: p })} />}
          </div>
        </Card>
      </PageBody>
    </div>
  );
}
