import { VN_TZ } from "./date";

/**
 * Định dạng tiền tệ VND (VD: 288.000đ hoặc 25.680.000 ₫)
 */
export function formatCurrency(amount: number | bigint | string | null | undefined): string {
  if (amount === null || amount === undefined) return "0đ";
  const num = typeof amount === "bigint" ? Number(amount) : Number(amount);
  if (isNaN(num)) return "0đ";
  return new Intl.NumberFormat("vi-VN").format(num) + "đ";
}

function toDate(date: Date | string | number): Date {
  return typeof date === "string" || typeof date === "number" ? new Date(date) : date;
}

function parts(d: Date) {
  const p = new Intl.DateTimeFormat("en-GB", {
    timeZone: VN_TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const get = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return { dd: get("day"), mm: get("month"), yyyy: get("year"), HH: get("hour"), MM: get("minute") };
}

/**
 * Định dạng ngày giờ dd/MM/yyyy HH:mm theo giờ Việt Nam (server Vercel chạy UTC)
 */
export function formatDateTime(date: Date | string | number | null | undefined): string {
  if (!date) return "--/--/----";
  const { dd, mm, yyyy, HH, MM } = parts(toDate(date));
  return `${dd}/${mm}/${yyyy} ${HH}:${MM}`;
}

/**
 * Định dạng ngày dd/MM/yyyy theo giờ Việt Nam
 */
export function formatDate(date: Date | string | number | null | undefined): string {
  if (!date) return "--/--/----";
  const { dd, mm, yyyy } = parts(toDate(date));
  return `${dd}/${mm}/${yyyy}`;
}
