"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentStore } from "@/lib/auth";
import { InventoryService } from "@/lib/inventoryService";
import { MovementType, OrderStatus, Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

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

export async function updateProductDiscountAction(productId: string, discountPercent: number) {
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
    return { error: e instanceof Error ? e.message : "Đã xảy ra lỗi" };
  }
}

/**
 * 2. Cập nhật trạng thái đơn hàng (Food / Retail)
 */
const updateOrderStatusSchema = z.object({
  orderId: z.string().min(1),
  newStatus: z.nativeEnum(OrderStatus),
});

export async function updateOrderStatusAction(orderId: string, newStatus: OrderStatus) {
  try {
    const store = await requireStore(undefined, Role.STAFF);
    const parsed = updateOrderStatusSchema.safeParse({ orderId, newStatus });
    if (!parsed.success) return { error: "Trạng thái không hợp lệ" };

    const order = await prisma.order.findFirst({
      where: { id: parsed.data.orderId, storeId: store.id },
    });

    if (!order) return { error: "Không tìm thấy đơn hàng" };

    if (order.status === OrderStatus.COMPLETED || order.status === OrderStatus.CANCELLED) {
      return { error: "Đơn hàng đã kết thúc (Hoàn thành / Đã hủy), không thể chuyển trạng thái" };
    }

    // Chuyển trạng thái hợp lệ
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

    await prisma.order.update({
      where: { id: order.id },
      data: { status: parsed.data.newStatus },
    });

    revalidatePath("/food/orders");
    revalidatePath("/retail/orders");
    return { success: true };
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : "Đã xảy ra lỗi" };
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

export async function completeRetailReceivingAction(input: z.infer<typeof receiveSchema>) {
  try {
    const store = await requireStore("RETAIL", Role.MANAGER);
    const parsed = receiveSchema.safeParse(input);
    if (!parsed.success) return { error: "Dữ liệu phiếu nhập không hợp lệ" };

    // Vị trí kho lưu trữ của cửa hàng
    const loc = await prisma.stockLocation.findFirst({
      where: { storeId: store.id, kind: "WAREHOUSE" },
    });
    if (!loc) return { error: "Cửa hàng chưa có vị trí kho để nhập hàng" };

    // Kiểm tra tất cả variantId thuộc store
    const variantIds = parsed.data.items.map((i) => i.variantId);
    const existingCount = await prisma.productVariant.count({
      where: { id: { in: variantIds }, product: { storeId: store.id } },
    });
    if (existingCount !== variantIds.length) {
      return { error: "Có sản phẩm không thuộc quyền quản lý của cửa hàng" };
    }

    const totalAmount = parsed.data.items.reduce(
      (acc, it) => acc + it.quantity * it.costPrice * (1 - it.discountRate / 100),
      0
    );

    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const countToday = await prisma.stockReceipt.count({
      where: { storeId: store.id, createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
    });
    const receiptCode = `PNH-${todayStr}-${(countToday + 1).toString().padStart(2, "0")}`;

    await prisma.$transaction(async (tx) => {
      const receipt = await tx.stockReceipt.create({
        data: {
          code: receiptCode,
          storeId: store.id,
          note: parsed.data.note,
          status: "APPROVED",
          totalAmount: BigInt(Math.round(totalAmount)),
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
            totalAmount: BigInt(Math.round(item.quantity * item.costPrice * (1 - item.discountRate / 100))),
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
    });

    revalidatePath("/retail/receiving");
    revalidatePath("/retail/products");
    revalidatePath("/retail");
    return { success: true, code: receiptCode };
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : "Đã xảy ra lỗi" };
  }
}

/**
 * 4. Thanh toán đơn hàng POS bán lẻ tại quầy (Giá đọc từ Database thật, không tin client)
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

export async function checkoutPosAction(input: z.infer<typeof posCheckoutSchema>) {
  try {
    const store = await requireStore("RETAIL", Role.STAFF);
    const parsed = posCheckoutSchema.safeParse(input);
    if (!parsed.success) return { error: "Giỏ hàng rỗng hoặc không hợp lệ" };

    const shelfLoc = await prisma.stockLocation.findFirst({
      where: { storeId: store.id, kind: "SHELF" },
    });
    if (!shelfLoc) return { error: "Không tìm thấy vị trí Kệ bán hàng của cửa hàng" };

    // Lấy thông tin giá từ DB và xác thực store
    const variantIds = parsed.data.items.map((i) => i.variantId);
    const dbVariants = await prisma.productVariant.findMany({
      where: { id: { in: variantIds }, product: { storeId: store.id } },
      include: { product: true },
    });

    if (dbVariants.length !== variantIds.length) {
      return { error: "Có mặt hàng không tồn tại hoặc không thuộc cửa hàng này" };
    }

    const variantMap = new Map(dbVariants.map((v) => [v.id, v]));
    let totalSubtotal = 0;

    const validatedItems = parsed.data.items.map((item) => {
      const v = variantMap.get(item.variantId)!;
      const unitPrice = Number(v.price);
      const lineTotal = unitPrice * item.quantity;
      totalSubtotal += lineTotal;
      return {
        variantId: v.id,
        name: `${v.product.name} - ${v.name}`,
        quantity: item.quantity,
        unitPrice: BigInt(unitPrice),
        totalPrice: BigInt(lineTotal),
      };
    });

    const orderCode = `DH-POS-${Date.now().toString().slice(-6)}`;

    await prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          code: orderCode,
          storeId: store.id,
          customerName: "Khách Lẻ Mua Tại Quầy",
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
    return { error: e instanceof Error ? e.message : "Lỗi xử lý đơn hàng POS" };
  }
}

/**
 * 5. Cân bằng kho sau kiểm kê (Retail & Warehouse Audit)
 */
export async function balanceStockAuditAction(
  auditId: string,
  actualCounts: { variantId?: string; materialId?: string; actualQty: number; reason: string }[]
) {
  try {
    const store = await requireStore(undefined, Role.MANAGER);
    const loc = await prisma.stockLocation.findFirst({
      where: { storeId: store.id },
    });
    if (!loc) return { error: "Không tìm thấy vị trí kho" };

    await prisma.$transaction(async (tx) => {
      for (const item of actualCounts) {
        let systemQty = 0;
        if (item.variantId) {
          const v = await tx.productVariant.findUnique({ where: { id: item.variantId } });
          systemQty = v?.totalQty ?? 0;
        } else if (item.materialId) {
          const m = await tx.material.findUnique({ where: { id: item.materialId } });
          systemQty = m?.totalQty ?? 0;
        }

        const delta = item.actualQty - systemQty;
        if (delta !== 0) {
          await InventoryService.recordAdjustment(tx, {
            storeId: store.id,
            variantId: item.variantId,
            materialId: item.materialId,
            locationId: loc.id,
            delta,
            refId: auditId,
            reason: item.reason || "Cân bằng kiểm kê",
          });
        }
      }
    });

    revalidatePath("/retail/audit");
    revalidatePath("/warehouse/audit");
    revalidatePath("/retail/products");
    revalidatePath("/warehouse/items");
    return { success: true };
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : "Lỗi cân bằng kho" };
  }
}
