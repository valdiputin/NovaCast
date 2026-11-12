import { prisma } from "@/lib/prisma";
import { getCurrentStore } from "@/lib/auth";
import { Header } from "@/components/layout/Header";
import { StatusPill } from "@/components/ui/common";
import { formatCurrency } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function WarehouseItemsPage() {
  const store = await getCurrentStore("WAREHOUSE");

  const items = await prisma.material.findMany({
    where: { storeId: store.id, deletedAt: null },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex-1 flex flex-col">
      <Header
        title="Danh Mục Vật Tư & Thành Phẩm"
        subtitle={`Quản lý nguyên vật liệu, bán thành phẩm và thành phẩm tại ${store.name}`}
      />

      <main className="p-8 space-y-6">
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-blue-50/50 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100">
                <tr>
                  <th className="py-3 px-4">Mã SKU</th>
                  <th className="py-3 px-4">Tên Vật Tư / Thành Phẩm</th>
                  <th className="py-3 px-4">Phân Loại</th>
                  <th className="py-3 px-4">Đơn Vị</th>
                  <th className="py-3 px-4">Vị Trí Kệ (Bin)</th>
                  <th className="py-3 px-4 text-center">Tồn Kho (Tối thiểu)</th>
                  <th className="py-3 px-4">Giá Vốn</th>
                  <th className="py-3 px-4">Trạng Thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((mat) => {
                  const isLow = mat.totalQty <= mat.minStock;
                  return (
                    <tr key={mat.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">{mat.sku}</td>
                      <td className="py-3.5 px-4 font-bold text-slate-800">{mat.name}</td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-purple-50 text-purple-700 border-purple-200">
                          {mat.type}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-700">{mat.unit}</td>
                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-slate-800 bg-slate-100 px-2 py-1 rounded-md">
                          {mat.locationBin ?? "Chưa xếp kệ"}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="font-bold text-slate-900">{mat.totalQty}</span>
                        <span className="text-slate-400 mx-1">/</span>
                        <span className="text-slate-500">{mat.minStock}</span>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-700">
                        {formatCurrency(mat.costPrice)}
                      </td>
                      <td className="py-3.5 px-4">
                        <StatusPill
                          label={isLow ? "Sắp hết" : "Đủ hàng"}
                          variant={isLow ? "amber" : "green"}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
