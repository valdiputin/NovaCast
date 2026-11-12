import { PrismaClient } from "@prisma/client";

// schema.prisma khai báo directUrl = env("DIRECT_URL"). Trên Vercel + Neon biến này có thể không có
// hoặc rỗng → Prisma từ chối khởi tạo. Dùng chuỗi kết nối trực tiếp của Neon (hoặc DATABASE_URL) làm dự phòng.
if (!process.env.DIRECT_URL) {
  process.env.DIRECT_URL = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || "";
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
