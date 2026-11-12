import { prisma } from "@/lib/prisma";
import { getCurrentStore } from "@/lib/auth";
import { Header } from "@/components/layout/Header";
import { formatDateTime, formatCurrency } from "@/lib/format";
import { StatusPill } from "@/components/ui/common";

export const dynamic = "force-dynamic";

export default async function FoodOrdersPage() {
  const store = await getCurrentStore("FOOD");

  const orders = await prisma.order.findMany({
    where: { storeId: store.id },
    include: { items: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex-1 flex flex-col">
      <Header
        title="Quản Lý Đơn Hàng"
        subtitle={`Danh sách đơn hàng của ${store.name}`}
      />

      <main className="p-8 space-y-6">
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-blue-50/50 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100">
                <tr>
                  <th className="py-3 px-4">Mã Đơn</th>
                  <th className="py-3 px-4">Khách Hàng</th>
                  <th className="py-3 px-4">SĐT</th>
                  <th className="py-3 px-4">Tổng Tiền</th>
                  <th className="py-3 px-4">Thanh Toán</th>
                  <th className="py-3 px-4">Trạng Thái</th>
                  <th className="py-3 px-4">Thời Gian</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      Chưa có đơn hàng nào
                    </td>
                  </tr>
                ) : (
                  orders.map((o) => (
                    <tr key={o.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-rose-600">{o.code}</td>
                      <td className="py-3.5 px-4 font-semibold text-slate-800">{o.customerName}</td>
                      <td className="py-3.5 px-4">{o.customerPhone ?? "--"}</td>
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        {formatCurrency(o.totalAmount)}
                      </td>
                      <td className="py-3.5 px-4">{o.paymentMethod}</td>
                      <td className="py-3.5 px-4">
                        <StatusPill
                          label={o.status}
                          variant={
                            o.status === "COMPLETED"
                              ? "green"
                              : o.status === "PENDING"
                              ? "amber"
                              : "red"
                          }
                        />
                      </td>
                      <td className="py-3.5 px-4 text-slate-400">{formatDateTime(o.createdAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
