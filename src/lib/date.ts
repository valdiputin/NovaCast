// Tiện ích ngày giờ theo múi giờ Việt Nam (server Vercel chạy UTC)
export const VN_TZ = "Asia/Ho_Chi_Minh";
const VN_OFFSET_MS = 7 * 60 * 60 * 1000; // Việt Nam không có giờ mùa hè

/** Chuỗi YYYYMMDD theo giờ Việt Nam — dùng cho mã phiếu */
export function vnDateKey(date: Date = new Date()): string {
  return new Date(date.getTime() + VN_OFFSET_MS).toISOString().slice(0, 10).replace(/-/g, "");
}

/** Giá trị cho <input type="datetime-local"> theo giờ Việt Nam: yyyy-MM-ddTHH:mm */
export function toVnInput(date: Date = new Date()): string {
  return new Date(date.getTime() + VN_OFFSET_MS).toISOString().slice(0, 16);
}

/** Thời điểm 00:00 (giờ Việt Nam) của ngày chứa `date`, trả về dạng Date (UTC) */
export function startOfVnDay(date: Date = new Date()): Date {
  const shifted = new Date(date.getTime() + VN_OFFSET_MS);
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() - VN_OFFSET_MS);
}
