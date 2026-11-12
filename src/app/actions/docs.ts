"use server";

/**
 * Chứng từ kho: Phiếu nhập (PNH bán lẻ / PNK kho), Phiếu xuất kho (PXK), Phiếu bán lẻ
 * (Khách trả hàng PRH / Xuất hủy PXH / Chuyển kho PCK) và Phiếu kiểm kê (PKK).
 * Luồng chung: Lưu tạm (DRAFT, không đổi tồn) → Duyệt (APPROVED, ghi sổ cái qua InventoryService)
 * → Hủy (CANCELLED; nếu đã duyệt thì đảo ngược movement, không cho âm tồn).
 */
import { prisma } from "@/lib/prisma";
import { InventoryService } from "@/lib/inventoryService";
import { requireStore, errorMessage, nextDocCode, type ActionResult } from "@/lib/guard";
import { IssueType, LocationKind, MovementType, Prisma, Role, SlipKind } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const TX_OPTS = { timeout: 30_000, maxWait: 10_000 };

function revalidateModule(storeType: string) {
  if (storeType === "RETAIL") {
    for (const p of ["/retail", "/retail/receiving", "/retail/returns", "/retail/products", "/retail/vouchers", "/retail/audit", "/retail/pos"]) revalidatePath(p);
  } else if (storeType === "WAREHOUSE") {
    for (const p of ["/warehouse", "/warehouse/receipts", "/warehouse/issues", "/warehouse/items", "/warehouse/audit"]) revalidatePath(p);
  }
}

/** Đảo ngược toàn bộ movement của một chứng từ (dùng khi hủy chứng từ đã duyệt) */
async function reverseDocMovements(tx: Prisma.TransactionClient, storeId: string, docId: string, reason: string, by?: string) {
  const moves = await tx.stockMovement.findMany({
    where: { storeId, refId: docId, NOT: { refType: { startsWith: "CANCEL_" } } },
    orderBy: { createdAt: "desc" },
  });
  for (const m of moves) await InventoryService.reverseMovement(tx, m.id, reason, by);
}

/** Cập nhật giá vốn bình quân gia quyền trước khi cộng tồn */
async function updateWeightedCost(
  tx: Prisma.TransactionClient,
  item: { variantId?: string | null; materialId?: string | null },
  qty: number,
  unitCost: number
) {
  if (item.variantId) {
    const v = await tx.productVariant.findUniqueOrThrow({ where: { id: item.variantId } });
    const oldQty = Math.max(0, v.totalQty);
    const cost = Math.round((oldQty * Number(v.costPrice) + qty * unitCost) / (oldQty + qty));
    await tx.productVariant.update({ where: { id: v.id }, data: { costPrice: BigInt(cost) } });
  } else if (item.materialId) {
    const m = await tx.material.findUniqueOrThrow({ where: { id: item.materialId } });
    const oldQty = Math.max(0, m.totalQty);
    const cost = Math.round((oldQty * Number(m.costPrice) + qty * unitCost) / (oldQty + qty));
    await tx.material.update({ where: { id: m.id }, data: { costPrice: BigInt(cost) } });
  }
}

// =============================================================================
// 1. PHIẾU NHẬP (bán lẻ: PNH, kho doanh nghiệp: PNK)
// =============================================================================
const receiptSchema = z.object({
  id: z.string().optional(),
  receiptType: z.enum(["PURCHASE", "SUPPLIER", "PRODUCTION", "RETURN"]).default("SUPPLIER"),
  supplierId: z.string().min(1, "Vui lòng chọn nhà cung cấp"),
  receiptDate: z.string().min(1),
  note: z.string().max(500).optional(),
  approve: z.boolean().default(false),
  items: z
    .array(
      z.object({
        variantId: z.string().optional(),
        materialId: z.string().optional(),
        locationId: z.string().optional(),
        quantity: z.number().int().positive("Số lượng nhập phải lớn hơn 0"),
        unitCost: z.number().int().nonnegative("Giá nhập không hợp lệ"),
        discountRate: z.number().min(0).max(100).default(0),
      })
    )
    .min(1, "Vui lòng thêm ít nhất một sản phẩm"),
});

const lineNet = (it: { quantity: number; unitCost: number; discountRate: number }) =>
  Math.round(it.quantity * it.unitCost * (1 - it.discountRate / 100));

export async function saveReceiptAction(input: z.input<typeof receiptSchema>): Promise<ActionResult<{ id: string; code: string }>> {
  try {
    const parsed = receiptSchema.safeParse(input);
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dữ liệu phiếu nhập không hợp lệ" };
    const data = parsed.data;
    const store = await requireStore(undefined, data.approve ? Role.MANAGER : Role.STAFF);
    if (store.type === "FOOD") return { error: "Cửa hàng đồ ăn không dùng phiếu nhập kho" };
    const isRetail = store.type === "RETAIL";

    const supplier = await prisma.partner.findFirst({ where: { id: data.supplierId, storeId: store.id, deletedAt: null } });
    if (!supplier) return { error: "Nhà cung cấp không thuộc cửa hàng này" };

    // Kiểm tra mặt hàng & vị trí thuộc store; xác định vị trí nhập
    const defaultWh = await prisma.stockLocation.findFirst({
      where: { storeId: store.id, kind: LocationKind.WAREHOUSE },
      orderBy: { isDefault: "desc" },
    });
    const lines: { variantId?: string; materialId?: string; locationId: string; quantity: number; unitCost: number; discountRate: number }[] = [];
    for (const it of data.items) {
      if (isRetail) {
        if (!it.variantId) return { error: "Thiếu sản phẩm ở một dòng" };
        const v = await prisma.productVariant.findFirst({ where: { id: it.variantId, product: { storeId: store.id } } });
        if (!v) return { error: "Có sản phẩm không thuộc cửa hàng này" };
      } else {
        if (!it.materialId) return { error: "Thiếu vật tư ở một dòng" };
        const m = await prisma.material.findFirst({ where: { id: it.materialId, storeId: store.id } });
        if (!m) return { error: "Có vật tư không thuộc kho này" };
        if (!it.locationId && m.locationBin) {
          const loc = await prisma.stockLocation.findFirst({ where: { storeId: store.id, name: m.locationBin } });
          if (loc) it.locationId = loc.id;
        }
      }
      let locationId = it.locationId ?? defaultWh?.id;
      if (it.locationId) {
        const loc = await prisma.stockLocation.findFirst({ where: { id: it.locationId, storeId: store.id } });
        if (!loc) return { error: "Vị trí nhập không thuộc cửa hàng này" };
        locationId = loc.id;
      }
      if (!locationId) return { error: "Cửa hàng chưa có vị trí kho để nhập hàng" };
      lines.push({ variantId: it.variantId, materialId: it.materialId, locationId, quantity: it.quantity, unitCost: it.unitCost, discountRate: it.discountRate });
    }
    const total = lines.reduce((s, l) => s + lineNet(l), 0);
    const receiptDate = new Date(data.receiptDate);
    if (Number.isNaN(receiptDate.getTime())) return { error: "Ngày nhập không hợp lệ" };

    const result = await prisma.$transaction(async (tx) => {
      let receiptId = data.id;
      let code: string;
      const itemsData = lines.map((l) => ({
        variantId: l.variantId, materialId: l.materialId, locationId: l.locationId, quantity: l.quantity,
        unitCost: BigInt(l.unitCost), discountRate: l.discountRate, totalAmount: BigInt(lineNet(l)),
      }));
      if (receiptId) {
        const existing = await tx.stockReceipt.findFirst({ where: { id: receiptId, storeId: store.id } });
        if (!existing) throw new Error("Không tìm thấy phiếu nhập");
        if (existing.status !== "DRAFT") throw new Error("Chỉ sửa được phiếu đang lưu tạm (Nháp)");
        code = existing.code;
        await tx.stockReceiptItem.deleteMany({ where: { receiptId } });
        await tx.stockReceipt.update({
          where: { id: receiptId },
          data: { supplierId: supplier.id, receiptType: data.receiptType, receiptDate, note: data.note, totalAmount: BigInt(total), items: { create: itemsData } },
        });
      } else {
        code = await nextDocCode(tx, "stockReceipt", store.id, isRetail ? "PNH" : "PNK", receiptDate);
        const created = await tx.stockReceipt.create({
          data: {
            storeId: store.id, code, supplierId: supplier.id, receiptType: data.receiptType, receiptDate, note: data.note,
            status: "DRAFT", totalAmount: BigInt(total), createdBy: store.userId, createdByName: store.userName, items: { create: itemsData },
          },
        });
        receiptId = created.id;
      }
      if (data.approve) await approveReceiptTx(tx, store.id, receiptId!);
      return { id: receiptId!, code };
    }, TX_OPTS);

    revalidateModule(store.type);
    return { success: true, ...result };
  } catch (e) {
    return { error: errorMessage(e, "Lỗi lưu phiếu nhập") };
  }
}

async function approveReceiptTx(tx: Prisma.TransactionClient, storeId: string, receiptId: string) {
  const r = await tx.stockReceipt.findFirst({ where: { id: receiptId, storeId }, include: { items: true } });
  if (!r) throw new Error("Không tìm thấy phiếu nhập");
  if (r.status !== "DRAFT") throw new Error("Phiếu đã được duyệt hoặc đã hủy");
  const res = await tx.stockReceipt.updateMany({ where: { id: r.id, status: "DRAFT" }, data: { status: "APPROVED" } });
  if (res.count === 0) throw new Error("Phiếu vừa được người khác xử lý");
  for (const it of r.items) {
    if (!it.locationId) throw new Error("Dòng phiếu thiếu vị trí nhập");
    const net = Math.round(Number(it.unitCost) * (1 - it.discountRate / 100));
    await updateWeightedCost(tx, it, it.quantity, net);
    await InventoryService.recordReceipt(tx, {
      storeId, variantId: it.variantId ?? undefined, materialId: it.materialId ?? undefined, locationId: it.locationId,
      quantity: it.quantity, unitCost: BigInt(net), refType: "RECEIPT", refId: r.id, note: `Nhập theo phiếu ${r.code}`,
    });
  }
}

export async function approveReceiptAction(id: string): Promise<ActionResult> {
  try {
    const store = await requireStore(undefined, Role.MANAGER);
    await prisma.$transaction((tx) => approveReceiptTx(tx, store.id, id), TX_OPTS);
    revalidateModule(store.type);
    return { success: true };
  } catch (e) {
    return { error: errorMessage(e, "Lỗi duyệt phiếu nhập") };
  }
}

export async function cancelReceiptAction(id: string): Promise<ActionResult> {
  try {
    const store = await requireStore(undefined, Role.MANAGER);
    await prisma.$transaction(async (tx) => {
      const r = await tx.stockReceipt.findFirst({ where: { id, storeId: store.id } });
      if (!r) throw new Error("Không tìm thấy phiếu nhập");
      if (r.status === "CANCELLED") throw new Error("Phiếu đã hủy trước đó");
      if (r.status === "APPROVED") await reverseDocMovements(tx, store.id, r.id, `Hủy phiếu ${r.code}`, store.userName);
      await tx.stockReceipt.update({ where: { id: r.id }, data: { status: "CANCELLED" } });
    }, TX_OPTS);
    revalidateModule(store.type);
    return { success: true };
  } catch (e) {
    return { error: errorMessage(e, "Lỗi hủy phiếu nhập") };
  }
}

// =============================================================================
// 2. PHIẾU XUẤT KHO (kho doanh nghiệp: PXK)
// =============================================================================
const issueSchema = z.object({
  id: z.string().optional(),
  issueType: z.enum(["PRODUCTION", "CUSTOMER", "DISPOSE"]),
  workshop: z.string().trim().min(1, "Vui lòng nhập nơi nhận (xưởng / khách hàng)").max(200),
  issueDate: z.string().min(1),
  note: z.string().max(500).optional(),
  approve: z.boolean().default(false),
  items: z
    .array(
      z.object({
        materialId: z.string().min(1),
        locationId: z.string().optional(),
        quantity: z.number().int().positive("Số lượng xuất phải lớn hơn 0"),
        unitCost: z.number().int().nonnegative().optional(),
      })
    )
    .min(1, "Vui lòng thêm ít nhất một vật tư"),
});

export async function saveIssueAction(input: z.input<typeof issueSchema>): Promise<ActionResult<{ id: string; code: string }>> {
  try {
    const parsed = issueSchema.safeParse(input);
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dữ liệu phiếu xuất không hợp lệ" };
    const data = parsed.data;
    const store = await requireStore("WAREHOUSE", data.approve ? Role.MANAGER : Role.STAFF);
    const issueDate = new Date(data.issueDate);
    if (Number.isNaN(issueDate.getTime())) return { error: "Ngày chứng từ không hợp lệ" };

    const lines: { materialId: string; locationId: string; quantity: number; unitCost: number }[] = [];
    for (const it of data.items) {
      const m = await prisma.material.findFirst({ where: { id: it.materialId, storeId: store.id } });
      if (!m) return { error: "Có vật tư không thuộc kho này" };
      let locationId = it.locationId;
      if (locationId) {
        if (!(await prisma.stockLocation.findFirst({ where: { id: locationId, storeId: store.id } }))) return { error: "Vị trí xuất không thuộc kho này" };
      } else {
        const lvl = await prisma.stockLevel.findFirst({ where: { storeId: store.id, materialId: m.id }, orderBy: { quantity: "desc" } });
        locationId = lvl?.locationId;
      }
      if (!locationId) return { error: `Vật tư ${m.sku} chưa có tồn ở vị trí nào` };
      lines.push({ materialId: m.id, locationId, quantity: it.quantity, unitCost: it.unitCost ?? Number(m.costPrice) });
    }
    const total = lines.reduce((s, l) => s + l.quantity * l.unitCost, 0);

    const result = await prisma.$transaction(async (tx) => {
      let issueId = data.id;
      let code: string;
      const itemsData = lines.map((l) => ({ materialId: l.materialId, locationId: l.locationId, quantity: l.quantity, unitCost: BigInt(l.unitCost), totalAmount: BigInt(l.quantity * l.unitCost) }));
      if (issueId) {
        const existing = await tx.stockIssue.findFirst({ where: { id: issueId, storeId: store.id } });
        if (!existing) throw new Error("Không tìm thấy phiếu xuất");
        if (existing.status !== "DRAFT") throw new Error("Chỉ sửa được phiếu đang lưu tạm (Nháp)");
        code = existing.code;
        await tx.stockIssueItem.deleteMany({ where: { issueId } });
        await tx.stockIssue.update({
          where: { id: issueId },
          data: { issueType: data.issueType as IssueType, workshop: data.workshop, issueDate, note: data.note, totalAmount: BigInt(total), items: { create: itemsData } },
        });
      } else {
        code = await nextDocCode(tx, "stockIssue", store.id, "PXK", issueDate);
        issueId = (
          await tx.stockIssue.create({
            data: {
              storeId: store.id, code, issueType: data.issueType as IssueType, workshop: data.workshop, issueDate, note: data.note,
              status: "DRAFT", totalAmount: BigInt(total), createdBy: store.userId, createdByName: store.userName, items: { create: itemsData },
            },
          })
        ).id;
      }
      if (data.approve) await approveIssueTx(tx, store.id, issueId!);
      return { id: issueId!, code };
    }, TX_OPTS);

    revalidateModule("WAREHOUSE");
    return { success: true, ...result };
  } catch (e) {
    return { error: errorMessage(e, "Lỗi lưu phiếu xuất") };
  }
}

async function approveIssueTx(tx: Prisma.TransactionClient, storeId: string, issueId: string) {
  const s = await tx.stockIssue.findFirst({ where: { id: issueId, storeId }, include: { items: true } });
  if (!s) throw new Error("Không tìm thấy phiếu xuất");
  if (s.status !== "DRAFT") throw new Error("Phiếu đã được duyệt hoặc đã hủy");
  const res = await tx.stockIssue.updateMany({ where: { id: s.id, status: "DRAFT" }, data: { status: "APPROVED" } });
  if (res.count === 0) throw new Error("Phiếu vừa được người khác xử lý");
  for (const it of s.items) {
    if (!it.locationId) throw new Error("Dòng phiếu thiếu vị trí xuất");
    await InventoryService.recordIssue(tx, {
      storeId, variantId: it.variantId ?? undefined, materialId: it.materialId ?? undefined, locationId: it.locationId, quantity: it.quantity,
      unitCost: it.unitCost, type: s.issueType === "DISPOSE" ? MovementType.DISPOSE : MovementType.ISSUE, refType: "ISSUE", refId: s.id,
      note: `Xuất theo phiếu ${s.code}`,
    });
  }
}

export async function approveIssueAction(id: string): Promise<ActionResult> {
  try {
    const store = await requireStore("WAREHOUSE", Role.MANAGER);
    await prisma.$transaction((tx) => approveIssueTx(tx, store.id, id), TX_OPTS);
    revalidateModule("WAREHOUSE");
    return { success: true };
  } catch (e) {
    return { error: errorMessage(e, "Lỗi duyệt phiếu xuất") };
  }
}

export async function cancelIssueAction(id: string): Promise<ActionResult> {
  try {
    const store = await requireStore("WAREHOUSE", Role.MANAGER);
    await prisma.$transaction(async (tx) => {
      const s = await tx.stockIssue.findFirst({ where: { id, storeId: store.id } });
      if (!s) throw new Error("Không tìm thấy phiếu xuất");
      if (s.status === "CANCELLED") throw new Error("Phiếu đã hủy trước đó");
      if (s.status === "APPROVED") await reverseDocMovements(tx, store.id, s.id, `Hủy phiếu ${s.code}`, store.userName);
      await tx.stockIssue.update({ where: { id: s.id }, data: { status: "CANCELLED" } });
    }, TX_OPTS);
    revalidateModule("WAREHOUSE");
    return { success: true };
  } catch (e) {
    return { error: errorMessage(e, "Lỗi hủy phiếu xuất") };
  }
}

// =============================================================================
// 3. PHIẾU BÁN LẺ: KHÁCH TRẢ HÀNG (PRH) · XUẤT HỦY (PXH) · CHUYỂN KHO (PCK)
// =============================================================================
const slipSchema = z.object({
  id: z.string().optional(),
  kind: z.nativeEnum(SlipKind),
  customerName: z.string().trim().max(200).optional(),
  partnerId: z.string().optional(),
  condition: z.enum(["GOOD", "DAMAGED"]).optional(),
  fromLocationId: z.string().optional(),
  toLocationId: z.string().optional(),
  slipDate: z.string().min(1),
  note: z.string().max(500).optional(),
  approve: z.boolean().default(false),
  items: z
    .array(z.object({ variantId: z.string().min(1), quantity: z.number().int().positive("Số lượng phải lớn hơn 0"), unitPrice: z.number().int().nonnegative().default(0) }))
    .min(1, "Vui lòng thêm ít nhất một sản phẩm"),
});

const SLIP_PREFIX: Record<SlipKind, string> = { CUSTOMER_RETURN: "PRH", DISPOSE: "PXH", TRANSFER: "PCK" };

export async function saveSlipAction(input: z.input<typeof slipSchema>): Promise<ActionResult<{ id: string; code: string }>> {
  try {
    const parsed = slipSchema.safeParse(input);
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dữ liệu phiếu không hợp lệ" };
    const data = parsed.data;
    const needManager = data.approve && data.kind === SlipKind.DISPOSE;
    const store = await requireStore("RETAIL", needManager ? Role.MANAGER : Role.STAFF);
    const slipDate = new Date(data.slipDate);
    if (Number.isNaN(slipDate.getTime())) return { error: "Ngày chứng từ không hợp lệ" };

    let customerName = data.customerName;
    if (data.kind === SlipKind.CUSTOMER_RETURN) {
      if (data.partnerId) {
        const p = await prisma.partner.findFirst({ where: { id: data.partnerId, storeId: store.id } });
        if (!p) return { error: "Khách hàng không thuộc cửa hàng này" };
        customerName = p.name;
      }
      if (!customerName) return { error: "Vui lòng chọn khách hàng" };
      if (!data.condition) return { error: "Vui lòng chọn tình trạng hàng" };
    }
    if (data.kind !== SlipKind.CUSTOMER_RETURN) {
      if (!data.fromLocationId) return { error: "Vui lòng chọn vị trí nguồn" };
      if (!(await prisma.stockLocation.findFirst({ where: { id: data.fromLocationId, storeId: store.id } }))) return { error: "Vị trí nguồn không thuộc cửa hàng" };
    }
    if (data.kind === SlipKind.TRANSFER) {
      if (!data.toLocationId) return { error: "Vui lòng chọn vị trí đích" };
      if (data.toLocationId === data.fromLocationId) return { error: "Vị trí nguồn và đích phải khác nhau" };
      const to = await prisma.stockLocation.findFirst({ where: { id: data.toLocationId, storeId: store.id } });
      if (!to) return { error: "Vị trí đích không thuộc cửa hàng" };
      if (to.kind === LocationKind.DAMAGED) return { error: "Không chuyển hàng vào vị trí Hàng lỗi (dùng Xuất hủy)" };
    }
    const variantIds = [...new Set(data.items.map((i) => i.variantId))];
    const count = await prisma.productVariant.count({ where: { id: { in: variantIds }, product: { storeId: store.id } } });
    if (count !== variantIds.length) return { error: "Có sản phẩm không thuộc cửa hàng này" };

    const total = data.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
    const result = await prisma.$transaction(async (tx) => {
      const common = {
        kind: data.kind, customerName: customerName ?? null, partnerId: data.partnerId ?? null,
        condition: data.condition ?? null, fromLocationId: data.fromLocationId ?? null, toLocationId: data.toLocationId ?? null,
        slipDate, note: data.note, totalAmount: BigInt(total),
      };
      const itemsData = data.items.map((i) => ({ variantId: i.variantId, quantity: i.quantity, unitPrice: BigInt(i.unitPrice), totalAmount: BigInt(i.quantity * i.unitPrice) }));
      let slipId = data.id;
      let code: string;
      if (slipId) {
        const existing = await tx.returnSlip.findFirst({ where: { id: slipId, storeId: store.id } });
        if (!existing) throw new Error("Không tìm thấy phiếu");
        if (existing.status !== "DRAFT") throw new Error("Chỉ sửa được phiếu đang chờ duyệt");
        code = existing.code;
        await tx.returnSlipItem.deleteMany({ where: { slipId } });
        await tx.returnSlip.update({ where: { id: slipId }, data: { ...common, items: { create: itemsData } } });
      } else {
        code = await nextDocCode(tx, "returnSlip", store.id, SLIP_PREFIX[data.kind], slipDate);
        slipId = (
          await tx.returnSlip.create({
            data: { ...common, storeId: store.id, code, status: "DRAFT", createdByName: store.userName, items: { create: itemsData } },
          })
        ).id;
      }
      if (data.approve) await approveSlipTx(tx, store.id, slipId!);
      return { id: slipId!, code };
    }, TX_OPTS);
    revalidateModule("RETAIL");
    return { success: true, ...result };
  } catch (e) {
    return { error: errorMessage(e, "Lỗi lưu phiếu") };
  }
}

async function approveSlipTx(tx: Prisma.TransactionClient, storeId: string, slipId: string) {
  const s = await tx.returnSlip.findFirst({ where: { id: slipId, storeId }, include: { items: { include: { variant: true } } } });
  if (!s) throw new Error("Không tìm thấy phiếu");
  if (s.status !== "DRAFT") throw new Error("Phiếu đã được duyệt hoặc đã hủy");
  const res = await tx.returnSlip.updateMany({ where: { id: s.id, status: "DRAFT" }, data: { status: "APPROVED" } });
  if (res.count === 0) throw new Error("Phiếu vừa được người khác xử lý");

  if (s.kind === SlipKind.CUSTOMER_RETURN) {
    const kind = s.condition === "DAMAGED" ? LocationKind.DAMAGED : LocationKind.SHELF;
    let loc = await tx.stockLocation.findFirst({ where: { storeId, kind }, orderBy: { isDefault: "desc" } });
    if (!loc && kind === LocationKind.DAMAGED) loc = await tx.stockLocation.create({ data: { storeId, name: "Hàng lỗi", kind } });
    if (!loc) throw new Error("Cửa hàng chưa có vị trí Kệ để nhận hàng trả");
    for (const it of s.items) {
      if (it.quantity > it.variant.soldCount) throw new Error(`Số lượng trả của ${it.variant.sku} (${it.quantity}) vượt quá số đã bán (${it.variant.soldCount})`);
      await InventoryService.recordReturn(tx, {
        storeId, variantId: it.variantId, locationId: loc.id, quantity: it.quantity, unitCost: it.variant.costPrice,
        isDamaged: s.condition === "DAMAGED", refType: "RETURN", refId: s.id, note: `Khách ${s.customerName ?? ""} trả hàng (${s.code})`,
      });
    }
  } else if (s.kind === SlipKind.DISPOSE) {
    for (const it of s.items) {
      await InventoryService.recordIssue(tx, {
        storeId, variantId: it.variantId, locationId: s.fromLocationId!, quantity: it.quantity, unitCost: it.variant.costPrice,
        type: MovementType.DISPOSE, refType: "DISPOSE", refId: s.id, note: `Xuất hủy (${s.code})${s.note ? `: ${s.note}` : ""}`,
      });
    }
  } else {
    for (const it of s.items) {
      await InventoryService.recordTransfer(tx, {
        storeId, variantId: it.variantId, locationId: s.fromLocationId!, targetLocationId: s.toLocationId!, quantity: it.quantity,
        type: MovementType.TRANSFER_OUT, refId: s.id, note: `Chuyển kho (${s.code})`,
      });
    }
  }
}

export async function approveSlipAction(id: string): Promise<ActionResult> {
  try {
    const slip = await prisma.returnSlip.findUnique({ where: { id }, select: { kind: true } });
    const store = await requireStore("RETAIL", slip?.kind === SlipKind.DISPOSE ? Role.MANAGER : Role.STAFF);
    await prisma.$transaction((tx) => approveSlipTx(tx, store.id, id), TX_OPTS);
    revalidateModule("RETAIL");
    return { success: true };
  } catch (e) {
    return { error: errorMessage(e, "Lỗi duyệt phiếu") };
  }
}

export async function cancelSlipAction(id: string): Promise<ActionResult> {
  try {
    const store = await requireStore("RETAIL", Role.MANAGER);
    await prisma.$transaction(async (tx) => {
      const s = await tx.returnSlip.findFirst({ where: { id, storeId: store.id } });
      if (!s) throw new Error("Không tìm thấy phiếu");
      if (s.status === "CANCELLED") throw new Error("Phiếu đã hủy trước đó");
      if (s.status === "APPROVED") await reverseDocMovements(tx, store.id, s.id, `Hủy phiếu ${s.code}`, store.userName);
      await tx.returnSlip.update({ where: { id: s.id }, data: { status: "CANCELLED" } });
    }, TX_OPTS);
    revalidateModule("RETAIL");
    return { success: true };
  } catch (e) {
    return { error: errorMessage(e, "Lỗi hủy phiếu") };
  }
}

// =============================================================================
// 4. PHIẾU KIỂM KÊ (PKK): tạo phiên (chốt tồn) → nhập số đếm (nháp) → duyệt & cân bằng
// =============================================================================
const createAuditSchema = z.object({
  locationId: z.string().optional(),
  categoryId: z.string().optional(), // bán lẻ: nhóm hàng
  materialType: z.enum(["RAW_MATERIAL", "SEMI_FINISHED", "FINISHED_PRODUCT"]).optional(), // kho: loại hàng
  note: z.string().max(500).optional(),
});

export async function createAuditDraftAction(input: z.input<typeof createAuditSchema>): Promise<ActionResult<{ id: string; code: string; count: number }>> {
  try {
    const parsed = createAuditSchema.safeParse(input);
    if (!parsed.success) return { error: "Bộ lọc kiểm kê không hợp lệ" };
    const store = await requireStore(undefined, Role.STAFF);
    if (store.type === "FOOD") return { error: "Cửa hàng đồ ăn không dùng kiểm kê kho" };
    const f = parsed.data;
    const levels = await prisma.stockLevel.findMany({
      where: {
        storeId: store.id,
        ...(f.locationId ? { locationId: f.locationId } : {}),
        ...(store.type === "RETAIL"
          ? { variantId: { not: null }, location: { kind: { not: LocationKind.DAMAGED } }, variant: { deletedAt: null, ...(f.categoryId ? { product: { categoryId: f.categoryId } } : {}) } }
          : { materialId: { not: null }, material: { deletedAt: null, ...(f.materialType ? { type: f.materialType } : {}) } }),
      },
      include: { variant: { select: { costPrice: true } }, material: { select: { costPrice: true } } },
    });
    if (levels.length === 0) return { error: "Không có mặt hàng nào phù hợp bộ lọc để kiểm kê" };
    const result = await prisma.$transaction(async (tx) => {
      const code = await nextDocCode(tx, "stockAudit", store.id, "PKK");
      const audit = await tx.stockAudit.create({
        data: {
          storeId: store.id, code, status: "DRAFT", note: f.note, createdBy: store.userId, createdByName: store.userName,
          items: {
            create: levels.map((l) => ({
              variantId: l.variantId, materialId: l.materialId, locationId: l.locationId,
              systemQty: l.quantity, actualQty: l.quantity, variance: 0, varianceValue: BigInt(0),
            })),
          },
        },
      });
      return { id: audit.id, code, count: levels.length };
    }, TX_OPTS);
    revalidateModule(store.type);
    return { success: true, ...result };
  } catch (e) {
    return { error: errorMessage(e, "Lỗi tạo phiếu kiểm kê") };
  }
}

const saveAuditSchema = z.object({
  auditId: z.string().min(1),
  items: z.array(z.object({ itemId: z.string().min(1), actualQty: z.number().int().min(0, "Số đếm phải ≥ 0"), reason: z.string().max(500).optional() })).min(1),
});

/** Lưu số đếm vào phiếu nháp (chưa đổi tồn) */
export async function saveAuditCountsAction(input: z.input<typeof saveAuditSchema>): Promise<ActionResult> {
  try {
    const parsed = saveAuditSchema.safeParse(input);
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Số liệu kiểm kê không hợp lệ" };
    const store = await requireStore(undefined, Role.STAFF);
    await prisma.$transaction(async (tx) => {
      const audit = await tx.stockAudit.findFirst({
        where: { id: parsed.data.auditId, storeId: store.id },
        include: { items: { include: { variant: { select: { costPrice: true } }, material: { select: { costPrice: true } } } } },
      });
      if (!audit) throw new Error("Không tìm thấy phiếu kiểm kê");
      if (audit.status !== "DRAFT") throw new Error("Phiếu kiểm kê đã duyệt hoặc đã hủy");
      const byId = new Map(audit.items.map((i) => [i.id, i]));
      for (const c of parsed.data.items) {
        const it = byId.get(c.itemId);
        if (!it) throw new Error("Dòng kiểm kê không thuộc phiếu này");
        const variance = c.actualQty - it.systemQty;
        const cost = Number(it.variant?.costPrice ?? it.material?.costPrice ?? 0);
        await tx.stockAuditItem.update({
          where: { id: it.id },
          data: { actualQty: c.actualQty, variance, varianceValue: BigInt(variance * cost), reason: c.reason?.trim() || null },
        });
      }
      const items = await tx.stockAuditItem.findMany({ where: { auditId: audit.id } });
      await tx.stockAudit.update({ where: { id: audit.id }, data: { totalVarianceValue: items.reduce((s, i) => s + i.varianceValue, BigInt(0)) } });
    }, TX_OPTS);
    revalidateModule(store.type);
    return { success: true };
  } catch (e) {
    return { error: errorMessage(e, "Lỗi lưu số đếm") };
  }
}

/** Ghi nhận số đếm từ màn quét mobile theo mã vạch / SKU */
export async function recordScanCountAction(auditId: string, code: string, actualQty: number): Promise<ActionResult<{ name: string }>> {
  try {
    if (!Number.isInteger(actualQty) || actualQty < 0) return { error: "Số lượng thực tế không hợp lệ" };
    const store = await requireStore(undefined, Role.STAFF);
    const audit = await prisma.stockAudit.findFirst({
      where: { id: auditId, storeId: store.id, status: "DRAFT" },
      include: { items: { include: { variant: { include: { product: true } }, material: true } } },
    });
    if (!audit) return { error: "Không có phiếu kiểm kê đang mở" };
    const c = code.trim().toLowerCase();
    const it = audit.items.find((i) =>
      [i.variant?.sku, i.variant?.barcode, i.material?.sku, i.material?.barcode].some((x) => x?.toLowerCase() === c)
    );
    if (!it) return { error: `Mã ${code} không có trong phiếu kiểm kê này` };
    const res = await saveAuditCountsAction({ auditId, items: [{ itemId: it.id, actualQty, reason: it.reason ?? undefined }] });
    if ("error" in res) return res;
    const name = it.variant ? `${it.variant.product.name} (${it.variant.name})` : it.material!.name;
    return { success: true, name };
  } catch (e) {
    return { error: errorMessage(e, "Lỗi ghi nhận số đếm") };
  }
}

/** Duyệt phiếu kiểm kê: cân bằng kho theo chênh lệch (số đếm − tồn đã chốt) tại từng vị trí */
export async function approveAuditAction(auditId: string): Promise<ActionResult<{ adjusted: number }>> {
  try {
    const store = await requireStore(undefined, Role.MANAGER);
    const adjusted = await prisma.$transaction(async (tx) => {
      const audit = await tx.stockAudit.findFirst({ where: { id: auditId, storeId: store.id }, include: { items: true } });
      if (!audit) throw new Error("Không tìm thấy phiếu kiểm kê");
      if (audit.status !== "DRAFT") throw new Error("Phiếu kiểm kê đã duyệt hoặc đã hủy");
      const missing = audit.items.find((i) => i.variance !== 0 && !i.reason);
      if (missing) throw new Error("Vui lòng nhập lý do cho tất cả các dòng có chênh lệch trước khi cân bằng");
      const res = await tx.stockAudit.updateMany({ where: { id: audit.id, status: "DRAFT" }, data: { status: "APPROVED", auditDate: new Date() } });
      if (res.count === 0) throw new Error("Phiếu vừa được người khác xử lý");
      let n = 0;
      for (const it of audit.items) {
        if (it.variance === 0) continue;
        if (!it.locationId) throw new Error("Dòng kiểm kê thiếu vị trí");
        await InventoryService.recordAdjustment(tx, {
          storeId: store.id, variantId: it.variantId ?? undefined, materialId: it.materialId ?? undefined,
          locationId: it.locationId, delta: it.variance, refId: audit.id, reason: it.reason ?? "Cân bằng kiểm kê",
        });
        n++;
      }
      return n;
    }, TX_OPTS);
    revalidateModule(store.type);
    return { success: true, adjusted };
  } catch (e) {
    return { error: errorMessage(e, "Lỗi cân bằng kho") };
  }
}
