import { prisma } from "@/lib/prisma";
import { getCurrentStore } from "@/lib/auth";
import { Header } from "@/components/layout/Header";
import { Card, PageBody, Pill, TH, TD, THEAD, Pagination, withParams } from "@/components/ui/kit";
import { Thumb } from "@/components/ui/Thumb";
import { SearchBox } from "@/components/ui/RangeSelect";
import { ActionButton } from "@/components/ui/ActionButton";
import { DiscountSelect } from "@/components/products/DiscountSelect";
import { DishEditor } from "./DishEditor";
import { deleteProductAction } from "@/app/actions/catalog";
import { discounted } from "@/lib/labels";
import { formatCurrency } from "@/lib/format";
import { Star, Trash2 } from "lucide-react";
import { cn } from "@/components/ui/common";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 8;

export default async function FoodProductsPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const store = await getCurrentStore("FOOD");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const where = { storeId: store.id, deletedAt: null, ...(sp.q ? { name: { contains: sp.q, mode: "insensitive" as const } } : {}) };
  const [products, total, categories] = await Promise.all([
    prisma.product.findMany({ where, include: { category: true }, orderBy: { createdAt: "asc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    prisma.product.count({ where }),
    prisma.category.findMany({ where: { storeId: store.id, deletedAt: null }, orderBy: { order: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <div className="flex-1 flex flex-col">
      <Header title="Sản phẩm" />
      <PageBody>
        <Card className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
            <h2 className="text-[26px] font-bold text-[#1E293B]">Quản lý sản phẩm</h2>
            <div className="flex items-center gap-3">
              <SearchBox placeholder="Tìm sản phẩm..." value={sp.q} icon={false} className="w-80 [&_input]:h-14 [&_input]:text-[17px]" />
              <DishEditor categories={categories} />
            </div>
          </div>
          <div className="rounded-2xl overflow-visible">
            <table className="w-full">
              <thead className={THEAD}>
                <tr>
                  <th className={TH + " text-center w-16 rounded-l-xl"}>STT</th>
                  <th className={TH + " text-center w-20"}>Ảnh</th>
                  <th className={TH + " text-center"}>Tên</th>
                  <th className={TH + " text-center"}>Danh mục</th>
                  <th className={TH + " text-center"}>Voucher</th>
                  <th className={TH + " text-center"}>Giá gốc</th>
                  <th className={TH + " text-center"}>Giá sau giảm</th>
                  <th className={TH + " text-center"}>Trạng thái</th>
                  <th className={TH + " text-center rounded-r-xl"}>Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map((p, i) => {
                  const price = Number(p.basePrice);
                  const after = discounted(price, p.discountPercent);
                  return (
                    <tr key={p.id}>
                      <td className={TD + " text-center text-lg font-semibold"}>{(page - 1) * PAGE_SIZE + i + 1}</td>
                      <td className={TD + " text-center"}><Thumb src={p.imageUrl} alt={p.name} size={54} className="mx-auto" /></td>
                      <td className={TD + " font-bold text-[#1E293B] text-[16px] max-w-[290px]"}>
                        {p.name}
                        {p.isFeatured && <Star className="inline w-5 h-5 ml-1.5 text-amber-400 -mt-1" fill="currentColor" />}
                      </td>
                      <td className={TD + " text-center text-[16px]"}>{p.isCombo ? "Combo" : p.category?.name ?? "—"}</td>
                      <td className={TD + " text-center"}><DiscountSelect productId={p.id} value={p.discountPercent} /></td>
                      <td className={TD + " text-center text-[16px] text-slate-500 line-through"}>{formatCurrency(price)}</td>
                      <td className={cn(TD, "text-center text-[18px] font-bold", p.discountPercent > 0 ? "text-[#E5252A]" : "text-[#1E293B]")}>{formatCurrency(after)}</td>
                      <td className={TD + " text-center"}>
                        <Pill
                          mode="plain"
                          label={p.status === "INACTIVE" ? "Ngừng bán" : p.status === "OUT_OF_STOCK" ? "Hết hàng" : "Đang bán"}
                          tone={p.status === "INACTIVE" ? "gray" : p.status === "OUT_OF_STOCK" ? "red" : "green"}
                          className="px-4 py-1.5 text-[15px]"
                        />
                      </td>
                      <td className={TD + " text-center whitespace-nowrap"}>
                        <DishEditor
                          categories={categories}
                          dish={{ id: p.id, name: p.name, categoryId: p.categoryId ?? "", basePrice: price, isCombo: p.isCombo, isFeatured: p.isFeatured, status: p.status, imageUrl: p.imageUrl ?? "" }}
                        />
                        <ActionButton
                          action={deleteProductAction.bind(null, p.id)}
                          confirmText={`Xóa món "${p.name}"?`}
                          successText="Đã xóa món"
                          className="p-2 text-[#E5252A] hover:bg-rose-50 rounded-lg ml-2"
                          title="Xóa"
                        >
                          <Trash2 className="w-6 h-6" fill="currentColor" stroke="white" />
                        </ActionButton>
                      </td>
                    </tr>
                  );
                })}
                {products.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-10 text-center text-slate-400">Không có món nào</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {total > PAGE_SIZE && (
            <div className="flex justify-end mt-4">
              <Pagination page={page} totalPages={Math.ceil(total / PAGE_SIZE)} hrefFor={(p) => withParams("/food/products", { q: sp.q }, { page: p })} />
            </div>
          )}
        </Card>
      </PageBody>
    </div>
  );
}
