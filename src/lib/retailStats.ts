import { prisma } from "./prisma";

/** Tồn bán được của biến thể = Kệ + Kho (không tính vị trí Hàng lỗi) */
export const sellable = (v: { shelfQty: number; warehouseQty: number }) => v.shelfQty + v.warehouseQty;

/** Danh sách biến thể sắp hết / hết hàng, sắp theo tỉ lệ tồn / định mức (thấp nhất trước) */
export async function lowStockVariants(storeId: string, take = 5) {
  const variants = await prisma.productVariant.findMany({
    where: { deletedAt: null, product: { storeId, deletedAt: null, status: { not: "INACTIVE" } } },
    include: { product: true },
  });
  const low = variants
    .map((v) => ({ v, qty: sellable(v), ratio: v.minStock ? sellable(v) / v.minStock : 99 }))
    .filter((x) => x.qty <= x.v.minStock)
    .sort((a, b) => a.ratio - b.ratio || a.qty - b.qty);
  return { count: low.length, rows: low.slice(0, take) };
}
