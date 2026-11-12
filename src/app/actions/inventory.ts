"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentStore } from "@/lib/auth";
import { InventoryService } from "@/lib/inventoryService";
import { MovementType, OrderStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

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
  const store = await getCurrentStore("FOOD");
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
}

/**
 * 2. Cập nhật trạng thái đơn hàng (Food / Retail)
 */
export async function updateOrderStatusAction(orderId: string, newStatus: OrderStatus) {
  const store = await getCurrentStore();
  const order = await prisma.order.findFirst({
    where: { id: orderId, storeId: store.id },
  });

  if (!order) return { error: "Không tìm thấy đơn hàng" };

  // Chặn đổi trạng thái ngược lại từ Hoàn thành hoặc Đã hủy
  if (order.status === OrderStatus.COMPLETED || order.status === OrderStatus.CANCELLED) {
    return { error: "Đơn hàng đã kết thúc (Hoàn thành / Đã hủy), không thể chuyển trạng thái" };
  }

  await prisma.order.update({
    where: { id: order.id },
    data: { status: newStatus },
  });

  revalidatePath("/food/orders");
  revalidatePath("/retail/orders");
  return { success: true };
}

/**
 * 3. Hoàn thành nhập kho bán lẻ (Retail Receiving) gọi InventoryService thật
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
  const store = await getCurrentStore("RETAIL");
  const parsed = receiveSchema.safeParse(input);
  if (!parsed.success) return { error: "Dữ liệu phiếu nhập không hợp lệ" };

  // Lấy vị trí kho của store
  const loc = await prisma.stockLocation.findFirst({
    where: { storeId: store.id },
  });
  if (!loc) return { error: "Cửa hàng chưa có vị trí kho để nhập hàng" };

  const totalAmount = parsed.data.items.reduce(
    (acc, it) => acc + it.quantity * it.costPrice * (1 - it.discountRate / 100),
    0
  );

  const receiptCode = `PNH-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(10 + Math.random() * 90)}`;

  await prisma.$transaction(async (tx) => {
    // 1. Tạo phiếu nhập kho
    const receipt = await tx.stockReceipt.create({
      data: {
        code: receiptCode,
        storeId: store.id,
        note: parsed.data.note,
        status: "APPROVED",
        totalAmount: BigInt(Math.round(totalAmount)),
      },
    });

    // 2. Ghi từng dòng và cập nhật tồn qua InventoryService
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
}

/**
 * 4. Thanh toán đơn hàng POS bán lẻ tại quầy
 */
const posCheckoutSchema = z.object({
  items: z.array(
    z.object({
      variantId: z.string().min(1),
      quantity: z.number().int().positive(),
      price: z.number().int().positive(),
      name: z.string(),
    })
  ).min(1),
  paymentMethod: z.enum(["CASH", "BANK_TRANSFER", "E_WALLET"]).default("CASH"),
});

export async function checkoutPosAction(input: z.infer<typeof posCheckoutSchema>) {
  const store = await getCurrentStore("RETAIL");
  const parsed = posCheckoutSchema.safeParse(input);
  if (!parsed.success) return { error: "Giỏ hàng rỗng hoặc không hợp lệ" };

  const shelfLoc = await prisma.stockLocation.findFirst({
    where: { storeId: store.id, kind: "SHELF" },
  });
  if (!shelfLoc) return { error: "Không tìm thấy vị trí Kệ bán hàng của cửa hàng" };

  const subtotal = parsed.data.items.reduce((acc, it) => acc + it.quantity * it.price, 0);
  const orderCode = `DH-POS-${Date.now().toString().slice(-6)}`;

  try {
    await prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          code: orderCode,
          storeId: store.id,
          customerName: "Khách Lẻ Mua Tại Quầy",
          paymentMethod: parsed.data.paymentMethod,
          status: OrderStatus.COMPLETED,
          isPosOrder: true,
          subtotal: BigInt(subtotal),
          totalAmount: BigInt(subtotal),
        },
      });

      for (const it of parsed.data.items) {
        await tx.orderItem.create({
          data: {
            orderId: order.id,
            variantId: it.variantId,
            productName: it.name,
            quantity: it.quantity,
            unitPrice: BigInt(it.price),
            totalPrice: BigInt(it.quantity * it.price),
          },
        });

        // Trừ tồn kho qua InventoryService
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
    const msg = e instanceof Error ? e.message : "Lỗi xử lý đơn hàng";
    return { error: msg };
  }
}

/**
 * 5. Cân bằng kho sau kiểm kê (Retail & Warehouse Audit)
 */
export async function balanceStockAuditAction(
  auditId: string,
  items: { variantId?: string; materialId?: string; systemQty: number; actualQty: number; reason: string }[]
) {
  const store = await getCurrentStore();
  const loc = await prisma.stockLocation.findFirst({
    where: { storeId: store.id },
  });
  if (!loc) return { error: "Không tìm thấy vị trí kho" };

  try {
    await prisma.$transaction(async (tx) => {
      for (const item of items) {
        const delta = item.actualQty - item.systemQty;
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
    const msg = e instanceof Error ? e.message : "Lỗi cân bằng kho";
    return { error: msg };
  }
}
