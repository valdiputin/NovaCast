/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from "vitest";
import { InventoryService } from "./inventoryService";
import { MovementType } from "@prisma/client";

describe("InventoryService (Comprehensive Unit & Reconcile Tests)", () => {
  it("Kiểm tra hàm getStockStatus", () => {
    expect(InventoryService.getStockStatus(0, 5)).toBe("OUT_OF_STOCK");
    expect(InventoryService.getStockStatus(5, 5)).toBe("LOW_STOCK");
    expect(InventoryService.getStockStatus(15, 5)).toBe("IN_STOCK");
  });

  it("Kịch bản chuẩn: Nhập 100 -> Bán 30 -> Trả 5 -> Kiểm kê 72 và đối soát reconcile", async () => {
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
          recordedMovements.push(data);
          return { id: `mov-${recordedMovements.length}`, ...data };
        }),
        aggregate: vi.fn(async () => {
          const sum = recordedMovements.reduce((acc, m) => acc + m.quantityChange, 0);
          return { _sum: { quantityChange: sum } };
        }),
        findUnique: vi.fn(async ({ where }: any) => {
          return recordedMovements.find((m) => m.id === where.id) || null;
        }),
      },
      stockLocation: {
        findUnique: vi.fn(async ({ where }: any) => {
          return { id: where.id, name: "Kệ trưng bày A1" };
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
        update: vi.fn(async ({ data }: any) => {
          const key = `loc-1_var-1`;
          stockLevels[key] = (stockLevels[key] || 0) + data.quantity.increment;
          return { id: "lvl-1", quantity: stockLevels[key] };
        }),
        aggregate: vi.fn(async () => {
          const sum = Object.values(stockLevels).reduce((acc, v) => acc + v, 0);
          return { _sum: { quantity: sum } };
        }),
      },
      productVariant: {
        findUnique: vi.fn(async () => ({ ...fakeVariant })),
        updateMany: vi.fn(async ({ where, data }: any) => {
          if (fakeVariant.totalQty >= where.totalQty.gte) {
            fakeVariant.totalQty -= data.totalQty.decrement;
            return { count: 1 };
          }
          return { count: 0 };
        }),
        update: vi.fn(async ({ data }: any) => {
          if (data.totalQty?.increment !== undefined) {
            fakeVariant.totalQty += data.totalQty.increment;
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

    // 1. Nhập kho 100 cái vào kệ
    await InventoryService.recordReceipt(mockTx, {
      storeId: "st-1",
      variantId: "var-1",
      locationId: "loc-1",
      quantity: 100,
    });
    expect(fakeVariant.totalQty).toBe(100);

    // 2. Bán 30 cái
    await InventoryService.recordIssue(mockTx, {
      storeId: "st-1",
      variantId: "var-1",
      locationId: "loc-1",
      quantity: 30,
      type: MovementType.SALE,
    });
    expect(fakeVariant.totalQty).toBe(70);
    expect(fakeVariant.soldCount).toBe(30);

    // 3. Khách trả 5 cái
    await InventoryService.recordReturn(mockTx, {
      storeId: "st-1",
      variantId: "var-1",
      locationId: "loc-1",
      quantity: 5,
    });
    expect(fakeVariant.totalQty).toBe(75);

    // 4. Kiểm kê chênh lệch -3
    await InventoryService.recordAdjustment(mockTx, {
      storeId: "st-1",
      variantId: "var-1",
      locationId: "loc-1",
      delta: -3,
      reason: "Hao hụt kiểm đếm",
    });
    expect(fakeVariant.totalQty).toBe(72);

    // 5. Đối soát reconcile
    const rec = await InventoryService.reconcile(mockTx, { variantId: "var-1" });
    expect(rec.isBalanced).toBe(true);
    expect(rec.movementSum).toBe(72);
    expect(rec.cachedTotal).toBe(72);

    // 6. Chặn bán vượt tồn khi số lượng yêu cầu > 72
    await expect(
      InventoryService.recordIssue(mockTx, {
        storeId: "st-1",
        variantId: "var-1",
        locationId: "loc-1",
        quantity: 80,
        type: MovementType.SALE,
      })
    ).rejects.toThrow("Không đủ hàng");
  });
});
