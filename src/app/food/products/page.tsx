import { prisma } from "@/lib/prisma";
import { getCurrentStore } from "@/lib/auth";
import { Header } from "@/components/layout/Header";
import { StatusPill } from "@/components/ui/common";
import { formatCurrency } from "@/lib/format";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

export default async function FoodProductsPage() {
  const store = await getCurrentStore("FOOD");

  const products = await prisma.product.findMany({
    where: { storeId: store.id, deletedAt: null },
    include: { category: true },
    orderBy: { createdAt: "desc" },
  });

  async function updateDiscountAction(formData: FormData) {
    "use server";
    const productId = formData.get("productId") as string;
    const discount = Number(formData.get("discount") || 0);

    await prisma.product.update({
      where: { id: productId },
      data: { discountPercent: discount },
    });
    revalidatePath("/food/products");
  }

  return (
    <div className="flex-1 flex flex-col">
      <Header
        title="Quản Lý Thực Đơn & Món Ăn"
        subtitle={`Quản lý món ăn, combo và giảm giá của ${store.name}`}
      />

      <main className="p-8 space-y-6">
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-blue-50/50 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100">
                <tr>
                  <th className="py-3 px-4">STT</th>
                  <th className="py-3 px-4">Tên Món Ăn</th>
                  <th className="py-3 px-4">Danh Mục</th>
                  <th className="py-3 px-4">Voucher (Giảm %)</th>
                  <th className="py-3 px-4">Giá Gốc</th>
                  <th className="py-3 px-4">Giá Sau Giảm</th>
                  <th className="py-3 px-4">Trạng Thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map((p, idx) => {
                  const finalPrice = Math.round(
                    Number(p.basePrice) * (1 - p.discountPercent / 100)
                  );

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-slate-400">{idx + 1}</td>
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-slate-800">{p.name}</span>
                        {p.isCombo && (
                          <span className="ml-2 px-2 py-0.5 rounded-full text-[9px] bg-red-50 text-red-600 font-bold border border-red-200">
                            Combo
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">{p.category?.name ?? "Chưa phân loại"}</td>
                      <td className="py-3.5 px-4">
                        <form action={updateDiscountAction}>
                          <input type="hidden" name="productId" value={p.id} />
                          <select
                            name="discount"
                            defaultValue={p.discountPercent}
                            // Form submit on change
                            className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold bg-white text-slate-700"
                          >
                            <option value={0}>Không giảm</option>
                            <option value={5}>Giảm 5%</option>
                            <option value={10}>Giảm 10%</option>
                            <option value={15}>Giảm 15%</option>
                            <option value={20}>Giảm 20%</option>
                          </select>
                        </form>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-400">
                        {p.discountPercent > 0 ? (
                          <span className="line-through">{formatCurrency(p.basePrice)}</span>
                        ) : (
                          formatCurrency(p.basePrice)
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-rose-600">
                        {formatCurrency(finalPrice)}
                      </td>
                      <td className="py-3.5 px-4">
                        <StatusPill
                          label={p.status === "ACTIVE" ? "Đang bán" : "Ngừng bán"}
                          variant={p.status === "ACTIVE" ? "green" : "gray"}
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
