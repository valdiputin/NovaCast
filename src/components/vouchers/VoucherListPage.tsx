import { Header } from "@/components/layout/Header";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/format";

/** Card "Mã giảm giá cho hóa đơn" (đặt dưới bảng voucher theo sản phẩm) */
export async function VoucherCodes({ storeId }: { storeId: string }) {
  const vouchers = await prisma.voucher.findMany({ where: { storeId }, orderBy: { createdAt: "desc" } });
  return (
    <section className="bg-white rounded-2xl border border-slate-100 p-6">
      <h2 className="text-xl font-bold text-[#0F1E4A] mb-4">Mã giảm giá cho hóa đơn</h2>
      {vouchers.length === 0 ? (
        <p className="text-slate-400">Chưa có mã giảm giá nào.</p>
      ) : (
        <div className="flex flex-wrap gap-3">
          {vouchers.map((v) => (
            <div key={v.id} className="px-4 py-3 rounded-xl border border-dashed border-blue-300 bg-blue-50/50">
              <div className="font-mono font-bold text-[#1565F5]">{v.code}</div>
              <div className="text-sm text-slate-600">
                {v.type === "PERCENT" ? `Giảm ${v.discountValue}%` : `Giảm ${formatCurrency(v.discountValue)}`} · HSD {formatDate(v.endDate)} · {v.usedCount}/{v.usageLimit} lượt
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/** Trang danh sách voucher dùng chung cho cửa hàng đồ ăn và bán lẻ (Server Component) */
export async function VoucherListPage({ store }: { store: { id: string; name: string } }) {
  const vouchers = await prisma.voucher.findMany({
    where: { storeId: store.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex-1 flex flex-col">
      <Header
        title="Quản lý Voucher giảm giá"
        subtitle={`Chương trình khuyến mãi và mã ưu đãi của ${store.name}`}
      />
      <main className="p-8 space-y-6">
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-blue-50/50 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100">
                <tr>
                  <th className="py-3 px-4">Mã Voucher</th>
                  <th className="py-3 px-4">Loại giảm</th>
                  <th className="py-3 px-4">Giá trị giảm</th>
                  <th className="py-3 px-4">Đơn tối thiểu</th>
                  <th className="py-3 px-4">Đã dùng</th>
                  <th className="py-3 px-4">Hạn dùng</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {vouchers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      Chưa có voucher nào
                    </td>
                  </tr>
                ) : (
                  vouchers.map((v) => (
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
