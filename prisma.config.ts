// Cấu hình Prisma. Kết nối DB: DATABASE_URL (xem schema.prisma và script vercel-build)
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
});
