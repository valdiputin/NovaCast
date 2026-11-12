// Cấu hình Prisma. Kết nối DB lấy từ schema.prisma:
//   url       = DATABASE_URL (Neon pooled — dùng khi chạy app)
//   directUrl = DIRECT_URL   (Neon unpooled — dùng cho migrate/seed)
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
});
