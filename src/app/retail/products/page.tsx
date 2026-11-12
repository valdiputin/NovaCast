import { prisma } from "@/lib/prisma";
import { getCurrentStore } from "@/lib/auth";
import { Header } from "@/components/layout/Header";
import { StatusPill } from "@/components/ui/common";
import { formatCurrency } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function RetailProductsPage() {
  const store = await getCurrentStore("RETAIL");

  const products = await prisma.product.findMany({
    where: { storeId: store.id, deletedAt: null },
    include: { variants: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex-1 flex flex-col">
      <Header
        title="Quản Lý Sản Phẩm & Biến Thể"
        subtitle={`Danh mục sản phẩm, biến thể và tồn kho của ${store.name}`}
      />

      <main className="p-8 space-y-6">
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-blue-50/50 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100">
                <tr>
                  <th className="py-3 px-4">Tên Sản Phẩm / Biến Thể</th>
                  <th className="py-3 px-4">SKU / Mã Vạch</th>
                  <th className="py-3 px-4">Giá Vốn</th>
                  <th className="py-3 px-4">Giá Bán</th>
                  <th className="py-3 px-4 text-center">Tồn Kho (Tổng | Kệ | Kho)</th>
                  <th className="py-3 px-4">Trạng Thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map((prod) => (
                  <div key={prod.id} style={{ display: "contents" }}>
                    <tr className="bg-slate-50/70 font-semibold">
                      <td className="py-3 px-4 font-bold text-slate-900" colSpan={3}>
                        {prod.name} ({prod.variants.length} biến thể)
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-800">
                        {formatCurrency(prod.basePrice)}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-slate-900">
                        {prod.variants.reduce((acc, v) => acc + v.totalQty, 0)} cái
                      </td>
                      <td className="py-3 px-4">
                        <StatusPill label="Đang bán" variant="green" />
                      </td>
                    </tr>
                    {prod.variants.map((v) => (
                      <tr key={v.id} className="bg-white hover:bg-slate-50/50">
                        <td className="py-2.5 px-4 pl-8 text-slate-700">
                          ↳ {v.name}
                        </td>
                        <td className="py-2.5 px-4 font-mono font-medium text-slate-600">
                          {v.sku}
                        </td>
                        <td className="py-2.5 px-4">{formatCurrency(v.costPrice)}</td>
                        <td className="py-2.5 px-4 font-bold text-blue-600">
                          {formatCurrency(v.price)}
                        </td>
                        <td className="py-2.5 px-4 text-center font-semibold">
                          <span className="text-slate-900 font-bold">{v.totalQty}</span> |{" "}
                          <span className="text-emerald-600">{v.shelfQty}</span> |{" "}
                          <span className="text-amber-600">{v.warehouseQty}</span>
                        </td>
                        <td className="py-2.5 px-4">
                          <StatusPill
                            label={v.totalQty === 0 ? "Hết hàng" : "Còn hàng"}
                            variant={v.totalQty === 0 ? "red" : "green"}
                          />
                        </td>
                      </tr>
                    ))}
                  </div>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
