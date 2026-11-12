import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    // Test tích hợp dùng chung 1 database → chạy tuần tự
    fileParallelism: false,
    testTimeout: 30000,
  },
});
