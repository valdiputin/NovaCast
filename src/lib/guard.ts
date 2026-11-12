import { Prisma, Role } from "@prisma/client";
import { getCurrentStore, getCurrentUser } from "./auth";
import { vnDateKey } from "./date";

export type StoreTypeName = "FOOD" | "RETAIL" | "WAREHOUSE";
export type ActionResult<T = object> = ({ success: true } & T) | { error: string };

const ROLE_RANK: Record<Role, number> = { OWNER: 3, MANAGER: 2, STAFF: 1 };

/**
 * Kiểm tra đăng nhập + cửa hàng hiện tại (đúng loại) + quyền tối thiểu.
 * Trả về store kèm tên người thao tác (để ghi "Người lập").
 */
export async function requireStore(requiredType?: StoreTypeName, minRole: Role = Role.STAFF) {
  const store = await getCurrentStore(requiredType);
  if (ROLE_RANK[store.currentRole] < ROLE_RANK[minRole]) {
    throw new Error(`Bạn không có quyền thực hiện thao tác này (yêu cầu tối thiểu ${roleLabel(minRole)})`);
  }
  const user = await getCurrentUser();
  return { ...store, userName: user?.fullName ?? "admin", userId: user?.id };
}

export function roleLabel(role: Role) {
  return role === "OWNER" ? "Chủ cửa hàng" : role === "MANAGER" ? "Quản lý" : "Nhân viên";
}

export function errorMessage(e: unknown, fallback = "Đã xảy ra lỗi") {
  if (e && typeof e === "object" && "digest" in e && String((e as { digest?: string }).digest).startsWith("NEXT_REDIRECT")) {
    throw e; // để Next.js xử lý redirect
  }
  return e instanceof Error ? e.message : fallback;
}

/**
 * Mã chứng từ tăng dần theo ngày (giờ Việt Nam): PREFIX-YYYYMMDD-NN.
 * Lấy số lớn nhất đã dùng trong ngày + 1 (an toàn kể cả khi dãy số có khoảng trống).
 */
export async function nextDocCode(
  tx: Prisma.TransactionClient,
  table: "stockReceipt" | "stockIssue" | "stockAudit" | "returnSlip",
  storeId: string,
  prefix: string,
  date: Date = new Date()
) {
  const base = `${prefix}-${vnDateKey(date)}-`;
  const where = { storeId, code: { startsWith: base } };
  const select = { code: true } as const;
  const rows =
    table === "stockReceipt"
      ? await tx.stockReceipt.findMany({ where, select })
      : table === "stockIssue"
      ? await tx.stockIssue.findMany({ where, select })
      : table === "stockAudit"
      ? await tx.stockAudit.findMany({ where, select })
      : await tx.returnSlip.findMany({ where, select });
  const max = rows.reduce((m, r) => Math.max(m, Number(r.code.slice(base.length)) || 0), 0);
  return `${base}${String(max + 1).padStart(2, "0")}`;
}
