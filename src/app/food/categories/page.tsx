import { prisma } from "@/lib/prisma";
import { getCurrentStore } from "@/lib/auth";
import { Header } from "@/components/layout/Header";
import { Card, PageBody, Pill, TH, TD, THEAD } from "@/components/ui/kit";
import { ActionButton } from "@/components/ui/ActionButton";
import { CategoryEditor } from "./CategoryEditor";
import { deleteCategoryAction } from "@/app/actions/catalog";
import { stockState } from "@/lib/labels";
import { Trash2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function FoodCategoriesPage() {
  const store = await getCurrentStore("FOOD");
  const categories = await prisma.category.findMany({ where: { storeId: store.id, deletedAt: null }, orderBy: { order: "asc" } });

  return (
    <div className="flex-1 flex flex-col">
      <Header title="Danh mục" />
      <PageBody>
        <Card className="p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-[26px] font-bold text-[#1E293B]">Quản lý danh mục</h2>
            <CategoryEditor />
          </div>
          <table className="w-full">
            <thead className={THEAD}>
              <tr>
                <th className={TH + " w-24 text-center rounded-l-xl"}>STT</th>
                <th className={TH}>Tên</th>
                <th className={TH + " text-center"}>Số lượng</th>
                <th className={TH + " text-center"}>Trạng thái</th>
                <th className={TH + " text-center rounded-r-xl"}>Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {categories.map((c, i) => {
                const s = stockState(c.stockQty, c.minStock, { ok: "Còn hàng", low: "Sắp hết hàng", out: "Đã hết hàng" });
                return (
                  <tr key={c.id}>
                    <td className={TD + " text-center text-lg font-semibold py-4"}>{i + 1}</td>
                    <td className={TD + " text-[18px] font-bold text-[#1E293B]"}>{c.name}</td>
                    <td className={TD + " text-center text-[18px] font-semibold"}>{c.stockQty}</td>
                    <td className={TD + " text-center"}>
                      <Pill mode="dot" label={s.label} tone={s.tone} className="px-4 py-1.5 text-[16px]" />
                    </td>
                    <td className={TD + " text-center whitespace-nowrap"}>
                      <CategoryEditor category={{ id: c.id, name: c.name, stockQty: c.stockQty, minStock: c.minStock }} />
                      <ActionButton
                        action={deleteCategoryAction.bind(null, c.id)}
                        confirmText={`Xóa danh mục "${c.name}"?`}
                        successText="Đã xóa danh mục"
                        className="p-2 text-[#E5252A] hover:bg-rose-50 rounded-lg ml-4"
                        title="Xóa"
                      >
                        <Trash2 className="w-6 h-6" fill="currentColor" stroke="white" />
                      </ActionButton>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      </PageBody>
    </div>
  );
}
