import { getCurrentStore } from "@/lib/auth";
import { Header } from "@/components/layout/Header";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/format";
import { StatusPill } from "@/components/ui/common";

export const dynamic = "force-dynamic";

export default async function WarehouseIssuesPage() {
  const store = await getCurrentStore("WAREHOUSE");

  const issues = await prisma.stockIssue.findMany({
    where: { storeId: store.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex-1 flex flex-col">
      <Header
        title="Quản Lý Phiếu Xuất Kho"
        subtitle={`Theo dõi xuất NVL cho sản xuất và xuất thành phẩm tại ${store.name}`}
      />
      <main className="p-8 space-y-6">
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-blue-50/50 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100">
                <tr>
                  <th className="py-3 px-4">Mã Phiếu</th>
                  <th className="py-3 px-4">Loại Xuất</th>
                  <th className="py-3 px-4">Xưởng Nhận</th>
                  <th className="py-3 px-4">Ngày Xuất</th>
                  <th className="py-3 px-4">Trạng Thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {issues.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      Chưa có phiếu xuất kho nào
                    </td>
                  </tr>
                ) : (
                  issues.map((it) => (
                    <tr key={it.id} className="hover:bg-slate-50/70">
                      <td className="py-3.5 px-4 font-bold text-amber-600">{it.code}</td>
                      <td className="py-3.5 px-4 font-medium text-slate-700">{it.issueType}</td>
                      <td className="py-3.5 px-4">{it.workshop ?? "--"}</td>
                      <td className="py-3.5 px-4 text-slate-400">{formatDateTime(it.issueDate)}</td>
                      <td className="py-3.5 px-4">
                        <StatusPill
                          label={it.status === "APPROVED" ? "Đã duyệt" : "Lưu tạm"}
                          variant={it.status === "APPROVED" ? "green" : "amber"}
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
