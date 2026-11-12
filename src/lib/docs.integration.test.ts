/**
 * Test tích hợp các chứng từ (Server Actions trong src/app/actions/docs.ts) trên PostgreSQL THẬT.
 * Chạy: TEST_DATABASE_URL="postgresql://.../novacast_test" npm run test (DB đã migrate).
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

// Phải đặt DATABASE_URL TRƯỚC khi import Prisma của app (vi.hoisted chạy trước các import)
const TEST_DB = vi.hoisted(() => {
  const url = process.env.TEST_DATABASE_URL;
  if (url) process.env.DATABASE_URL = url;
  return url;
});

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

import { PrismaClient, LocationKind } from "@prisma/client";
import { InventoryService } from "./inventoryService";
import {
  saveReceiptAction, approveReceiptAction, cancelReceiptAction,
  saveIssueAction, cancelIssueAction,
  saveSlipAction, cancelSlipAction,
  createAuditDraftAction, saveAuditCountsAction, approveAuditAction,
} from "@/app/actions/docs";

const run = TEST_DB ? describe : describe.skip;

run("Chứng từ: Nháp → Duyệt → Hủy (Postgres thật)", () => {
  const prisma = new PrismaClient({ datasourceUrl: TEST_DB });
  const tag = `D${Date.now().toString(36)}`;
  let wh: { id: string }; // kho doanh nghiệp
  let retail: { id: string };
  let other: { id: string };
  let bin: { id: string };
  let materialId: string;
  let supplierId: string;
  let otherSupplierId: string;
  let shelf: { id: string };
  let back: { id: string };
  let variantId: string;
  let customerId: string;

  const as = (s: { id: string }, type: string, role: "OWNER" | "MANAGER" | "STAFF" = "OWNER") => {
    session.store = { id: s.id, type, currentRole: role };
  };
  const matQty = async () => (await prisma.material.findUniqueOrThrow({ where: { id: materialId } })).totalQty;
  const balanced = async (item: { materialId?: string; variantId?: string }) => (await prisma.$transaction((tx) => InventoryService.reconcile(tx, item))).isBalanced;

  beforeAll(async () => {
    wh = await prisma.store.create({ data: { code: `${tag}_W`, name: "Kho test", type: "WAREHOUSE" } });
    retail = await prisma.store.create({ data: { code: `${tag}_R`, name: "Bán lẻ test", type: "RETAIL" } });
    other = await prisma.store.create({ data: { code: `${tag}_O`, name: "Kho khác", type: "WAREHOUSE" } });
    bin = await prisma.stockLocation.create({ data: { storeId: wh.id, name: "Kệ A1", kind: LocationKind.WAREHOUSE, isDefault: true } });
    materialId = (await prisma.material.create({ data: { storeId: wh.id, sku: `${tag}-M`, name: "Vải test", unit: "Cuộn", costPrice: BigInt(100000), locationBin: "Kệ A1" } })).id;
    supplierId = (await prisma.partner.create({ data: { storeId: wh.id, type: "SUPPLIER", name: "NCC test" } })).id;
    otherSupplierId = (await prisma.partner.create({ data: { storeId: other.id, type: "SUPPLIER", name: "NCC khác" } })).id;

    shelf = await prisma.stockLocation.create({ data: { storeId: retail.id, name: "Kệ", kind: LocationKind.SHELF, isDefault: true } });
    back = await prisma.stockLocation.create({ data: { storeId: retail.id, name: "Kho", kind: LocationKind.WAREHOUSE, isDefault: true } });
    const p = await prisma.product.create({
      data: { storeId: retail.id, name: "Áo test", basePrice: BigInt(200000), variants: { create: { sku: `${tag}-V`, name: "M", price: BigInt(200000), costPrice: BigInt(80000), soldCount: 10 } } },
      include: { variants: true },
    });
    variantId = p.variants[0].id;
    customerId = (await prisma.partner.create({ data: { storeId: retail.id, type: "CUSTOMER", name: "Khách test" } })).id;
  });

  afterAll(async () => {
    session.store = null;
    await prisma.store.deleteMany({ where: { id: { in: [wh.id, retail.id, other.id] } } });
    await prisma.$disconnect();
  });

  it("Phiếu nhập: nháp không đổi tồn → duyệt cộng tồn + giá vốn bình quân → hủy đảo ngược", async () => {
    as(wh, "WAREHOUSE");
    const draft = await saveReceiptAction({
      supplierId, receiptType: "PURCHASE", receiptDate: new Date().toISOString(), approve: false,
      items: [{ materialId, quantity: 100, unitCost: 120000, discountRate: 0 }],
    });
    expect(draft).toMatchObject({ success: true });
    if (!("success" in draft)) return;
    expect(draft.code).toMatch(/^PNK-\d{8}-01$/);
    expect(await matQty()).toBe(0);

    // Staff không được duyệt
    as(wh, "WAREHOUSE", "STAFF");
    expect(await approveReceiptAction(draft.id)).toHaveProperty("error");
    as(wh, "WAREHOUSE");
    expect(await approveReceiptAction(draft.id)).toMatchObject({ success: true });
    expect(await matQty()).toBe(100);
    expect(Number((await prisma.material.findUniqueOrThrow({ where: { id: materialId } })).costPrice)).toBe(120000);
    // Duyệt lần 2 bị từ chối
    expect(await approveReceiptAction(draft.id)).toHaveProperty("error");

    // Phiếu nhập thứ 2 (duyệt ngay) → giá vốn bình quân (100×120k + 100×80k)/200 = 100k
    const second = await saveReceiptAction({
      supplierId, receiptType: "SUPPLIER", receiptDate: new Date().toISOString(), approve: true,
      items: [{ materialId, quantity: 100, unitCost: 80000, discountRate: 0 }],
    });
    expect(second).toMatchObject({ success: true });
    expect(await matQty()).toBe(200);
    expect(Number((await prisma.material.findUniqueOrThrow({ where: { id: materialId } })).costPrice)).toBe(100000);

    expect(await cancelReceiptAction(draft.id)).toMatchObject({ success: true });
    expect(await matQty()).toBe(100);
    expect((await prisma.stockReceipt.findUniqueOrThrow({ where: { id: draft.id } })).status).toBe("CANCELLED");
    expect(await balanced({ materialId })).toBe(true);
  });

  it("Phiếu xuất: duyệt trừ tồn; hủy phiếu nhập khi hàng đã xuất bị chặn (không âm tồn)", async () => {
    as(wh, "WAREHOUSE");
    const second = await prisma.stockReceipt.findFirstOrThrow({ where: { storeId: wh.id, status: "APPROVED" } });
    const issue = await saveIssueAction({
      issueType: "PRODUCTION", workshop: "Xưởng May 1", issueDate: new Date().toISOString(), approve: true,
      items: [{ materialId, locationId: bin.id, quantity: 60 }],
    });
    expect(issue).toMatchObject({ success: true });
    expect(await matQty()).toBe(40);
    // Xuất vượt tồn bị chặn
    expect(await saveIssueAction({ issueType: "PRODUCTION", workshop: "X", issueDate: new Date().toISOString(), approve: true, items: [{ materialId, locationId: bin.id, quantity: 999 }] })).toHaveProperty("error");
    // Hủy phiếu nhập 100 khi chỉ còn 40 → chặn
    const res = await cancelReceiptAction(second.id);
    expect(res).toHaveProperty("error");
    expect(await matQty()).toBe(40);
    expect((await prisma.stockReceipt.findUniqueOrThrow({ where: { id: second.id } })).status).toBe("APPROVED");
    // Hủy phiếu xuất → cộng trả 60
    if ("success" in issue) expect(await cancelIssueAction(issue.id)).toMatchObject({ success: true });
    expect(await matQty()).toBe(100);
    expect(await balanced({ materialId })).toBe(true);
  });

  it("Không dùng được NCC / dữ liệu của kho khác", async () => {
    as(wh, "WAREHOUSE");
    expect(
      await saveReceiptAction({ supplierId: otherSupplierId, receiptDate: new Date().toISOString(), approve: true, items: [{ materialId, quantity: 1, unitCost: 1, discountRate: 0 }] })
    ).toHaveProperty("error");
    as(other, "WAREHOUSE");
    expect(
      await saveReceiptAction({ supplierId: otherSupplierId, receiptDate: new Date().toISOString(), approve: true, items: [{ materialId, quantity: 1, unitCost: 1, discountRate: 0 }] })
    ).toHaveProperty("error");
    expect(await matQty()).toBe(100);
  });

  it("Kiểm kê: tạo phiên (chốt tồn) → lưu số đếm nháp → duyệt cân bằng; duyệt lại bị từ chối", async () => {
    as(wh, "WAREHOUSE");
    const created = await createAuditDraftAction({});
    expect(created).toMatchObject({ success: true });
    if (!("success" in created)) return;
    const item = await prisma.stockAuditItem.findFirstOrThrow({ where: { auditId: created.id, materialId } });
    expect(item.systemQty).toBe(100);
    // Thiếu lý do → không cho cân bằng
    expect(await saveAuditCountsAction({ auditId: created.id, items: [{ itemId: item.id, actualQty: 95 }] })).toMatchObject({ success: true });
    expect(await matQty()).toBe(100);
    expect(await approveAuditAction(created.id)).toHaveProperty("error");
    expect(await saveAuditCountsAction({ auditId: created.id, items: [{ itemId: item.id, actualQty: 95, reason: "Hao hụt" }] })).toMatchObject({ success: true });
    as(wh, "WAREHOUSE", "STAFF");
    expect(await approveAuditAction(created.id)).toHaveProperty("error");
    as(wh, "WAREHOUSE");
    expect(await approveAuditAction(created.id)).toMatchObject({ success: true, adjusted: 1 });
    expect(await matQty()).toBe(95);
    expect(await approveAuditAction(created.id)).toHaveProperty("error");
    expect(await balanced({ materialId })).toBe(true);
  });

  it("Phiếu bán lẻ: chuyển kho → khách trả hàng → xuất hủy → hủy phiếu", async () => {
    as(retail, "RETAIL");
    await prisma.$transaction((tx) => InventoryService.recordReceipt(tx, { storeId: retail.id, variantId, locationId: back.id, quantity: 20 }));
    const transfer = await saveSlipAction({ kind: "TRANSFER", fromLocationId: back.id, toLocationId: shelf.id, slipDate: new Date().toISOString(), approve: true, items: [{ variantId, quantity: 8, unitPrice: 0 }] });
    expect(transfer).toMatchObject({ success: true });
    const lvl = async (loc: string) => (await prisma.stockLevel.findFirst({ where: { locationId: loc, variantId } }))?.quantity ?? 0;
    expect(await lvl(shelf.id)).toBe(8);
    expect(await lvl(back.id)).toBe(12);

    const ret = await saveSlipAction({ kind: "CUSTOMER_RETURN", partnerId: customerId, condition: "GOOD", slipDate: new Date().toISOString(), approve: false, items: [{ variantId, quantity: 2, unitPrice: 200000 }] });
    expect(ret).toMatchObject({ success: true });
    expect(await lvl(shelf.id)).toBe(8); // nháp: chưa đổi tồn
    if (!("success" in ret)) return;
    expect(ret.code).toMatch(/^PRH-/);
    const approved = await saveSlipAction({ id: ret.id, kind: "CUSTOMER_RETURN", partnerId: customerId, condition: "GOOD", slipDate: new Date().toISOString(), approve: true, items: [{ variantId, quantity: 2, unitPrice: 200000 }] });
    expect(approved).toMatchObject({ success: true });
    expect(await lvl(shelf.id)).toBe(10);

    // Trả vượt số đã bán bị chặn
    expect(await saveSlipAction({ kind: "CUSTOMER_RETURN", partnerId: customerId, condition: "GOOD", slipDate: new Date().toISOString(), approve: true, items: [{ variantId, quantity: 50, unitPrice: 1 }] })).toHaveProperty("error");

    // Xuất hủy cần quyền quản lý
    as(retail, "RETAIL", "STAFF");
    expect(await saveSlipAction({ kind: "DISPOSE", fromLocationId: shelf.id, slipDate: new Date().toISOString(), approve: true, items: [{ variantId, quantity: 1, unitPrice: 0 }] })).toHaveProperty("error");
    as(retail, "RETAIL");
    const disp = await saveSlipAction({ kind: "DISPOSE", fromLocationId: shelf.id, slipDate: new Date().toISOString(), approve: true, items: [{ variantId, quantity: 1, unitPrice: 0 }] });
    expect(disp).toMatchObject({ success: true });
    expect(await lvl(shelf.id)).toBe(9);

    // Hủy phiếu chuyển kho → trả 8 về kho
    if ("success" in transfer) expect(await cancelSlipAction(transfer.id)).toMatchObject({ success: true });
    expect(await lvl(shelf.id)).toBe(1);
    expect(await lvl(back.id)).toBe(20);
    expect(await balanced({ variantId })).toBe(true);
  });
});
