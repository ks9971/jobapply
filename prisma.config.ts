import path from "node:path";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: path.join(__dirname, "prisma", "schema.prisma"),
  datasource: {
    url: "file:./dev.db",
  },
  migrate: {
    async url() {
      return "file:./dev.db";
    },
  },
} as Parameters<typeof defineConfig>[0]);
