import { prisma } from "@/lib/prisma";
import { getCurrentStore } from "@/lib/auth";
import { Header } from "@/components/layout/Header";
import { StatusPill } from "@/components/ui/common";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

export default async function FoodCategoriesPage() {
  const store = await getCurrentStore("FOOD");

  const categories = await prisma.category.findMany({
    where: { storeId: store.id, deletedAt: null },
    include: { _count: { select: { products: true } } },
    orderBy: { order: "asc" },
  });

  async function addCategoryAction(formData: FormData) {
    "use server";
    const name = formData.get("name") as string;
    if (!name?.trim()) return;

    await prisma.category.create({
      data: {
        storeId: store.id,
        name: name.trim(),
        order: categories.length + 1,
      },
    });
    revalidatePath("/food/categories");
  }

  return (
    <div className="flex-1 flex flex-col">
      <Header
        title="Quản Lý Danh Mục Món Ăn"
        subtitle={`Quản lý danh mục thực đơn của ${store.name}`}
      />

      <main className="p-8 space-y-6">
        {/* Form thêm danh mục thật */}
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
          <h3 className="font-bold text-slate-800 text-sm mb-3">Thêm Danh Mục Mới</h3>
          <form action={addCategoryAction} className="flex gap-3 max-w-md">
            <input
              type="text"
              name="name"
              placeholder="Nhập tên danh mục (VD: Cơm & Mì)"
              required
              className="flex-1 px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-red-500"
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-[#E5252A] hover:bg-red-700 text-white font-semibold text-xs transition-colors"
            >
              Thêm
            </button>
          </form>
        </div>

        {/* Danh sách categories từ DB */}
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-blue-50/50 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100">
                <tr>
                  <th className="py-3 px-4">STT</th>
                  <th className="py-3 px-4">Tên Danh Mục</th>
                  <th className="py-3 px-4">Thứ tự</th>
                  <th className="py-3 px-4">Số lượng món</th>
                  <th className="py-3 px-4">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {categories.map((cat, idx) => (
                  <tr key={cat.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-slate-400">{idx + 1}</td>
                    <td className="py-3.5 px-4 font-bold text-slate-800">{cat.name}</td>
                    <td className="py-3.5 px-4">{cat.order}</td>
                    <td className="py-3.5 px-4 font-semibold text-slate-700">
                      {cat._count.products} món
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusPill
                        label={cat._count.products > 0 ? "Còn hàng" : "Chưa có món"}
                        variant={cat._count.products > 0 ? "green" : "gray"}
                      />
                    </td>
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
