import { prisma } from "@/lib/prisma";
import { getCurrentStore } from "@/lib/auth";
import { Header } from "@/components/layout/Header";
import { Card, PageBody, Pagination, withParams } from "@/components/ui/kit";
import { SearchBox, RangeSelect } from "@/components/ui/RangeSelect";
import { ProductEditor } from "./ProductEditor";
import { ProductTable, type ProductRow } from "./ProductRows";
import { barcodeSvg } from "@/lib/barcode";
import { discounted, saleState, stockState } from "@/lib/labels";
import { sellable } from "@/lib/retailStats";
import { rangeFilter } from "@/lib/stats";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

type SP = { q?: string; cat?: string; range?: string; stock?: string; sort?: string; page?: string; size?: string };

export default async function RetailProductsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const store = await getCurrentStore("RETAIL");
  const sp = await searchParams;
  const size = [5, 10, 20, 50].includes(Number(sp.size)) ? Number(sp.size) : 10;
  const page = Math.max(1, Number(sp.page) || 1);
  const q = sp.q?.trim();
  const where: Prisma.ProductWhereInput = {
    storeId: store.id,
    deletedAt: null,
    ...(sp.cat ? { categoryId: sp.cat } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { code: { contains: q, mode: "insensitive" } },
            { variants: { some: { OR: [{ sku: { contains: q, mode: "insensitive" } }, { barcode: { contains: q } }] } } },
          ],
        }
      : {}),
  };
  const [all, categories] = await Promise.all([
    prisma.product.findMany({
      where,
      include: { variants: { where: { deletedAt: null }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] } },
      orderBy: sp.sort === "name" ? { name: "asc" } : sp.sort === "-name" ? { name: "desc" } : { createdAt: "asc" },
    }),
    prisma.category.findMany({ where: { storeId: store.id, deletedAt: null }, orderBy: { order: "asc" }, select: { id: true, name: true } }),
  ]);

  // "Đã bán" theo khoảng thời gian (mặc định: tổng tích lũy)
  const range = sp.range ?? "all";
  const soldInRange =
    range === "all"
      ? null
      : await prisma.orderItem.groupBy({
          by: ["variantId"],
          where: { order: { storeId: store.id, status: { not: "CANCELLED" }, createdAt: rangeFilter(range) }, variantId: { not: null } },
          _sum: { quantity: true },
        });
  const soldMap = new Map(soldInRange?.map((s) => [s.variantId, s._sum.quantity ?? 0]));

  let rows: ProductRow[] = all.map((p) => {
    const shelf = p.variants.reduce((s, v) => s + v.shelfQty, 0);
    const warehouse = p.variants.reduce((s, v) => s + v.warehouseQty, 0);
    const min = p.variants.reduce((s, v) => s + v.minStock, 0);
    const price = Number(p.basePrice);
    const first = p.variants[0];
    return {
      id: p.id,
      code: p.code ?? first?.sku ?? "",
      name: p.name,
      img: p.imageUrl,
      barcodeSvg: first?.barcode ? barcodeSvg(first.barcode, { height: 9 }) : "",
      variantSummary: p.variants.map((v) => v.name).join(", "),
      cost: Number(p.costPrice),
      price,
      afterDiscount: p.discountPercent ? discounted(price, p.discountPercent) : null,
      total: shelf + warehouse,
      shelf,
      warehouse,
      sold: soldInRange ? p.variants.reduce((s, v) => s + (soldMap.get(v.id) ?? 0), 0) : p.soldCount,
      status: saleState(p.status, shelf + warehouse, min),
      edit: { id: p.id, code: p.code ?? "", name: p.name, description: p.description ?? "", categoryId: p.categoryId ?? "", costPrice: Number(p.costPrice), price, discountPercent: p.discountPercent, imageUrl: p.imageUrl ?? "" },
      variants: p.variants.map((v) => ({
        id: v.id, sku: v.sku, name: v.name, barcode: v.barcode ?? "", shelf: v.shelfQty, warehouse: v.warehouseQty, min: v.minStock,
        cost: Number(v.costPrice), status: stockState(sellable(v), v.minStock),
      })),
    };
  });
  if (sp.stock === "low") rows = rows.filter((r) => r.variants.some((v) => v.shelf + v.warehouse <= v.min));
  const total = rows.length;
  const pageRows = rows.slice((page - 1) * size, page * size);
  const params = { q: sp.q, cat: sp.cat, range: sp.range, stock: sp.stock, sort: sp.sort, size: sp.size };

  return (
    <div className="flex-1 flex flex-col">
      <Header title="Sản phẩm & Biến thể" variant="bell" />
      <PageBody>
        <Card className="p-5">
          <div className="flex flex-wrap items-center gap-4 mb-5">
            <SearchBox placeholder="Tìm kiếm sản phẩm, mã SKU, mã vạch..." value={sp.q} className="flex-1 min-w-[320px] [&_input]:h-14 [&_input]:text-[17px]" />
            <RangeSelect param="range" value={range} icon className="h-14 min-w-[260px]" options={[{ value: "all", label: "Tất cả thời gian" }, { value: "7d", label: "7 ngày gần nhất" }, { value: "30d", label: "30 ngày gần nhất" }]} />
            <RangeSelect param="cat" value={sp.cat} placeholder="Tất cả loại hàng" className="h-14 min-w-[260px]" options={categories.map((c) => ({ value: c.id, label: c.name }))} />
            <ProductEditor categories={categories} />
          </div>
          {sp.stock === "low" && <div className="mb-3 text-sm font-semibold text-amber-600">Đang lọc: sản phẩm có biến thể sắp hết / hết hàng</div>}
          <ProductTable rows={pageRows} categories={categories} sortHref={withParams("/retail/products", params, { sort: sp.sort === "name" ? "-name" : "name", page: undefined })} />
          <div className="flex items-center justify-between mt-5">
            <Pagination page={page} totalPages={Math.max(1, Math.ceil(total / size))} hrefFor={(p) => withParams("/retail/products", params, { page: p })} />
            <div className="flex items-center gap-3 text-[17px] text-[#1E293B]">
              Hiển thị
              <RangeSelect param="size" value={String(size)} className="h-12" options={[5, 10, 20, 50].map((n) => ({ value: String(n), label: `${n} / trang` }))} />
            </div>
          </div>
        </Card>
      </PageBody>
    </div>
  );
}
