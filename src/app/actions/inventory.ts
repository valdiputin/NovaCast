"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentStore } from "@/lib/auth";
import { InventoryService } from "@/lib/inventoryService";
import { vnDateKey } from "@/lib/date";
import { LocationKind, MovementType, OrderStatus, Prisma, Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

type ActionResult<T = object> = ({ success: true } & T) | { error: string };

/**
 * Helper kiểm tra quyền tối thiểu và trả về store hiện tại
 */
async function requireStore(requiredType?: "FOOD" | "RETAIL" | "WAREHOUSE", minRole?: Role) {
  const store = await getCurrentStore(requiredType);
  if (minRole) {
    const roleHierarchy: Record<Role, number> = {
      OWNER: 3,
      MANAGER: 2,
      STAFF: 1,
    };
    if (roleHierarchy[store.currentRole] < roleHierarchy[minRole]) {
      throw new Error(`Bạn không có quyền thực hiện thao tác này (yêu cầu tối thiểu ${minRole})`);
    }
  }
  return store;
}

function errorMessage(e: unknown, fallback: string) {
  return e instanceof Error ? e.message : fallback;
}

/**
 * Sinh mã chứng từ tăng dần theo ngày (giờ Việt Nam): PREFIX-YYYYMMDD-NN
 */
async function nextDocCode(
  tx: Prisma.TransactionClient,
  table: "stockReceipt" | "stockAudit",
  storeId: string,
  prefix: string
) {
  const base = `${prefix}-${vnDateKey()}-`;
  const where = { storeId, code: { startsWith: base } };
  const count =
    table === "stockReceipt"
      ? await tx.stockReceipt.count({ where })
      : await tx.stockAudit.count({ where });
  return `${base}${String(count + 1).padStart(2, "0")}`;
}

/**
 * 1. Cập nhật mức giảm giá món ăn (Food) có kiểm tra storeId
 */
const updateDiscountSchema = z.object({
  productId: z.string().min(1),
  discountPercent: z.union([
    z.literal(0),
    z.literal(5),
    z.literal(10),
    z.literal(15),
    z.literal(20),
  ]),
});

export async function updateProductDiscountAction(
  productId: string,
  discountPercent: number
): Promise<ActionResult> {
  try {
    const store = await requireStore("FOOD", Role.STAFF);
    const parsed = updateDiscountSchema.safeParse({ productId, discountPercent });
    if (!parsed.success) {
      return { error: "Mức giảm giá không hợp lệ (chỉ chấp nhận 0%, 5%, 10%, 15%, 20%)" };
    }

    const updated = await prisma.product.updateMany({
      where: { id: parsed.data.productId, storeId: store.id },
      data: { discountPercent: parsed.data.discountPercent },
    });

    if (updated.count === 0) {
      return { error: "Không tìm thấy sản phẩm trong cửa hàng của bạn" };
    }

    revalidatePath("/food/products");
    return { success: true };
  } catch (e: unknown) {
    return { error: errorMessage(e, "Đã xảy ra lỗi") };
  }
}

/**
 * 2. Cập nhật trạng thái đơn hàng (Food / Retail)
 */
const updateOrderStatusSchema = z.object({
  orderId: z.string().min(1),
  newStatus: z.nativeEnum(OrderStatus),
});

export async function updateOrderStatusAction(
  orderId: string,
  newStatus: OrderStatus
): Promise<ActionResult> {
  try {
    const store = await requireStore(undefined, Role.STAFF);
    const parsed = updateOrderStatusSchema.safeParse({ orderId, newStatus });
    if (!parsed.success) return { error: "Trạng thái không hợp lệ" };

    const order = await prisma.order.findFirst({
      where: { id: parsed.data.orderId, storeId: store.id },
    });

    if (!order) return { error: "Không tìm thấy đơn hàng" };

    const validFlow: Record<OrderStatus, OrderStatus[]> = {
      PENDING: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
      CONFIRMED: [OrderStatus.SHIPPING, OrderStatus.CANCELLED],
      SHIPPING: [OrderStatus.COMPLETED, OrderStatus.CANCELLED],
      COMPLETED: [],
      CANCELLED: [],
    };

    if (!validFlow[order.status].includes(parsed.data.newStatus)) {
      return { error: `Không thể chuyển trạng thái từ ${order.status} sang ${parsed.data.newStatus}` };
    }

    // Cập nhật có điều kiện trạng thái cũ để tránh 2 người đổi cùng lúc
    const res = await prisma.order.updateMany({
      where: { id: order.id, storeId: store.id, status: order.status },
      data: { status: parsed.data.newStatus },
    });
    if (res.count === 0) return { error: "Đơn hàng vừa được người khác cập nhật, vui lòng tải lại" };

    revalidatePath("/food/orders");
    revalidatePath("/retail/orders");
    return { success: true };
  } catch (e: unknown) {
    return { error: errorMessage(e, "Đã xảy ra lỗi") };
  }
}

/**
 * 3. Hoàn thành nhập kho bán lẻ (Retail Receiving)
 */
const receiveSchema = z.object({
  supplierName: z.string().min(1),
  note: z.string().optional(),
  items: z.array(
    z.object({
      variantId: z.string().min(1),
      quantity: z.number().int().positive(),
      costPrice: z.number().int().nonnegative(),
      discountRate: z.number().min(0).max(100),
    })
  ).min(1),
});

export async function completeRetailReceivingAction(
  input: z.infer<typeof receiveSchema>
): Promise<ActionResult<{ code: string }>> {
  try {
    const store = await requireStore("RETAIL", Role.MANAGER);
    const parsed = receiveSchema.safeParse(input);
    if (!parsed.success) return { error: "Dữ liệu phiếu nhập không hợp lệ" };

    const loc = await prisma.stockLocation.findFirst({
      where: { storeId: store.id, kind: LocationKind.WAREHOUSE },
      orderBy: { isDefault: "desc" },
    });
    if (!loc) return { error: "Cửa hàng chưa có vị trí kho để nhập hàng" };

    const variantIds = [...new Set(parsed.data.items.map((i) => i.variantId))];
    const existingCount = await prisma.productVariant.count({
      where: { id: { in: variantIds }, product: { storeId: store.id } },
    });
    if (existingCount !== variantIds.length) {
      return { error: "Có sản phẩm không thuộc quyền quản lý của cửa hàng" };
    }

    const lineTotal = (it: { quantity: number; costPrice: number; discountRate: number }) =>
      Math.round(it.quantity * it.costPrice * (1 - it.discountRate / 100));
    const totalAmount = parsed.data.items.reduce((acc, it) => acc + lineTotal(it), 0);

    const code = await prisma.$transaction(async (tx) => {
      const receiptCode = await nextDocCode(tx, "stockReceipt", store.id, "PNH");
      const receipt = await tx.stockReceipt.create({
        data: {
          code: receiptCode,
          storeId: store.id,
          note: parsed.data.note,
          status: "APPROVED",
          totalAmount: BigInt(totalAmount),
        },
      });

      for (const item of parsed.data.items) {
        await tx.stockReceiptItem.create({
          data: {
            receiptId: receipt.id,
            variantId: item.variantId,
            quantity: item.quantity,
            unitCost: BigInt(item.costPrice),
            discountRate: item.discountRate,
            totalAmount: BigInt(lineTotal(item)),
          },
        });

        await InventoryService.recordReceipt(tx, {
          storeId: store.id,
          variantId: item.variantId,
          locationId: loc.id,
          quantity: item.quantity,
          unitCost: BigInt(item.costPrice),
          refType: "RECEIPT",
          refId: receipt.id,
          note: `Nhập hàng từ ${parsed.data.supplierName}`,
        });
      }
      return receiptCode;
    });

    revalidatePath("/retail/receiving");
    revalidatePath("/retail/products");
    revalidatePath("/retail");
    return { success: true, code };
  } catch (e: unknown) {
    return { error: errorMessage(e, "Đã xảy ra lỗi") };
  }
}

/**
 * 4. Thanh toán đơn hàng POS bán lẻ tại quầy (giá đọc từ DB, không tin client)
 */
const posCheckoutSchema = z.object({
  items: z.array(
    z.object({
      variantId: z.string().min(1),
      quantity: z.number().int().positive(),
    })
  ).min(1),
  paymentMethod: z.enum(["CASH", "BANK_TRANSFER", "E_WALLET"]).default("CASH"),
});

export async function checkoutPosAction(
  input: z.infer<typeof posCheckoutSchema>
): Promise<ActionResult<{ orderCode: string }>> {
  try {
    const store = await requireStore("RETAIL", Role.STAFF);
    const parsed = posCheckoutSchema.safeParse(input);
    if (!parsed.success) return { error: "Giỏ hàng rỗng hoặc không hợp lệ" };

    const shelfLoc = await prisma.stockLocation.findFirst({
      where: { storeId: store.id, kind: LocationKind.SHELF },
      orderBy: { isDefault: "desc" },
    });
    if (!shelfLoc) return { error: "Không tìm thấy vị trí Kệ bán hàng của cửa hàng" };

    // Gộp các dòng trùng biến thể
    const qtyByVariant = new Map<string, number>();
    for (const it of parsed.data.items) {
      qtyByVariant.set(it.variantId, (qtyByVariant.get(it.variantId) ?? 0) + it.quantity);
    }
    const variantIds = [...qtyByVariant.keys()];
    const dbVariants = await prisma.productVariant.findMany({
      where: { id: { in: variantIds }, deletedAt: null, product: { storeId: store.id } },
      include: { product: true },
    });

    if (dbVariants.length !== variantIds.length) {
      return { error: "Có mặt hàng không tồn tại hoặc không thuộc cửa hàng này" };
    }

    let totalSubtotal = 0;
    const validatedItems = dbVariants.map((v) => {
      const quantity = qtyByVariant.get(v.id)!;
      // Giá bán sau giảm (%) theo dữ liệu DB, làm tròn đến 100đ
      const discount = v.discountPercent || v.product.discountPercent || 0;
      const unitPrice = Math.round((Number(v.price) * (100 - discount)) / 100 / 100) * 100;
      const lineTotal = unitPrice * quantity;
      totalSubtotal += lineTotal;
      return {
        variantId: v.id,
        name: `${v.product.name} - ${v.name}`,
        quantity,
        unitPrice: BigInt(unitPrice),
        totalPrice: BigInt(lineTotal),
      };
    });

    const orderCode = `DH-POS-${vnDateKey()}-${Date.now().toString(36).toUpperCase()}`;

    await prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          code: orderCode,
          storeId: store.id,
          customerName: "Khách lẻ mua tại quầy",
          paymentMethod: parsed.data.paymentMethod,
          status: OrderStatus.COMPLETED,
          isPosOrder: true,
          subtotal: BigInt(totalSubtotal),
          totalAmount: BigInt(totalSubtotal),
        },
      });

      for (const it of validatedItems) {
        await tx.orderItem.create({
          data: {
            orderId: order.id,
            variantId: it.variantId,
            productName: it.name,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            totalPrice: it.totalPrice,
          },
        });

        await InventoryService.recordIssue(tx, {
          storeId: store.id,
          variantId: it.variantId,
          locationId: shelfLoc.id,
          quantity: it.quantity,
          type: MovementType.SALE,
          refType: "POS",
          refId: order.id,
          note: `Bán POS đơn hàng ${orderCode}`,
        });
      }
    });

    revalidatePath("/retail/pos");
    revalidatePath("/retail/orders");
    revalidatePath("/retail/products");
    revalidatePath("/retail");
    return { success: true, orderCode };
  } catch (e: unknown) {
    return { error: errorMessage(e, "Lỗi xử lý đơn hàng POS") };
  }
}

/**
 * 5. Kiểm kê & cân bằng kho (Retail & Warehouse)
 * - Client chỉ gửi stockLevelId + số đếm thực tế; tồn hệ thống đọc lại từ DB trong transaction.
 * - Mỗi lần cân bằng tạo một phiếu PKK (StockAudit) đã duyệt để lưu lịch sử.
 */
const auditSchema = z.object({
  counts: z
    .array(
      z.object({
        stockLevelId: z.string().min(1),
        actualQty: z.number().int().min(0),
        reason: z.string().max(500).optional(),
      })
    )
    .min(1),
  note: z.string().max(500).optional(),
});

export async function balanceStockAuditAction(
  input: z.infer<typeof auditSchema>
): Promise<ActionResult<{ code: string; adjusted: number }>> {
  try {
    const store = await requireStore(undefined, Role.MANAGER);
    const parsed = auditSchema.safeParse(input);
    if (!parsed.success) return { error: "Số liệu kiểm kê không hợp lệ (số lượng phải là số nguyên ≥ 0)" };

    const ids = [...new Set(parsed.data.counts.map((c) => c.stockLevelId))];
    if (ids.length !== parsed.data.counts.length) return { error: "Một vị trí bị nhập trùng trong phiếu kiểm kê" };

    const result = await prisma.$transaction(async (tx) => {
      const levels = await tx.stockLevel.findMany({
        where: { id: { in: ids }, storeId: store.id },
        include: {
          variant: { select: { costPrice: true } },
          material: { select: { costPrice: true } },
        },
      });
      if (levels.length !== ids.length) {
        throw new Error("Có dòng kiểm kê không thuộc cửa hàng của bạn");
      }
      const levelById = new Map(levels.map((l) => [l.id, l]));

      for (const c of parsed.data.counts) {
        const l = levelById.get(c.stockLevelId)!;
        if (c.actualQty !== l.quantity && !c.reason?.trim()) {
          throw new Error("Vui lòng nhập lý do cho các dòng có chênh lệch");
        }
      }

      const code = await nextDocCode(tx, "stockAudit", store.id, "PKK");
      let totalVarianceValue = BigInt(0);
      const items = parsed.data.counts.map((c) => {
        const l = levelById.get(c.stockLevelId)!;
        const variance = c.actualQty - l.quantity;
        const cost = l.variant?.costPrice ?? l.material?.costPrice ?? BigInt(0);
        const varianceValue = BigInt(variance) * BigInt(cost);
        totalVarianceValue += varianceValue;
        return {
          variantId: l.variantId,
          materialId: l.materialId,
          locationId: l.locationId,
          systemQty: l.quantity,
          actualQty: c.actualQty,
          variance,
          varianceValue,
          reason: c.reason?.trim() || null,
        };
      });

      const audit = await tx.stockAudit.create({
        data: {
          code,
          storeId: store.id,
          note: parsed.data.note,
          status: "APPROVED",
          totalVarianceValue,
          items: { create: items },
        },
      });

      let adjusted = 0;
      for (const it of items) {
        if (it.variance === 0) continue;
        await InventoryService.recordAdjustment(tx, {
          storeId: store.id,
          variantId: it.variantId ?? undefined,
          materialId: it.materialId ?? undefined,
          locationId: it.locationId,
          delta: it.variance,
          refId: audit.id,
          reason: it.reason ?? "Cân bằng kiểm kê",
        });
        adjusted++;
      }
      return { code, adjusted };
    });

    revalidatePath("/retail/audit");
    revalidatePath("/warehouse/audit");
    revalidatePath("/retail/products");
    revalidatePath("/warehouse/items");
    revalidatePath("/retail");
    revalidatePath("/warehouse");
    return { success: true, ...result };
  } catch (e: unknown) {
    return { error: errorMessage(e, "Lỗi cân bằng kho") };
  }
}

/**
 * 6. Khách trả hàng (hoàn kho). Hàng nguyên vẹn → Kệ; hàng lỗi → vị trí "Hàng lỗi" (không bán được)
 */
const customerReturnSchema = z.object({
  customerName: z.string().trim().min(1, "Vui lòng nhập tên khách hàng"),
  orderCode: z.string().trim().max(100).optional(),
  condition: z.enum(["GOOD", "DAMAGED"]),
  note: z.string().max(500).optional(),
  items: z
    .array(z.object({ variantId: z.string().min(1), quantity: z.number().int().positive() }))
    .min(1),
});

export async function customerReturnAction(
  input: z.infer<typeof customerReturnSchema>
): Promise<ActionResult> {
  try {
    const store = await requireStore("RETAIL", Role.STAFF);
    const parsed = customerReturnSchema.safeParse(input);
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dữ liệu trả hàng không hợp lệ" };
    const { customerName, orderCode, condition, note, items } = parsed.data;

    await prisma.$transaction(async (tx) => {
      let loc = await tx.stockLocation.findFirst({
        where: {
          storeId: store.id,
          kind: condition === "GOOD" ? LocationKind.SHELF : LocationKind.DAMAGED,
        },
        orderBy: { isDefault: "desc" },
      });
      if (!loc && condition === "DAMAGED") {
        loc = await tx.stockLocation.create({
          data: { storeId: store.id, name: "Hàng lỗi", kind: LocationKind.DAMAGED },
        });
      }
      if (!loc) throw new Error("Cửa hàng chưa có vị trí Kệ để nhận hàng trả");

      for (const it of items) {
        const v = await tx.productVariant.findFirst({
          where: { id: it.variantId, product: { storeId: store.id } },
          select: { id: true, sku: true, soldCount: true, costPrice: true },
        });
        if (!v) throw new Error("Có sản phẩm không thuộc cửa hàng này");
        if (it.quantity > v.soldCount) {
          throw new Error(`Số lượng trả của ${v.sku} (${it.quantity}) vượt quá số đã bán (${v.soldCount})`);
        }

        await InventoryService.recordReturn(tx, {
          storeId: store.id,
          variantId: v.id,
          locationId: loc.id,
          quantity: it.quantity,
          unitCost: v.costPrice,
          isDamaged: condition === "DAMAGED",
          refType: "RETURN",
          refId: orderCode || undefined,
          note: `Khách ${customerName} trả hàng${orderCode ? ` (đơn ${orderCode})` : ""}${
            condition === "DAMAGED" ? " — hàng lỗi" : ""
          }${note ? `: ${note}` : ""}`,
        });
      }
    });

    revalidatePath("/retail/returns");
    revalidatePath("/retail/products");
    revalidatePath("/retail");
    return { success: true };
  } catch (e: unknown) {
    return { error: errorMessage(e, "Lỗi ghi nhận trả hàng") };
  }
}

/**
 * 7. Xuất hủy hàng hỏng / hết hạn (trừ tồn tại một vị trí cụ thể)
 */
const disposeSchema = z.object({
  stockLevelId: z.string().min(1),
  quantity: z.number().int().positive(),
  reason: z.string().trim().min(1, "Vui lòng nhập lý do xuất hủy").max(500),
});

export async function disposeStockAction(input: z.infer<typeof disposeSchema>): Promise<ActionResult> {
  try {
    const store = await requireStore("RETAIL", Role.MANAGER);
    const parsed = disposeSchema.safeParse(input);
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dữ liệu xuất hủy không hợp lệ" };

    await prisma.$transaction(async (tx) => {
      const level = await tx.stockLevel.findFirst({
        where: { id: parsed.data.stockLevelId, storeId: store.id },
        include: { variant: { select: { costPrice: true } } },
      });
      if (!level) throw new Error("Không tìm thấy tồn kho tại vị trí đã chọn");

      await InventoryService.recordIssue(tx, {
        storeId: store.id,
        variantId: level.variantId ?? undefined,
        materialId: level.materialId ?? undefined,
        locationId: level.locationId,
        quantity: parsed.data.quantity,
        type: MovementType.DISPOSE,
        refType: "DISPOSE",
        unitCost: level.variant?.costPrice,
        note: `Xuất hủy: ${parsed.data.reason}`,
      });
    });

    revalidatePath("/retail/returns");
    revalidatePath("/retail/products");
    revalidatePath("/retail");
    return { success: true };
  } catch (e: unknown) {
    return { error: errorMessage(e, "Lỗi xuất hủy") };
  }
}

/**
 * 8. Chuyển vị trí (Kho ↔ Kệ) trong cùng cửa hàng
 */
const transferSchema = z.object({
  stockLevelId: z.string().min(1),
  toLocationId: z.string().min(1),
  quantity: z.number().int().positive(),
});

export async function transferStockAction(input: z.infer<typeof transferSchema>): Promise<ActionResult> {
  try {
    const store = await requireStore("RETAIL", Role.STAFF);
    const parsed = transferSchema.safeParse(input);
    if (!parsed.success) return { error: "Dữ liệu chuyển kho không hợp lệ" };

    await prisma.$transaction(async (tx) => {
      const level = await tx.stockLevel.findFirst({
        where: { id: parsed.data.stockLevelId, storeId: store.id },
      });
      if (!level) throw new Error("Không tìm thấy tồn kho tại vị trí nguồn");

      const target = await tx.stockLocation.findFirst({
        where: { id: parsed.data.toLocationId, storeId: store.id },
      });
      if (!target) throw new Error("Vị trí đích không thuộc cửa hàng này");
      if (target.kind === LocationKind.DAMAGED) {
        throw new Error("Dùng chức năng Xuất hủy / Trả hàng lỗi để đưa hàng vào vị trí Hàng lỗi");
      }

      await InventoryService.recordTransfer(tx, {
        storeId: store.id,
        variantId: level.variantId ?? undefined,
        materialId: level.materialId ?? undefined,
        locationId: level.locationId,
        targetLocationId: target.id,
        quantity: parsed.data.quantity,
        type: MovementType.TRANSFER_OUT,
        note: "Điều chuyển vị trí trong cửa hàng",
      });
    });

    revalidatePath("/retail/returns");
    revalidatePath("/retail/products");
    revalidatePath("/retail/pos");
    return { success: true };
  } catch (e: unknown) {
    return { error: errorMessage(e, "Lỗi chuyển kho") };
  }
}
