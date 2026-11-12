import { getCurrentStore } from "@/lib/auth";
import { Header } from "@/components/layout/Header";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/format";

export default async function FoodVouchersPage() {
  const store = await getCurrentStore("FOOD");

  const vouchers = await prisma.voucher.findMany({
    where: { storeId: store.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex-1 flex flex-col">
      <Header
        title="Quản Lý Voucher Giảm Giá"
        subtitle={`Chương trình khuyến mãi và mã ưu đãi của ${store.name}`}
      />
      <main className="p-8 space-y-6">
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-blue-50/50 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100">
                <tr>
                  <th className="py-3 px-4">Mã Voucher</th>
                  <th className="py-3 px-4">Loại Giảm</th>
                  <th className="py-3 px-4">Giá Trị Giảm</th>
                  <th className="py-3 px-4">Đơn Tối Thiểu</th>
                  <th className="py-3 px-4">Đã Dùng</th>
                  <th className="py-3 px-4">Hạn Dùng</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {vouchers.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50/70">
                    <td className="py-3.5 px-4 font-mono font-bold text-rose-600">{v.code}</td>
                    <td className="py-3.5 px-4">{v.type === "PERCENT" ? "Phần trăm (%)" : "Tiền mặt"}</td>
                    <td className="py-3.5 px-4 font-bold text-slate-800">
                      {v.type === "PERCENT" ? `${v.discountValue}%` : formatCurrency(v.discountValue)}
                    </td>
                    <td className="py-3.5 px-4">{formatCurrency(v.minOrderValue)}</td>
                    <td className="py-3.5 px-4 font-semibold text-slate-700">
                      {v.usedCount} / {v.usageLimit}
                    </td>
                    <td className="py-3.5 px-4 text-slate-400">{formatDate(v.endDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
