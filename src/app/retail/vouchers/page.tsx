import { prisma } from "@/lib/prisma";
import { getCurrentStore } from "@/lib/auth";
import { Header } from "@/components/layout/Header";
import { Card, PageBody, Pagination, withParams, TH, TD } from "@/components/ui/kit";
import { SearchBox, RangeSelect } from "@/components/ui/RangeSelect";
import { Thumb } from "@/components/ui/Thumb";
import { ActionButton } from "@/components/ui/ActionButton";
import { DiscountSelect } from "@/components/products/DiscountSelect";
import { StatusSelect } from "@/components/products/StatusSelect";
import { ProductEditor } from "../products/ProductEditor";
import { deleteProductAction } from "@/app/actions/catalog";
import { discounted, saleState } from "@/lib/labels";
import { formatCurrency } from "@/lib/format";
import { VoucherCodes } from "@/components/vouchers/VoucherListPage";
import { Trash2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function RetailVoucherPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string; size?: string }> }) {
  const store = await getCurrentStore("RETAIL");
  const sp = await searchParams;
  const size = [7, 10, 20].includes(Number(sp.size)) ? Number(sp.size) : 7;
  const page = Math.max(1, Number(sp.page) || 1);
  const where = { storeId: store.id, deletedAt: null, ...(sp.q ? { name: { contains: sp.q, mode: "insensitive" as const } } : {}) };
  const [products, total, categories] = await Promise.all([
    prisma.product.findMany({ where, include: { variants: { where: { deletedAt: null } } }, orderBy: { createdAt: "asc" }, skip: (page - 1) * size, take: size }),
    prisma.product.count({ where }),
    prisma.category.findMany({ where: { storeId: store.id, deletedAt: null }, orderBy: { order: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <div className="flex-1 flex flex-col">
      <Header title="Sản phẩm" variant="bell" />
      <PageBody>
        <Card className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
            <h2 className="text-[26px] font-bold text-[#0F1E4A]">Quản lý sản phẩm</h2>
            <div className="flex items-center gap-4">
              <SearchBox placeholder="Tìm kiếm sản phẩm..." value={sp.q} className="w-[340px] [&_input]:h-14 [&_input]:text-[17px]" />
              <ProductEditor categories={categories} />
            </div>
          </div>
          <table className="w-full">
            <thead className="bg-[#F1F5FD]">
              <tr>
                <th className={TH + " text-[17px] rounded-l-xl"}>Ảnh</th>
                <th className={TH + " text-[17px]"}>Tên sản phẩm</th>
                <th className={TH + " text-[17px] text-center"}>Voucher khuyến mãi</th>
                <th className={TH + " text-[17px] text-center"}>Giá gốc</th>
                <th className={TH + " text-[17px] text-center"}>Giá sau KM</th>
                <th className={TH + " text-[17px] text-center"}>Đã bán</th>
                <th className={TH + " text-[17px] text-center"}>Trạng thái</th>
                <th className={TH + " text-[17px] text-center rounded-r-xl"}>Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.map((p) => {
                const price = Number(p.basePrice);
                const qty = p.variants.reduce((s, v) => s + v.shelfQty + v.warehouseQty, 0);
                const min = p.variants.reduce((s, v) => s + v.minStock, 0);
                const st = saleState(p.status, qty, min);
                return (
                  <tr key={p.id}>
                    <td className={TD + " py-2.5"}><Thumb src={p.imageUrl} alt={p.name} size={68} /></td>
                    <td className={TD}>
                      <div className="text-[18px] font-medium text-[#0F1E4A]">{p.name}</div>
                      <div className="text-[15px] text-slate-500">{p.description}</div>
                    </td>
                    <td className={TD + " text-center"}><DiscountSelect productId={p.id} value={p.discountPercent} variant="pill" /></td>
                    <td className={TD + ` text-center text-[18px] ${p.discountPercent ? "line-through text-slate-500" : "text-[#1E293B]"}`}>{formatCurrency(price)}</td>
                    <td className={TD + " text-center text-[20px] font-bold text-[#1D4ED8]"}>{formatCurrency(discounted(price, p.discountPercent, false))}</td>
                    <td className={TD + " text-center text-[18px] text-[#1E293B]"}>{p.soldCount.toLocaleString("vi-VN")}</td>
                    <td className={TD + " text-center"}><StatusSelect productId={p.id} value={st.value} label={st.label} tone={st.tone} /></td>
                    <td className={TD}>
                      <div className="flex items-center justify-center gap-4">
                        <ProductEditor
                          categories={categories}
                          buttonClass="p-2 text-[#1565F5] hover:bg-blue-50 rounded-lg"
                          product={{ id: p.id, code: p.code ?? "", name: p.name, description: p.description ?? "", categoryId: p.categoryId ?? "", costPrice: Number(p.costPrice), price, discountPercent: p.discountPercent, imageUrl: p.imageUrl ?? "" }}
                        />
                        <ActionButton
                          action={deleteProductAction.bind(null, p.id)}
                          confirmText={`Xóa sản phẩm "${p.name}"?`}
                          successText="Đã xóa sản phẩm"
                          altSuccess={{ key: "deactivated", text: "Sản phẩm đã có giao dịch kho → chuyển sang Ngừng bán" }}
                          className="p-2 text-[#E5252A] hover:bg-rose-50 rounded-lg"
                          title="Xóa"
                        >
                          <Trash2 className="w-6 h-6" fill="currentColor" stroke="white" />
                        </ActionButton>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="flex items-center justify-between mt-4">
            <Pagination page={page} totalPages={Math.max(1, Math.ceil(total / size))} hrefFor={(n) => withParams("/retail/vouchers", { q: sp.q, size: sp.size }, { page: n })} />
            <div className="flex items-center gap-3 text-[17px] text-[#1E293B]">
              Hiển thị
              <RangeSelect param="size" value={String(size)} className="h-12" options={[7, 10, 20].map((n) => ({ value: String(n), label: `${n} / trang` }))} />
            </div>
          </div>
        </Card>
        <VoucherCodes storeId={store.id} />
      </PageBody>
    </div>
  );
}
