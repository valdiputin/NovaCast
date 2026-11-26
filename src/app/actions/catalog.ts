"use server";

/** Danh mục, món ăn, sản phẩm bán lẻ, vật tư — thêm / sửa / xóa (lọc theo store hiện tại) */
import { prisma } from "@/lib/prisma";
import { requireStore, errorMessage, type ActionResult } from "@/lib/guard";
import { MaterialType, ProductStatus, Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const imageField = z
  .string()
  .trim()
  .max(500)
  .optional()
  .transform((v) => (v ? (v.startsWith("emoji:") || /^https?:\/\//.test(v) || v.startsWith("/") ? v : `emoji:${v}`) : undefined));

// =============================================================================
// ĐỒ ĂN — Danh mục
// =============================================================================
const categorySchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Vui lòng nhập tên danh mục").max(100),
  stockQty: z.number().int().min(0, "Số lượng phải ≥ 0"),
  minStock: z.number().int().min(0, "Định mức phải ≥ 0"),
});

export async function saveCategoryAction(input: z.input<typeof categorySchema>): Promise<ActionResult> {
  try {
    const parsed = categorySchema.safeParse(input);
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" };
    const store = await requireStore("FOOD", Role.STAFF);
    const { id, ...data } = parsed.data;
    const dup = await prisma.category.findFirst({ where: { storeId: store.id, name: data.name, deletedAt: null, NOT: id ? { id } : undefined } });
    if (dup) return { error: "Tên danh mục đã tồn tại" };
    if (id) {
      const res = await prisma.category.updateMany({ where: { id, storeId: store.id }, data });
      if (res.count === 0) return { error: "Không tìm thấy danh mục" };
    } else {
      // Danh mục cũ cùng tên đã xóa mềm → khôi phục thay vì tạo trùng (ràng buộc unique storeId + name)
      const old = await prisma.category.findFirst({ where: { storeId: store.id, name: data.name } });
      if (old) await prisma.category.update({ where: { id: old.id }, data: { ...data, deletedAt: null } });
      else {
        const count = await prisma.category.count({ where: { storeId: store.id } });
        await prisma.category.create({ data: { ...data, storeId: store.id, order: count + 1 } });
      }
    }
    revalidatePath("/food/categories");
    return { success: true };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

export async function deleteCategoryAction(id: string): Promise<ActionResult> {
  try {
    const store = await requireStore("FOOD", Role.MANAGER);
    const used = await prisma.product.count({ where: { categoryId: id, storeId: store.id, deletedAt: null } });
    if (used > 0) return { error: `Không thể xóa: danh mục còn ${used} món` };
    const res = await prisma.category.updateMany({ where: { id, storeId: store.id }, data: { deletedAt: new Date() } });
    if (res.count === 0) return { error: "Không tìm thấy danh mục" };
    revalidatePath("/food/categories");
    return { success: true };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

// =============================================================================
// ĐỒ ĂN — Món
// =============================================================================
const dishSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Vui lòng nhập tên món").max(200),
  categoryId: z.string().min(1, "Vui lòng chọn danh mục"),
  basePrice: z.number().int().positive("Giá phải lớn hơn 0"),
  isCombo: z.boolean().default(false),
  isFeatured: z.boolean().default(false),
  status: z.nativeEnum(ProductStatus).default(ProductStatus.ACTIVE),
  imageUrl: imageField,
});

export async function saveDishAction(input: z.input<typeof dishSchema>): Promise<ActionResult> {
  try {
    const parsed = dishSchema.safeParse(input);
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" };
    const store = await requireStore("FOOD", Role.STAFF);
    const { id, ...data } = parsed.data;
    if (!(await prisma.category.findFirst({ where: { id: data.categoryId, storeId: store.id, deletedAt: null } }))) return { error: "Danh mục không hợp lệ" };
    const payload = { ...data, basePrice: BigInt(data.basePrice) };
    if (id) {
      const res = await prisma.product.updateMany({ where: { id, storeId: store.id, deletedAt: null }, data: payload });
      if (res.count === 0) return { error: "Không tìm thấy món" };
    } else {
      await prisma.product.create({ data: { ...payload, storeId: store.id } });
    }
    revalidatePath("/food/products");
    revalidatePath("/food");
    return { success: true };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

/** Xóa mềm sản phẩm/món (bán lẻ: nếu đã có biến động kho thì chỉ chuyển "Ngừng bán") */
export async function deleteProductAction(id: string): Promise<ActionResult<{ deactivated: boolean }>> {
  try {
    const store = await requireStore(undefined, Role.MANAGER);
    const product = await prisma.product.findFirst({ where: { id, storeId: store.id, deletedAt: null } });
    if (!product) return { error: "Không tìm thấy sản phẩm" };
    const hasMoves = await prisma.stockMovement.count({ where: { storeId: store.id, variant: { productId: id } } });
    if (hasMoves > 0) {
      await prisma.product.update({ where: { id }, data: { status: ProductStatus.INACTIVE } });
    } else {
      await prisma.$transaction([
        prisma.product.update({ where: { id }, data: { deletedAt: new Date() } }),
        prisma.productVariant.updateMany({ where: { productId: id }, data: { deletedAt: new Date() } }),
      ]);
    }
    for (const p of ["/food/products", "/retail/products", "/retail/vouchers", "/retail"]) revalidatePath(p);
    return { success: true, deactivated: hasMoves > 0 };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

/** Đổi % giảm giá (voucher theo sản phẩm) — dùng chung đồ ăn & bán lẻ */
export async function setProductDiscountAction(productId: string, discountPercent: number): Promise<ActionResult> {
  try {
    if (![0, 5, 10, 15, 20].includes(discountPercent)) return { error: "Mức giảm giá không hợp lệ (0%, 5%, 10%, 15%, 20%)" };
    const store = await requireStore(undefined, Role.STAFF);
    const res = await prisma.product.updateMany({ where: { id: productId, storeId: store.id }, data: { discountPercent } });
    if (res.count === 0) return { error: "Không tìm thấy sản phẩm trong cửa hàng của bạn" };
    for (const p of ["/food/products", "/retail/products", "/retail/vouchers"]) revalidatePath(p);
    return { success: true };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

/** Đổi trạng thái bán: ACTIVE (tự tính theo tồn) / OUT_OF_STOCK (Hết hàng) / INACTIVE (Ngừng bán) */
export async function setProductStatusAction(productId: string, status: ProductStatus): Promise<ActionResult> {
  try {
    if (!Object.values(ProductStatus).includes(status)) return { error: "Trạng thái không hợp lệ" };
    const store = await requireStore(undefined, Role.STAFF);
    const res = await prisma.product.updateMany({ where: { id: productId, storeId: store.id }, data: { status } });
    if (res.count === 0) return { error: "Không tìm thấy sản phẩm" };
    for (const p of ["/food/products", "/retail/products", "/retail/vouchers"]) revalidatePath(p);
    return { success: true };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

// =============================================================================
// BÁN LẺ — Sản phẩm & biến thể
// =============================================================================
const retailProductSchema = z.object({
  id: z.string().optional(),
  code: z.string().trim().min(1, "Vui lòng nhập mã sản phẩm").max(30),
  name: z.string().trim().min(1, "Vui lòng nhập tên sản phẩm").max(200),
  description: z.string().trim().max(300).optional(),
  categoryId: z.string().optional(),
  costPrice: z.number().int().nonnegative("Giá vốn không hợp lệ"),
  price: z.number().int().positive("Giá bán phải lớn hơn 0"),
  discountPercent: z.number().int().refine((v) => [0, 5, 10, 15, 20].includes(v), "Mức giảm không hợp lệ").default(0),
  minStock: z.number().int().min(0).default(5), maxStock: z.number().int().min(0).default(100),
  colors: z.array(z.string().trim().min(1)).default([]),
  sizes: z.array(z.string().trim().min(1)).default([]),
  imageUrl: imageField,
});

function skuPart(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "D")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 3)
    .toUpperCase();
}

export async function saveRetailProductAction(input: z.input<typeof retailProductSchema>): Promise<ActionResult> {
  try {
    const parsed = retailProductSchema.safeParse(input);
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" };
    const store = await requireStore("RETAIL", Role.STAFF);
    const d = parsed.data;
    if (d.categoryId && !(await prisma.category.findFirst({ where: { id: d.categoryId, storeId: store.id } }))) return { error: "Loại hàng không hợp lệ" };
    const dupCode = await prisma.product.findFirst({ where: { storeId: store.id, code: d.code, deletedAt: null, NOT: d.id ? { id: d.id } : undefined } });
    if (dupCode) return { error: `Mã sản phẩm ${d.code} đã tồn tại` };

    const productData = {
      code: d.code, name: d.name, description: d.description, categoryId: d.categoryId || null, imageUrl: d.imageUrl,
      costPrice: BigInt(d.costPrice), basePrice: BigInt(d.price), discountPercent: d.discountPercent,
    };
    if (d.id) {
      const res = await prisma.product.updateMany({ where: { id: d.id, storeId: store.id, deletedAt: null }, data: productData });
      if (res.count === 0) return { error: "Không tìm thấy sản phẩm" };
      // Giá bán áp dụng cho mọi biến thể; giá vốn biến thể giữ theo bình quân nhập kho
      await prisma.productVariant.updateMany({ where: { productId: d.id }, data: { price: BigInt(d.price), minStock: d.minStock, maxStock: d.maxStock } });
    } else {
      // Sinh tổ hợp biến thể Màu × Size
      const colors = d.colors.length ? d.colors : [""];
      const sizes = d.sizes.length ? d.sizes : [""];
      const variants = colors.flatMap((c) =>
        sizes.map((s) => ({
          name: [c, s].filter(Boolean).join(" - ") || "Mặc định",
          sku: [d.code, skuPart(c), skuPart(s)].filter(Boolean).join("-"),
          color: c || null, size: s || null,
        }))
      );
      const skus = variants.map((v) => v.sku);
      if (new Set(skus).size !== skus.length) return { error: "Màu/size bị trùng sau khi tạo mã SKU" };
      const taken = await prisma.productVariant.findFirst({ where: { sku: { in: skus }, product: { storeId: store.id } } });
      if (taken) return { error: `SKU ${taken.sku} đã tồn tại` };
      await prisma.product.create({
        data: {
          ...productData, storeId: store.id,
          variants: {
            create: variants.map((v) => ({
              ...v, barcode: `893${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 1000).toString().padStart(3, "0")}`,
              costPrice: BigInt(d.costPrice), price: BigInt(d.price), minStock: d.minStock, maxStock: d.maxStock,
            })),
          },
        },
      });
    }
    for (const p of ["/retail/products", "/retail/vouchers", "/retail"]) revalidatePath(p);
    return { success: true };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

// =============================================================================
// KHO — Vật tư & thành phẩm
// =============================================================================
const materialSchema = z.object({
  id: z.string().optional(),
  sku: z.string().trim().min(1, "Vui lòng nhập mã SKU").max(30),
  name: z.string().trim().min(1, "Vui lòng nhập tên vật tư").max(200),
  type: z.nativeEnum(MaterialType),
  unit: z.string().trim().min(1, "Vui lòng nhập đơn vị tính").max(20),
  locationBin: z.string().trim().min(1, "Vui lòng chọn vị trí kệ").max(100),
  minStock: z.number().int().min(0), maxStock: z.number().int().min(0).default(200),
  costPrice: z.number().int().nonnegative(),
  imageUrl: imageField,
});

export async function saveMaterialAction(input: z.input<typeof materialSchema>): Promise<ActionResult> {
  try {
    const parsed = materialSchema.safeParse(input);
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" };
    const store = await requireStore("WAREHOUSE", Role.STAFF);
    const { id, costPrice, ...d } = parsed.data;
    const dup = await prisma.material.findFirst({ where: { storeId: store.id, sku: d.sku, NOT: id ? { id } : undefined } });
    if (dup) return { error: `Mã SKU ${d.sku} đã tồn tại` };
    // Vị trí kệ mới → tạo vị trí kho tương ứng
    const loc = await prisma.stockLocation.findFirst({ where: { storeId: store.id, name: d.locationBin } });
    if (!loc) await prisma.stockLocation.create({ data: { storeId: store.id, name: d.locationBin } });
    if (id) {
      const res = await prisma.material.updateMany({ where: { id, storeId: store.id }, data: d });
      if (res.count === 0) return { error: "Không tìm thấy vật tư" };
    } else {
      await prisma.material.create({ data: { ...d, costPrice: BigInt(costPrice), storeId: store.id, barcode: `893${Date.now().toString().slice(-9)}` } });
    }
    revalidatePath("/warehouse/items");
    revalidatePath("/warehouse");
    return { success: true };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

export interface HistoryRow {
  id: string;
  at: string;
  type: string;
  change: number;
  location: string;
  note: string;
}

/** Lịch sử biến động (sổ cái) của một vật tư hoặc biến thể */
export async function getStockHistoryAction(item: { materialId?: string; variantId?: string }): Promise<ActionResult<{ rows: HistoryRow[] }>> {
  try {
    const store = await requireStore(undefined, Role.STAFF);
    if (!item.materialId && !item.variantId) return { error: "Thiếu mặt hàng" };
    const moves = await prisma.stockMovement.findMany({
      where: { storeId: store.id, ...(item.materialId ? { materialId: item.materialId } : { variantId: item.variantId }) },
      include: { fromLocation: true, toLocation: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return {
      success: true,
      rows: moves.map((m) => ({
        id: m.id, at: m.createdAt.toISOString(), type: m.type, change: m.quantityChange,
        location: (m.toLocation ?? m.fromLocation)?.name ?? "", note: m.note ?? "",
      })),
    };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}
