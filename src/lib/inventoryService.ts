import { MovementType, Prisma, LocationKind, NotificationType } from "@prisma/client";

export interface StockChangeInput {
  storeId: string;
  variantId?: string;
  materialId?: string;
  locationId: string; // Vị trí bắt buộc để ghi nhận sổ cái
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
  static getStockStatus(
    qty: number,
    minStock: number,
    maxStock?: number | null
  ): "OUT_OF_STOCK" | "LOW_STOCK" | "OVERSTOCK" | "IN_STOCK" {
    if (qty <= 0) return "OUT_OF_STOCK";
    if (qty <= minStock) return "LOW_STOCK";
    if (maxStock && maxStock > 0 && qty > maxStock) return "OVERSTOCK";
    return "IN_STOCK";
  }

  static async recordReceipt(
    tx: Prisma.TransactionClient,
    input: Omit<StockChangeInput, "type"> & { movementType?: MovementType }
  ) {
    if (input.quantity <= 0) {
      throw new Error("Số lượng nhập kho phải lớn hơn 0");
    }
    const movementType = input.movementType ?? MovementType.RECEIPT;

    const loc = await tx.stockLocation.findUnique({
      where: { id: input.locationId },
      select: { kind: true },
    });
    const kind = loc?.kind ?? LocationKind.WAREHOUSE;

    const movement = await tx.stockMovement.create({
      data: {
        storeId: input.storeId,
        variantId: input.variantId,
        materialId: input.materialId,
        toLocationId: input.locationId,
        quantityChange: input.quantity,
        type: movementType,
        refType: input.refType ?? "RECEIPT",
        refId: input.refId,
        unitCost: input.unitCost,
        note: input.note,
        createdBy: input.createdBy,
      },
    });

    await this.upsertStockLevel(tx, {
      storeId: input.storeId,
      locationId: input.locationId,
      variantId: input.variantId,
      materialId: input.materialId,
      delta: input.quantity,
    });

    if (input.variantId) {
      await tx.productVariant.update({
        where: { id: input.variantId },
        data: {
          totalQty: { increment: input.quantity },
          shelfQty: kind === LocationKind.SHELF ? { increment: input.quantity } : undefined,
          warehouseQty: kind === LocationKind.WAREHOUSE ? { increment: input.quantity } : undefined,
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

    await this.checkOverstockAndNotify(tx, {
      storeId: input.storeId,
      variantId: input.variantId,
      materialId: input.materialId,
    });

    return movement;
  }

  static async recordIssue(
    tx: Prisma.TransactionClient,
    input: StockChangeInput
  ) {
    if (input.quantity <= 0) {
      throw new Error("Số lượng xuất kho phải lớn hơn 0");
    }

    const loc = await tx.stockLocation.findUnique({
      where: { id: input.locationId },
      select: { kind: true },
    });
    if (!loc) throw new Error("Không tìm thấy vị trí kho xuất");

    if (input.type === MovementType.SALE && loc.kind === LocationKind.DAMAGED) {
      throw new Error("Không được phép xuất bán hàng từ vị trí Hàng Lỗi");
    }

    const kind = loc.kind;

    const levelUpdate = await tx.stockLevel.updateMany({
      where: {
        locationId: input.locationId,
        variantId: input.variantId ?? null,
        materialId: input.materialId ?? null,
        quantity: { gte: input.quantity },
      },
      data: {
        quantity: { decrement: input.quantity },
      },
    });

    if (levelUpdate.count === 0) {
      throw new Error(
        `Không đủ hàng tại vị trí chỉ định để xuất (yêu cầu: ${input.quantity})`
      );
    }

    if (input.variantId) {
      await tx.productVariant.update({
        where: { id: input.variantId },
        data: {
          totalQty: { decrement: input.quantity },
          soldCount: input.type === MovementType.SALE ? { increment: input.quantity } : undefined,
          shelfQty: kind === LocationKind.SHELF ? { decrement: input.quantity } : undefined,
          warehouseQty: kind === LocationKind.WAREHOUSE ? { decrement: input.quantity } : undefined,
        },
      });
    } else if (input.materialId) {
      await tx.material.update({
        where: { id: input.materialId },
        data: {
          totalQty: { decrement: input.quantity },
        },
      });
    }

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

    return movement;
  }

  static async recordReturn(
    tx: Prisma.TransactionClient,
    input: Omit<StockChangeInput, "type"> & { isDamaged?: boolean }
  ) {
    if (input.quantity <= 0) {
      throw new Error("Số lượng trả hàng phải lớn hơn 0");
    }

    const loc = await tx.stockLocation.findUnique({
      where: { id: input.locationId },
      select: { kind: true },
    });
    const kind = loc?.kind ?? LocationKind.WAREHOUSE;

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

    await this.upsertStockLevel(tx, {
      storeId: input.storeId,
      locationId: input.locationId,
      variantId: input.variantId,
      materialId: input.materialId,
      delta: input.quantity,
    });

    if (input.variantId) {
      await tx.productVariant.update({
        where: { id: input.variantId },
        data: {
          totalQty: { increment: input.quantity },
          shelfQty: kind === LocationKind.SHELF ? { increment: input.quantity } : undefined,
          warehouseQty: kind === LocationKind.WAREHOUSE ? { increment: input.quantity } : undefined,
          soldCount: !input.isDamaged ? { decrement: input.quantity } : undefined,
        },
      });
    }

    await this.checkOverstockAndNotify(tx, {
      storeId: input.storeId,
      variantId: input.variantId,
      materialId: input.materialId,
    });

    return movement;
  }

  static async recordTransfer(
    tx: Prisma.TransactionClient,
    input: StockChangeInput & { targetLocationId: string }
  ) {
    if (!input.locationId || !input.targetLocationId) {
      throw new Error("Cần chỉ rõ vị trí nguồn và vị trí đích");
    }
    if (input.locationId === input.targetLocationId) {
      throw new Error("Vị trí nguồn và vị trí đích phải khác nhau");
    }

    await this.recordIssue(tx, {
      ...input,
      type: MovementType.TRANSFER_OUT,
      refType: "TRANSFER",
    });

    await this.recordReceipt(tx, {
      ...input,
      locationId: input.targetLocationId,
      refType: "TRANSFER",
      movementType: MovementType.TRANSFER_IN,
    });
  }

  static async recordAdjustment(
    tx: Prisma.TransactionClient,
    input: {
      storeId: string;
      variantId?: string;
      materialId?: string;
      locationId: string;
      delta: number;
      refId?: string;
      unitCost?: bigint;
      reason: string;
      createdBy?: string;
    }
  ) {
    if (input.delta === 0) return null;

    const loc = await tx.stockLocation.findUnique({
      where: { id: input.locationId },
      select: { kind: true },
    });
    const kind = loc?.kind ?? LocationKind.WAREHOUSE;

    if (input.delta < 0) {
      await this.decrementLevelOrThrow(tx, {
        storeId: input.storeId,
        locationId: input.locationId,
        variantId: input.variantId,
        materialId: input.materialId,
        quantity: -input.delta,
      });
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

    if (input.delta > 0) {
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
          shelfQty: kind === LocationKind.SHELF ? { increment: input.delta } : undefined,
          warehouseQty: kind === LocationKind.WAREHOUSE ? { increment: input.delta } : undefined,
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

    if (input.delta > 0) {
      await this.checkOverstockAndNotify(tx, {
        storeId: input.storeId,
        variantId: input.variantId,
        materialId: input.materialId,
      });
    }

    return movement;
  }

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

    const alreadyReversed = await tx.stockMovement.findFirst({
      where: { refType: `CANCEL_${original.refType ?? "DOC"}`, refId: original.id },
    });
    if (alreadyReversed) {
      throw new Error("Movement này đã được đảo ngược trước đó rồi");
    }

    const reverseChange = -original.quantityChange;
    const targetLocId = original.toLocationId ?? original.fromLocationId;
    if (!targetLocId) {
      throw new Error("Không thể đảo ngược movement không có thông tin vị trí");
    }

    const loc = await tx.stockLocation.findUnique({
      where: { id: targetLocId },
      select: { kind: true },
    });
    const kind = loc?.kind ?? LocationKind.WAREHOUSE;

    if (reverseChange < 0) {
      await this.decrementLevelOrThrow(tx, {
        storeId: original.storeId,
        locationId: targetLocId,
        variantId: original.variantId ?? undefined,
        materialId: original.materialId ?? undefined,
        quantity: -reverseChange,
      });
    } else {
      await this.upsertStockLevel(tx, {
        storeId: original.storeId,
        locationId: targetLocId,
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
          shelfQty: kind === LocationKind.SHELF ? { increment: reverseChange } : undefined,
          warehouseQty: kind === LocationKind.WAREHOUSE ? { increment: reverseChange } : undefined,
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
        fromLocationId: reverseChange < 0 ? targetLocId : undefined,
        toLocationId: reverseChange > 0 ? targetLocId : undefined,
        quantityChange: reverseChange,
        type: MovementType.ADJUSTMENT,
        refType: `CANCEL_${original.refType ?? "DOC"}`,
        refId: original.id,
        unitCost: original.unitCost,
        note: `Đảo ngược ${original.id}: ${cancelReason}`,
        createdBy: cancelledBy,
      },
    });
  }

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
      isBalanced: moveSum === levelSum && levelSum === cachedTotal,
    };
  }

  private static async checkOverstockAndNotify(
    tx: Prisma.TransactionClient,
    params: { storeId: string; variantId?: string; materialId?: string }
  ) {
    if (params.variantId) {
      const v = await tx.productVariant.findUnique({
        where: { id: params.variantId },
        select: {
          sku: true,
          name: true,
          totalQty: true,
          maxStock: true,
          product: { select: { name: true } },
        },
      });
      if (!v || v.maxStock <= 0 || v.totalQty <= v.maxStock) return;

      const itemName = `${v.product.name}${v.name ? ` (${v.name})` : ""}`;
      const title = `Tồn kho quá mức: ${itemName}`;
      const message = `SKU ${v.sku} hiện tồn ${v.totalQty} sản phẩm, vượt ngưỡng tối đa ${v.maxStock}.`;

      const existing = await tx.notification.findFirst({
        where: { storeId: params.storeId, type: NotificationType.OVERSTOCK, isRead: false, title },
      });
      if (existing) {
        await tx.notification.update({
          where: { id: existing.id },
          data: { message, createdAt: new Date() },
        });
      } else {
        await tx.notification.create({
          data: {
            storeId: params.storeId,
            type: NotificationType.OVERSTOCK,
            title,
            message,
            linkUrl: "/retail/products",
          },
        });
      }
      return;
    }

    if (params.materialId) {
      const m = await tx.material.findUnique({
        where: { id: params.materialId },
        select: { sku: true, name: true, unit: true, totalQty: true, maxStock: true },
      });
      if (!m || m.maxStock <= 0 || m.totalQty <= m.maxStock) return;

      const title = `Tồn kho quá mức: ${m.name}`;
      const message = `SKU ${m.sku} hiện tồn ${m.totalQty} ${m.unit}, vượt ngưỡng tối đa ${m.maxStock} ${m.unit}.`;

      const existing = await tx.notification.findFirst({
        where: { storeId: params.storeId, type: NotificationType.OVERSTOCK, isRead: false, title },
      });
      if (existing) {
        await tx.notification.update({
          where: { id: existing.id },
          data: { message, createdAt: new Date() },
        });
      } else {
        await tx.notification.create({
          data: {
            storeId: params.storeId,
            type: NotificationType.OVERSTOCK,
            title,
            message,
            linkUrl: "/warehouse/items",
          },
        });
      }
    }
  }

  private static async decrementLevelOrThrow(
    tx: Prisma.TransactionClient,
    params: {
      storeId: string;
      locationId: string;
      variantId?: string;
      materialId?: string;
      quantity: number;
    }
  ) {
    const res = await tx.stockLevel.updateMany({
      where: {
        storeId: params.storeId,
        locationId: params.locationId,
        variantId: params.variantId ?? null,
        materialId: params.materialId ?? null,
        quantity: { gte: params.quantity },
      },
      data: { quantity: { decrement: params.quantity } },
    });
    if (res.count === 0) {
      throw new Error(
        `Không đủ tồn tại vị trí để thực hiện (cần trừ ${params.quantity}) - thao tác sẽ làm âm tồn kho`
      );
    }
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
