import { format } from "date-fns";
import { vi } from "date-fns/locale";

/**
 * Định dạng tiền tệ VND (VD: 288.000đ hoặc 25.680.000 ₫)
 */
export function formatCurrency(amount: number | bigint | string | null | undefined): string {
  if (amount === null || amount === undefined) return "0đ";
  const num = typeof amount === "bigint" ? Number(amount) : Number(amount);
  if (isNaN(num)) return "0đ";
  return new Intl.NumberFormat("vi-VN").format(num) + "đ";
}

/**
 * Định dạng ngày giờ dd/MM/yyyy HH:mm
 */
export function formatDateTime(date: Date | string | number | null | undefined): string {
  if (!date) return "--/--/----";
  const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
  return format(d, "dd/MM/yyyy HH:mm", { locale: vi });
}

/**
 * Định dạng ngày dd/MM/yyyy
 */
export function formatDate(date: Date | string | number | null | undefined): string {
  if (!date) return "--/--/----";
  const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
  return format(d, "dd/MM/yyyy", { locale: vi });
}

