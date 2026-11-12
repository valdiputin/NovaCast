import { MovementType, Prisma } from "@prisma/client";

export interface StockChangeInput {
  storeId: string;
  variantId?: string;
  materialId?: string;
  locationId?: string;
  targetLocationId?: string;
  quantity: number;
  type: MovementType;
  refType?: string;
  refId?: string;
  unitCost?: bigint;
  note?: string;
  createdBy?: string;
}

export class InventoryService {
  static getStockStatus(qty: number, minStock: number): "OUT_OF_STOCK" | "LOW_STOCK" | "IN_STOCK" {
    if (qty <= 0) return "OUT_OF_STOCK";
    if (qty <= minStock) return "LOW_STOCK";
    return "IN_STOCK";
  }

  /**
   * Nhập kho (RECEIPT)
   */
  static async recordReceipt(
    tx: Prisma.TransactionClient,
    input: Omit<StockChangeInput, "type">
  ) {
    if (input.quantity <= 0) {
      throw new Error("Số lượng nhập kho phải lớn hơn 0");
    }

    const movement = await tx.stockMovement.create({
      data: {
        storeId: input.storeId,
        variantId: input.variantId,
        materialId: input.materialId,
        toLocationId: input.locationId,
        quantityChange: input.quantity,
        type: MovementType.RECEIPT,
        refType: input.refType ?? "RECEIPT",
        refId: input.refId,
        unitCost: input.unitCost,
        note: input.note,
        createdBy: input.createdBy,
      },
    });

    let isShelf = false;
    let isDamagedLoc = false;
    if (input.locationId) {
      const loc = await tx.stockLocation.findUnique({
        where: { id: input.locationId },
        select: { name: true },
      });
      if (loc) {
        const lower = loc.name.toLowerCase();
        if (lower.includes("kệ") || lower.includes("quầy")) isShelf = true;
        if (lower.includes("lỗi") || lower.includes("hỏng")) isDamagedLoc = true;
      }
      await this.upsertStockLevel(tx, {
        storeId: input.storeId,
        locationId: input.locationId,
        variantId: input.variantId,
        materialId: input.materialId,
        delta: input.quantity,
      });
    }

    if (input.variantId) {
      await tx.productVariant.update({
        where: { id: input.variantId },
        data: {
          totalQty: { increment: input.quantity },
          shelfQty: isShelf ? { increment: input.quantity } : undefined,
          warehouseQty: !isShelf && !isDamagedLoc ? { increment: input.quantity } : undefined,
        },
      });
    } else if (input.materialId) {
      await tx.material.update({
        where: { id: input.materialId },
        data: {
          totalQty: { increment: input.quantity },
        },
      });
    }

    return movement;
  }

  /**
   * Xuất kho / Bán hàng (ISSUE / SALE / DISPOSE)
   * Sử dụng atomic update có điều kiện (quantity >= input.quantity) chống race condition
   */
  static async recordIssue(
    tx: Prisma.TransactionClient,
    input: StockChangeInput
  ) {
    if (input.quantity <= 0) {
      throw new Error("Số lượng xuất kho phải lớn hơn 0");
    }

    // 1. Kiểm tra tồn kho tại vị trí cụ thể nếu có locationId
    if (input.locationId) {
      const locLevel = await tx.stockLevel.findFirst({
        where: {
          locationId: input.locationId,
          variantId: input.variantId ?? null,
          materialId: input.materialId ?? null,
        },
      });
      if (!locLevel || locLevel.quantity < input.quantity) {
        throw new Error(
          `Không đủ hàng tại vị trí này để xuất (hiện có: ${locLevel?.quantity ?? 0}, yêu cầu: ${input.quantity})`
        );
      }
    }

    // 2. Atomic decrement chống bán vượt tồn đồng thời
    if (input.variantId) {
      const updateResult = await tx.productVariant.updateMany({
        where: {
          id: input.variantId,
          totalQty: { gte: input.quantity },
        },
        data: {
          totalQty: { decrement: input.quantity },
        },
      });

      if (updateResult.count === 0) {
        const v = await tx.productVariant.findUnique({
          where: { id: input.variantId },
          select: { sku: true, totalQty: true },
        });
        throw new Error(
          `Không đủ tồn kho để xuất mã ${v?.sku ?? input.variantId} (hiện tồn: ${v?.totalQty ?? 0}, yêu cầu: ${input.quantity})`
        );
      }

      // Cập nhật shelf/warehouse cache
      if (input.type === MovementType.SALE) {
        await tx.productVariant.update({
          where: { id: input.variantId },
          data: {
            soldCount: { increment: input.quantity },
            shelfQty: { decrement: input.quantity },
          },
        });
      } else {
        await tx.productVariant.update({
          where: { id: input.variantId },
          data: {
            warehouseQty: { decrement: input.quantity },
          },
        });
      }
    } else if (input.materialId) {
      const updateResult = await tx.material.updateMany({
        where: {
          id: input.materialId,
          totalQty: { gte: input.quantity },
        },
        data: {
          totalQty: { decrement: input.quantity },
        },
      });

      if (updateResult.count === 0) {
        const m = await tx.material.findUnique({
          where: { id: input.materialId },
          select: { sku: true, totalQty: true },
        });
        throw new Error(
          `Không đủ vật tư để xuất mã ${m?.sku ?? input.materialId} (hiện tồn: ${m?.totalQty ?? 0}, yêu cầu: ${input.quantity})`
        );
      }
    }

    // 3. Tạo movement
    const movement = await tx.stockMovement.create({
      data: {
        storeId: input.storeId,
        variantId: input.variantId,
        materialId: input.materialId,
        fromLocationId: input.locationId,
        quantityChange: -input.quantity,
        type: input.type,
        refType: input.refType,
        refId: input.refId,
        unitCost: input.unitCost,
        note: input.note,
        createdBy: input.createdBy,
      },
    });

    // 4. Giảm stock_levels
    if (input.locationId) {
      await this.upsertStockLevel(tx, {
        storeId: input.storeId,
        locationId: input.locationId,
        variantId: input.variantId,
        materialId: input.materialId,
        delta: -input.quantity,
      });
    }

    return movement;
  }

  /**
   * Khách trả hàng hoàn kho (RETURN)
   * Với hàng lỗi: đưa vào location Hàng lỗi, vẫn cộng totalQty để khớp sổ cái movement
   */
  static async recordReturn(
    tx: Prisma.TransactionClient,
    input: Omit<StockChangeInput, "type"> & { isDamaged?: boolean }
  ) {
    if (input.quantity <= 0) {
      throw new Error("Số lượng trả hàng phải lớn hơn 0");
    }

    const movement = await tx.stockMovement.create({
      data: {
        storeId: input.storeId,
        variantId: input.variantId,
        materialId: input.materialId,
        toLocationId: input.locationId,
        quantityChange: input.quantity,
        type: MovementType.RETURN,
        refType: input.refType ?? "RETURN",
        refId: input.refId,
        unitCost: input.unitCost,
        note: input.note ?? (input.isDamaged ? "Hàng lỗi trả về" : "Khách trả hàng nguyên vẹn"),
        createdBy: input.createdBy,
      },
    });

    if (input.locationId) {
      await this.upsertStockLevel(tx, {
        storeId: input.storeId,
        locationId: input.locationId,
        variantId: input.variantId,
        materialId: input.materialId,
        delta: input.quantity,
      });
    }

    if (input.variantId) {
      await tx.productVariant.update({
        where: { id: input.variantId },
        data: {
          totalQty: { increment: input.quantity },
          shelfQty: !input.isDamaged ? { increment: input.quantity } : undefined,
          soldCount: !input.isDamaged ? { decrement: input.quantity } : undefined,
        },
      });
    }

    return movement;
  }

  /**
   * Chuyển kho (TRANSFER)
   */
  static async recordTransfer(
    tx: Prisma.TransactionClient,
    input: StockChangeInput & { targetLocationId: string }
  ) {
    if (!input.locationId || !input.targetLocationId) {
      throw new Error("Cần chỉ rõ vị trí nguồn và vị trí đích");
    }
    if (input.locationId === input.targetLocationId) {
      throw new Error("Vị trí nguồn và đích phải khác nhau");
    }

    // Xuất kho nguồn
    await this.recordIssue(tx, {
      ...input,
      type: MovementType.TRANSFER_OUT,
      refType: "TRANSFER",
    });

    // Nhập kho đích
    await this.recordReceipt(tx, {
      ...input,
      locationId: input.targetLocationId,
      refType: "TRANSFER",
    });
  }

  /**
   * Điều chỉnh / Cân bằng kho sau kiểm kê (ADJUSTMENT)
   */
  static async recordAdjustment(
    tx: Prisma.TransactionClient,
    input: {
      storeId: string;
      variantId?: string;
      materialId?: string;
      locationId?: string;
      delta: number;
      refId?: string;
      unitCost?: bigint;
      reason: string;
      createdBy?: string;
    }
  ) {
    if (input.delta === 0) return null;

    let isShelf = false;
    if (input.locationId) {
      const loc = await tx.stockLocation.findUnique({
        where: { id: input.locationId },
        select: { name: true },
      });
      if (loc && (loc.name.toLowerCase().includes("kệ") || loc.name.toLowerCase().includes("quầy"))) {
        isShelf = true;
      }
    }

    const movement = await tx.stockMovement.create({
      data: {
        storeId: input.storeId,
        variantId: input.variantId,
        materialId: input.materialId,
        fromLocationId: input.delta < 0 ? input.locationId : undefined,
        toLocationId: input.delta > 0 ? input.locationId : undefined,
        quantityChange: input.delta,
        type: MovementType.ADJUSTMENT,
        refType: "AUDIT",
        refId: input.refId,
        unitCost: input.unitCost,
        note: `Cân bằng kho: ${input.reason}`,
        createdBy: input.createdBy,
      },
    });

    if (input.locationId) {
      await this.upsertStockLevel(tx, {
        storeId: input.storeId,
        locationId: input.locationId,
        variantId: input.variantId,
        materialId: input.materialId,
        delta: input.delta,
      });
    }

    if (input.variantId) {
      await tx.productVariant.update({
        where: { id: input.variantId },
        data: {
          totalQty: { increment: input.delta },
          shelfQty: isShelf ? { increment: input.delta } : undefined,
          warehouseQty: !isShelf ? { increment: input.delta } : undefined,
        },
      });
    } else if (input.materialId) {
      await tx.material.update({
        where: { id: input.materialId },
        data: {
          totalQty: { increment: input.delta },
        },
      });
    }

    return movement;
  }

  /**
   * Đảo ngược movement đầy đủ khi hủy phiếu đã duyệt
   */
  static async reverseMovement(
    tx: Prisma.TransactionClient,
    movementId: string,
    cancelReason: string,
    cancelledBy?: string
  ) {
    const original = await tx.stockMovement.findUnique({
      where: { id: movementId },
    });
    if (!original) throw new Error("Không tìm thấy movement để đảo ngược");

    const reverseChange = -original.quantityChange;

    // Kiểm tra không để âm tồn khi đảo ngược
    if (reverseChange < 0) {
      if (original.variantId) {
        const v = await tx.productVariant.findUnique({
          where: { id: original.variantId },
          select: { totalQty: true, sku: true },
        });
        if (v && v.totalQty < Math.abs(reverseChange)) {
          throw new Error(
            `Không thể hủy movement: gây âm tồn cho ${v.sku} (tồn hiện tại ${v.totalQty}, cần đảo ngược ${Math.abs(reverseChange)})`
          );
        }
      } else if (original.materialId) {
        const m = await tx.material.findUnique({
          where: { id: original.materialId },
          select: { totalQty: true, sku: true },
        });
        if (m && m.totalQty < Math.abs(reverseChange)) {
          throw new Error(
            `Không thể hủy movement: gây âm tồn cho vật tư ${m.sku}`
          );
        }
      }
    }

    // Đảo ngược location
    const targetLoc = original.toLocationId ?? original.fromLocationId;
    if (targetLoc) {
      await this.upsertStockLevel(tx, {
        storeId: original.storeId,
        locationId: targetLoc,
        variantId: original.variantId ?? undefined,
        materialId: original.materialId ?? undefined,
        delta: reverseChange,
      });
    }

    if (original.variantId) {
      await tx.productVariant.update({
        where: { id: original.variantId },
        data: {
          totalQty: { increment: reverseChange },
          soldCount: original.type === MovementType.SALE ? { decrement: Math.abs(reverseChange) } : undefined,
        },
      });
    } else if (original.materialId) {
      await tx.material.update({
        where: { id: original.materialId },
        data: {
          totalQty: { increment: reverseChange },
        },
      });
    }

    return await tx.stockMovement.create({
      data: {
        storeId: original.storeId,
        variantId: original.variantId,
        materialId: original.materialId,
        quantityChange: reverseChange,
        type: original.type,
        refType: `CANCEL_${original.refType ?? "DOC"}`,
        refId: original.refId,
        unitCost: original.unitCost,
        note: `Đảo ngược ${original.id}: ${cancelReason}`,
        createdBy: cancelledBy,
      },
    });
  }

  /**
   * Hàm đối soát (Reconcile) chứng minh tính nhất quán:
   * SUM(stock_movements.quantityChange) = SUM(stock_levels.quantity) = totalQty
   */
  static async reconcile(
    tx: Prisma.TransactionClient,
    itemId: { variantId?: string; materialId?: string }
  ) {
    const movements = await tx.stockMovement.aggregate({
      where: {
        variantId: itemId.variantId ?? null,
        materialId: itemId.materialId ?? null,
      },
      _sum: { quantityChange: true },
    });
    const moveSum = movements._sum.quantityChange ?? 0;

    const levels = await tx.stockLevel.aggregate({
      where: {
        variantId: itemId.variantId ?? null,
        materialId: itemId.materialId ?? null,
      },
      _sum: { quantity: true },
    });
    const levelSum = levels._sum.quantity ?? 0;

    let cachedTotal = 0;
    if (itemId.variantId) {
      const v = await tx.productVariant.findUnique({
        where: { id: itemId.variantId },
        select: { totalQty: true },
      });
      cachedTotal = v?.totalQty ?? 0;
    } else if (itemId.materialId) {
      const m = await tx.material.findUnique({
        where: { id: itemId.materialId },
        select: { totalQty: true },
      });
      cachedTotal = m?.totalQty ?? 0;
    }

    return {
      movementSum: moveSum,
      levelSum: levelSum,
      cachedTotal: cachedTotal,
      isBalanced: moveSum === cachedTotal && (levelSum === 0 || levelSum === cachedTotal),
    };
  }

  private static async upsertStockLevel(
    tx: Prisma.TransactionClient,
    params: {
      storeId: string;
      locationId: string;
      variantId?: string;
      materialId?: string;
      delta: number;
    }
  ) {
    const existing = await tx.stockLevel.findFirst({
      where: {
        locationId: params.locationId,
        variantId: params.variantId ?? null,
        materialId: params.materialId ?? null,
      },
    });

    if (existing) {
      await tx.stockLevel.update({
        where: { id: existing.id },
        data: { quantity: { increment: params.delta } },
      });
    } else {
      await tx.stockLevel.create({
        data: {
          storeId: params.storeId,
          locationId: params.locationId,
          variantId: params.variantId,
          materialId: params.materialId,
          quantity: params.delta,
        },
      });
    }
  }
}
