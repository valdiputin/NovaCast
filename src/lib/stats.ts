import { startOfVnDay } from "./date";
import { formatDate } from "./format";

const DAY = 86_400_000;

/** n ngày gần nhất (tính cả hôm nay) theo giờ Việt Nam */
export function lastDays(n: number) {
  const today = startOfVnDay();
  return Array.from({ length: n }, (_, i) => {
    const start = new Date(today.getTime() - (n - 1 - i) * DAY);
    return { start, end: new Date(start.getTime() + DAY), label: formatDate(start).slice(0, 5) };
  });
}

/** 00:00 (giờ VN) của n ngày trước */
export function daysAgoDate(n: number) {
  return new Date(startOfVnDay().getTime() - n * DAY);
}

export function dayRange(daysAgo = 0) {
  const start = new Date(startOfVnDay().getTime() - daysAgo * DAY);
  return { gte: start, lt: new Date(start.getTime() + DAY) };
}

/** Gom giá trị theo ngày: rows có createdAt + value */
export function bucketByDay<T>(days: ReturnType<typeof lastDays>, rows: T[], at: (r: T) => Date, val: (r: T) => number) {
  return days.map((d) => rows.filter((r) => at(r) >= d.start && at(r) < d.end).reduce((s, r) => s + val(r), 0));
}

/** Khoảng thời gian cho bộ lọc "7 ngày gần nhất / 30 ngày / tháng này / tất cả" */
export function rangeFilter(range?: string): { gte: Date } | undefined {
  const today = startOfVnDay();
  if (range === "all") return undefined;
  if (range === "30d") return { gte: new Date(today.getTime() - 29 * DAY) };
  if (range === "today") return { gte: today };
  return { gte: new Date(today.getTime() - 6 * DAY) }; // mặc định 7 ngày gần nhất
}

export const RANGE_OPTIONS = [
  { value: "7d", label: "7 ngày gần nhất" },
  { value: "today", label: "Hôm nay" },
  { value: "30d", label: "30 ngày gần nhất" },
  { value: "all", label: "Tất cả" },
];
