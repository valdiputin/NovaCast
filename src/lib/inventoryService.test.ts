/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from "vitest";
import { InventoryService } from "./inventoryService";
import { MovementType, LocationKind } from "@prisma/client";

describe("InventoryService (Comprehensive Stock & Reconcile)", () => {
  it("Kiểm tra tính năng đối soát reconcile: SUM(movements) === SUM(levels) === totalQty", async () => {
    const fakeVariant = {
      id: "var-1",
      sku: "AT-BS-W-M",
      name: "Áo Thun Basic M",
      totalQty: 0,
      shelfQty: 0,
      warehouseQty: 0,
      soldCount: 0,
    };

    const recordedMovements: any[] = [];
    const stockLevels: Record<string, number> = {};

    const mockTx: any = {
      stockMovement: {
        create: vi.fn(async ({ data }: any) => {
          recordedMovements.push({ id: `mov-${recordedMovements.length + 1}`, ...data });
          return recordedMovements[recordedMovements.length - 1];
        }),
        aggregate: vi.fn(async () => {
          const sum = recordedMovements.reduce((acc, m) => acc + m.quantityChange, 0);
          return { _sum: { quantityChange: sum } };
        }),
        findFirst: vi.fn(async () => null),
        findUnique: vi.fn(async ({ where }: any) => {
          return recordedMovements.find((m) => m.id === where.id) || null;
        }),
      },
      stockLocation: {
        findUnique: vi.fn(async ({ where }: any) => {
          if (where.id === "loc-shelf") return { id: "loc-shelf", kind: LocationKind.SHELF };
          if (where.id === "loc-wh") return { id: "loc-wh", kind: LocationKind.WAREHOUSE };
          return { id: where.id, kind: LocationKind.DAMAGED };
        }),
      },
      stockLevel: {
        findFirst: vi.fn(async ({ where }: any) => {
          const key = `${where.locationId}_${where.variantId}`;
          if (stockLevels[key] !== undefined) {
            return { id: "lvl-1", quantity: stockLevels[key] };
          }
          return null;
        }),
        create: vi.fn(async ({ data }: any) => {
          const key = `${data.locationId}_${data.variantId}`;
          stockLevels[key] = data.quantity;
          return { id: "lvl-1", ...data };
        }),
        update: vi.fn(async ({ where, data }: any) => {
          const key = `loc-wh_var-1`;
          stockLevels[key] = (stockLevels[key] || 0) + data.quantity.increment;
          return { id: where.id, quantity: stockLevels[key] };
        }),
        updateMany: vi.fn(async ({ where, data }: any) => {
          const key = `${where.locationId}_${where.variantId}`;
          const cur = stockLevels[key] || 0;
          if (cur >= where.quantity.gte) {
            stockLevels[key] = cur - data.quantity.decrement;
            return { count: 1 };
          }
          return { count: 0 };
        }),
        aggregate: vi.fn(async () => {
          const sum = Object.values(stockLevels).reduce((acc, v) => acc + v, 0);
          return { _sum: { quantity: sum } };
        }),
      },
      productVariant: {
        findUnique: vi.fn(async () => ({ ...fakeVariant })),
        update: vi.fn(async ({ data }: any) => {
          if (data.totalQty?.increment !== undefined) {
            fakeVariant.totalQty += data.totalQty.increment;
          }
          if (data.totalQty?.decrement !== undefined) {
            fakeVariant.totalQty -= data.totalQty.decrement;
          }
          if (data.warehouseQty?.increment !== undefined) {
            fakeVariant.warehouseQty += data.warehouseQty.increment;
          }
          if (data.warehouseQty?.decrement !== undefined) {
            fakeVariant.warehouseQty -= data.warehouseQty.decrement;
          }
          if (data.shelfQty?.increment !== undefined) {
            fakeVariant.shelfQty += data.shelfQty.increment;
          }
          if (data.shelfQty?.decrement !== undefined) {
            fakeVariant.shelfQty -= data.shelfQty.decrement;
          }
          if (data.soldCount?.increment !== undefined) {
            fakeVariant.soldCount += data.soldCount.increment;
          }
          if (data.soldCount?.decrement !== undefined) {
            fakeVariant.soldCount -= data.soldCount.decrement;
          }
          return { ...fakeVariant };
        }),
      },
    };

    // 1. Nhập kho 100 cái vào Kho
    await InventoryService.recordReceipt(mockTx, {
      storeId: "st-1",
      variantId: "var-1",
      locationId: "loc-wh",
      quantity: 100,
    });
    expect(fakeVariant.totalQty).toBe(100);
    expect(fakeVariant.warehouseQty).toBe(100);

    // 2. Xuất bán 30 cái từ Kho
    await InventoryService.recordIssue(mockTx, {
      storeId: "st-1",
      variantId: "var-1",
      locationId: "loc-wh",
      quantity: 30,
      type: MovementType.SALE,
    });
    expect(fakeVariant.totalQty).toBe(70);

    // 3. Khách trả 5 cái vào Kho
    await InventoryService.recordReturn(mockTx, {
      storeId: "st-1",
      variantId: "var-1",
      locationId: "loc-wh",
      quantity: 5,
    });
    expect(fakeVariant.totalQty).toBe(75);

    // 4. Kiểm kê chênh lệch -3 tại Kho
    await InventoryService.recordAdjustment(mockTx, {
      storeId: "st-1",
      variantId: "var-1",
      locationId: "loc-wh",
      delta: -3,
      reason: "Hao hụt kiểm đếm",
    });
    expect(fakeVariant.totalQty).toBe(72);

    // 5. Đối soát reconcile tuyệt đối
    const rec = await InventoryService.reconcile(mockTx, { variantId: "var-1" });
    expect(rec.isBalanced).toBe(true);
    expect(rec.movementSum).toBe(72);
    expect(rec.levelSum).toBe(72);
    expect(rec.cachedTotal).toBe(72);
  });
});
