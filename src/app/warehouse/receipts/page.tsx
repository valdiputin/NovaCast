import { getCurrentStore } from "@/lib/auth";
import { Header } from "@/components/layout/Header";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { StatusPill } from "@/components/ui/common";

export const dynamic = "force-dynamic";

export default async function WarehouseReceiptsPage() {
  const store = await getCurrentStore("WAREHOUSE");

  const receipts = await prisma.stockReceipt.findMany({
    where: { storeId: store.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex-1 flex flex-col">
      <Header
        title="Quản Lý Phiếu Nhập Kho"
        subtitle={`Theo dõi các chứng từ nhập vật tư, thành phẩm tại ${store.name}`}
      />
      <main className="p-8 space-y-6">
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-blue-50/50 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100">
                <tr>
                  <th className="py-3 px-4">Mã Phiếu</th>
                  <th className="py-3 px-4">Ngày Nhập</th>
                  <th className="py-3 px-4">Ghi Chú</th>
                  <th className="py-3 px-4">Tổng Giá Trị</th>
                  <th className="py-3 px-4">Trạng Thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {receipts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      Chưa có phiếu nhập kho nào
                    </td>
                  </tr>
                ) : (
                  receipts.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/70">
                      <td className="py-3.5 px-4 font-bold text-blue-600">{r.code}</td>
                      <td className="py-3.5 px-4 text-slate-500">{formatDateTime(r.receiptDate)}</td>
                      <td className="py-3.5 px-4">{r.note ?? "--"}</td>
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        {formatCurrency(r.totalAmount)}
                      </td>
                      <td className="py-3.5 px-4">
                        <StatusPill
                          label={r.status === "APPROVED" ? "Đã duyệt" : "Lưu tạm"}
                          variant={r.status === "APPROVED" ? "green" : "amber"}
                        />
                      </td>
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
