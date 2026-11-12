/**
 * Test tích hợp chạy trên PostgreSQL THẬT (không mock Prisma).
 *
 * Chạy:  TEST_DATABASE_URL="postgresql://.../novacast_test" npm run test
 * Database phải đã được migrate (npx prisma migrate deploy). Test tự tạo dữ liệu riêng
 * (store có mã ngẫu nhiên) nên không ảnh hưởng dữ liệu khác.
 * Không có TEST_DATABASE_URL → toàn bộ file được bỏ qua.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

// Phải đặt DATABASE_URL TRƯỚC khi import Prisma của app (vi.hoisted chạy trước các import)
const TEST_DB = vi.hoisted(() => {
  const url = process.env.TEST_DATABASE_URL;
  if (url) process.env.DATABASE_URL = url;
  return url;
});

// Giả lập "người dùng đang đăng nhập ở cửa hàng nào" — phần còn lại (Prisma, InventoryService,
// Server Actions) chạy thật trên database.
const session = vi.hoisted(() => ({
  store: null as null | { id: string; type: string; currentRole: "OWNER" | "MANAGER" | "STAFF" },
}));
vi.mock("@/lib/auth", () => ({
  getCurrentStore: vi.fn(async (type?: string) => {
    if (!session.store) throw new Error("Chưa đăng nhập");
    if (type && session.store.type !== type) throw new Error("Sai loại cửa hàng");
    return session.store;
  }),
  getCurrentUser: vi.fn(async () => ({ id: "test-user", fullName: "Người test", phone: "0", role: "OWNER" })),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { PrismaClient, LocationKind, MovementType } from "@prisma/client";
import { InventoryService } from "./inventoryService";
import {
  balanceStockAuditAction,
  checkoutPosAction,
  completeRetailReceivingAction,
  customerReturnAction,
  transferStockAction,
  updateOrderStatusAction,
  updateProductDiscountAction,
} from "@/app/actions/inventory";

const run = TEST_DB ? describe : describe.skip;

run("Tồn kho trên Postgres thật", () => {
  const prisma = new PrismaClient({ datasourceUrl: TEST_DB });
  const tag = `T${Date.now().toString(36)}`;
  let storeA: { id: string };
  let storeB: { id: string };
  let shelf: { id: string };
  let wh: { id: string };
  let variantId: string;
  let foreignVariantId: string;
  let foreignProductId: string;

  const reconcile = () => prisma.$transaction((tx) => InventoryService.reconcile(tx, { variantId }));
  const variant = () => prisma.productVariant.findUniqueOrThrow({ where: { id: variantId } });
  const levelAt = async (locationId: string) =>
    (await prisma.stockLevel.findFirst({ where: { locationId, variantId } }))?.quantity ?? 0;
  const actAs = (store: { id: string }, type = "RETAIL", role: "OWNER" | "MANAGER" | "STAFF" = "OWNER") => {
    session.store = { id: store.id, type, currentRole: role };
  };

  beforeAll(async () => {
    storeA = await prisma.store.create({ data: { code: `${tag}_A`, name: "Test A", type: "RETAIL" } });
    storeB = await prisma.store.create({ data: { code: `${tag}_B`, name: "Test B", type: "FOOD" } });
    shelf = await prisma.stockLocation.create({
      data: { storeId: storeA.id, name: "Kệ", kind: LocationKind.SHELF, isDefault: true },
    });
    wh = await prisma.stockLocation.create({
      data: { storeId: storeA.id, name: "Kho", kind: LocationKind.WAREHOUSE, isDefault: true },
    });
    const product = await prisma.product.create({
      data: {
        storeId: storeA.id,
        name: "Áo thun test",
        variants: {
          create: { sku: `${tag}-AT`, name: "Trắng / M", costPrice: BigInt(50000), price: BigInt(100000) },
        },
      },
      include: { variants: true },
    });
    variantId = product.variants[0].id;

    const foreign = await prisma.product.create({
      data: {
        storeId: storeB.id,
        name: "Món của store khác",
        basePrice: BigInt(30000),
        variants: { create: { sku: `${tag}-FX`, name: "Mặc định", price: BigInt(30000) } },
      },
      include: { variants: true },
    });
    foreignProductId = foreign.id;
    foreignVariantId = foreign.variants[0].id;
  });

  afterAll(async () => {
    session.store = null;
    await prisma.store.deleteMany({ where: { id: { in: [storeA.id, storeB.id] } } });
    await prisma.$disconnect();
  });

  it("Kịch bản: nhập 100 → chuyển 50 ra kệ → POS bán 30 → khách trả 5 → kiểm kê kệ còn 22 → cân bằng", async () => {
    actAs(storeA);
    const rec = await completeRetailReceivingAction({
      supplierName: "NCC Test",
      items: [{ variantId, quantity: 100, costPrice: 50000, discountRate: 0 }],
    });
    expect(rec).toMatchObject({ success: true });
    expect((await variant()).totalQty).toBe(100);
    expect(await levelAt(wh.id)).toBe(100);

    // POS bán từ Kệ — Kệ đang trống nên phải bị chặn
    const empty = await checkoutPosAction({ items: [{ variantId, quantity: 1 }], paymentMethod: "CASH" });
    expect(empty).toHaveProperty("error");

    const levelWh = await prisma.stockLevel.findFirstOrThrow({ where: { locationId: wh.id, variantId } });
    expect(await transferStockAction({ stockLevelId: levelWh.id, toLocationId: shelf.id, quantity: 50 })).toMatchObject({ success: true });
    expect(await levelAt(wh.id)).toBe(50);
    expect(await levelAt(shelf.id)).toBe(50);
    expect((await variant()).totalQty).toBe(100);

    const sale = await checkoutPosAction({ items: [{ variantId, quantity: 30 }], paymentMethod: "CASH" });
    expect(sale).toMatchObject({ success: true });
    let v = await variant();
    expect(v.totalQty).toBe(70);
    expect(v.shelfQty).toBe(20);
    expect(v.soldCount).toBe(30);

    expect(
      await customerReturnAction({ customerName: "Khách A", condition: "GOOD", items: [{ variantId, quantity: 5 }] })
    ).toMatchObject({ success: true });
    expect(await levelAt(shelf.id)).toBe(25);

    // Kiểm kê: kệ đếm được 22 (thiếu 3)
    const shelfLevel = await prisma.stockLevel.findFirstOrThrow({ where: { locationId: shelf.id, variantId } });
    const audit = await balanceStockAuditAction({
      counts: [{ stockLevelId: shelfLevel.id, actualQty: 22, reason: "Mất hàng" }],
    });
    expect(audit).toMatchObject({ success: true, adjusted: 1 });
    v = await variant();
    expect(v.totalQty).toBe(72);
    expect(await levelAt(shelf.id)).toBe(22);

    const savedAudit = await prisma.stockAudit.findFirstOrThrow({
      where: { storeId: storeA.id },
      include: { items: true },
    });
    expect(savedAudit.status).toBe("APPROVED");
    expect(savedAudit.items[0]).toMatchObject({ systemQty: 25, actualQty: 22, variance: -3, locationId: shelf.id });

    expect((await reconcile()).isBalanced).toBe(true);
  });

  it("Hủy phiếu nhập sau khi đã bán bị chặn (không để âm tồn)", async () => {
    const receiptMove = await prisma.stockMovement.findFirstOrThrow({
      where: { variantId, type: MovementType.RECEIPT },
    });
    // Kho còn 50 nhưng phiếu nhập là 100 → đảo ngược phải bị chặn
    await expect(
      prisma.$transaction((tx) => InventoryService.reverseMovement(tx, receiptMove.id, "Nhập nhầm"))
    ).rejects.toThrow(/âm tồn/);
    expect(await levelAt(wh.id)).toBe(50);
    expect((await reconcile()).isBalanced).toBe(true);
  });

  it("2 đơn POS đồng thời vượt tồn kệ: chỉ 1 đơn thành công", async () => {
    actAs(storeA);
    const onShelf = await levelAt(shelf.id); // 22
    const [r1, r2] = await Promise.all([
      checkoutPosAction({ items: [{ variantId, quantity: onShelf - 2 }], paymentMethod: "CASH" }),
      checkoutPosAction({ items: [{ variantId, quantity: onShelf - 2 }], paymentMethod: "CASH" }),
    ]);
    const ok = [r1, r2].filter((r) => "success" in r).length;
    expect(ok).toBe(1);
    expect(await levelAt(shelf.id)).toBe(2);
    expect((await reconcile()).isBalanced).toBe(true);
  });

  it("POS lấy giá từ DB, áp giảm giá của biến thể", async () => {
    actAs(storeA);
    await prisma.productVariant.update({ where: { id: variantId }, data: { discountPercent: 10 } });
    const res = await checkoutPosAction({ items: [{ variantId, quantity: 1 }], paymentMethod: "CASH" });
    expect(res).toMatchObject({ success: true });
    if (!("success" in res)) return;
    const order = await prisma.order.findFirstOrThrow({ where: { code: res.orderCode } });
    expect(Number(order.totalAmount)).toBe(90000);
  });

  it("Hàng lỗi trả về không bán được và đối soát vẫn khớp", async () => {
    actAs(storeA);
    expect(
      await customerReturnAction({ customerName: "Khách B", condition: "DAMAGED", items: [{ variantId, quantity: 1 }] })
    ).toMatchObject({ success: true });
    const damaged = await prisma.stockLocation.findFirstOrThrow({
      where: { storeId: storeA.id, kind: LocationKind.DAMAGED },
    });
    expect(await levelAt(damaged.id)).toBe(1);
    await expect(
      prisma.$transaction((tx) =>
        InventoryService.recordIssue(tx, {
          storeId: storeA.id,
          variantId,
          locationId: damaged.id,
          quantity: 1,
          type: MovementType.SALE,
        })
      )
    ).rejects.toThrow(/Hàng Lỗi/);
    expect((await reconcile()).isBalanced).toBe(true);
  });

  it("Không trả hàng vượt số đã bán", async () => {
    actAs(storeA);
    const v = await variant();
    const res = await customerReturnAction({
      customerName: "Khách C",
      condition: "GOOD",
      items: [{ variantId, quantity: v.soldCount + 1 }],
    });
    expect(res).toHaveProperty("error");
  });

  it("Phân quyền & cách ly cửa hàng", async () => {
    // Staff không được cân bằng kho
    actAs(storeA, "RETAIL", "STAFF");
    const lvl = await prisma.stockLevel.findFirstOrThrow({ where: { locationId: shelf.id, variantId } });
    expect(await balanceStockAuditAction({ counts: [{ stockLevelId: lvl.id, actualQty: 0, reason: "x" }] })).toHaveProperty("error");

    // Store B không cân bằng được tồn của store A
    actAs(storeB, "FOOD", "OWNER");
    expect(await balanceStockAuditAction({ counts: [{ stockLevelId: lvl.id, actualQty: 0, reason: "x" }] })).toHaveProperty("error");
    expect(await levelAt(shelf.id)).toBe(lvl.quantity);

    // Store A không sửa giảm giá món của store B
    actAs(storeA, "FOOD", "OWNER");
    session.store!.id = storeA.id;
    expect(await updateProductDiscountAction(foreignProductId, 20)).toHaveProperty("error");
    expect((await prisma.product.findUniqueOrThrow({ where: { id: foreignProductId } })).discountPercent).toBe(0);

    // Store A không bán được hàng của store B
    actAs(storeA);
    expect(await checkoutPosAction({ items: [{ variantId: foreignVariantId, quantity: 1 }], paymentMethod: "CASH" })).toHaveProperty("error");
  });

  it("Trạng thái đơn chỉ đi theo luồng hợp lệ", async () => {
    actAs(storeA);
    const order = await prisma.order.create({
      data: { code: `${tag}-ORD`, storeId: storeA.id, customerName: "Khách D" },
    });
    expect(await updateOrderStatusAction(order.id, "COMPLETED")).toHaveProperty("error");
    expect(await updateOrderStatusAction(order.id, "CONFIRMED")).toMatchObject({ success: true });
    expect(await updateOrderStatusAction(order.id, "PENDING")).toHaveProperty("error");
  });
});
