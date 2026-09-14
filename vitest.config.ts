import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // 只测纯逻辑，不需要浏览器环境
    environment: "node",
    include: ["src/**/*.spec.ts"],
  },
});
