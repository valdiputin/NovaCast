// Nhãn tiếng Việt & màu cho trạng thái — dùng chung server/client
export type Tone = "green" | "amber" | "red" | "gray" | "blue" | "purple";

export const DOC_STATUS: Record<string, { label: string; tone: Tone }> = {
  DRAFT: { label: "Nháp", tone: "gray" },
  APPROVED: { label: "Đã duyệt", tone: "green" },
  CANCELLED: { label: "Đã hủy", tone: "red" },
};

export const SLIP_STATUS: Record<string, { label: string; tone: Tone }> = {
  DRAFT: { label: "Chờ duyệt", tone: "amber" },
  APPROVED: { label: "Hoàn thành", tone: "green" },
  CANCELLED: { label: "Đã hủy", tone: "red" },
};

export const ORDER_STATUS: Record<string, { label: string; tone: Tone }> = {
  PENDING: { label: "Chờ xử lý", tone: "amber" },
  CONFIRMED: { label: "Đã xác nhận", tone: "blue" },
  SHIPPING: { label: "Đang giao", tone: "purple" },
  COMPLETED: { label: "Hoàn thành", tone: "green" },
  CANCELLED: { label: "Đã hủy", tone: "red" },
};

export const PAYMENT_LABEL: Record<string, string> = {
  CASH: "Tiền mặt",
  BANK_TRANSFER: "Chuyển khoản",
  E_WALLET: "Ví điện tử",
};

export const RECEIPT_TYPE: Record<string, string> = {
  PURCHASE: "Nhập mua hàng",
  SUPPLIER: "Nhập từ NCC",
  PRODUCTION: "Nhập thành phẩm",
  RETURN: "Nhập trả lại",
};

export const ISSUE_TYPE: Record<string, string> = {
  PRODUCTION: "Xuất NVL cho",
  CUSTOMER: "Xuất thành phẩm",
  DISPOSE: "Xuất hủy",
  TRANSFER: "Xuất chuyển kho",
  RETURN_VENDOR: "Trả hàng NCC",
};

export const ISSUE_FILTER: Record<string, string> = {
  PRODUCTION: "Xuất sản xuất",
  CUSTOMER: "Xuất giao khách",
  DISPOSE: "Xuất hủy",
};

export const MATERIAL_TYPE: Record<string, { label: string; cls: string }> = {
  RAW_MATERIAL: { label: "Nguyên vật liệu", cls: "bg-blue-50 text-blue-700" },
  FINISHED_PRODUCT: { label: "Thành phẩm", cls: "bg-emerald-50 text-emerald-700" },
  SEMI_FINISHED: { label: "Bán thành phẩm", cls: "bg-purple-50 text-purple-700" },
};

export const MOVEMENT_LABEL: Record<string, string> = {
  RECEIPT: "Nhập kho",
  ISSUE: "Xuất kho",
  SALE: "Bán hàng",
  RETURN: "Khách trả",
  TRANSFER_IN: "Chuyển đến",
  TRANSFER_OUT: "Chuyển đi",
  ADJUSTMENT: "Điều chỉnh",
  DISPOSE: "Xuất hủy",
};

/** Trạng thái tồn kho tự tính: 0 → Hết hàng; ≤ định mức → Sắp hết; còn lại → Đủ hàng */
export function stockState(qty: number, min: number, labels = { ok: "Đủ hàng", low: "Sắp hết", out: "Hết hàng" }) {
  if (qty <= 0) return { label: labels.out, tone: "red" as Tone };
  if (qty <= min) return { label: labels.low, tone: "amber" as Tone };
  return { label: labels.ok, tone: "green" as Tone };
}

/** Trạng thái bán của sản phẩm: OUT_OF_STOCK / INACTIVE đặt tay, ACTIVE thì tính theo tồn */
export function saleState(status: string, qty: number, min: number) {
  if (status === "INACTIVE") return { label: "Ngừng bán", tone: "gray" as Tone, value: "INACTIVE" };
  if (status === "OUT_OF_STOCK" || qty <= 0) return { label: "Hết hàng", tone: "red" as Tone, value: "OUT_OF_STOCK" };
  if (qty <= min) return { label: "Sắp hết hàng", tone: "amber" as Tone, value: "ACTIVE" };
  return { label: "Đang bán", tone: "green" as Tone, value: "ACTIVE" };
}

/** Giá sau giảm %, làm tròn đến 100đ */
export function discounted(price: number, pct: number, round100 = true) {
  const v = (price * (100 - pct)) / 100;
  return round100 ? Math.round(v / 100) * 100 : Math.round(v);
}
