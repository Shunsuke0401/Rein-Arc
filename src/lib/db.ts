import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

import { PrismaClient } from "@/generated/prisma";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function makeClient() {
  const url = process.env.DATABASE_URL ?? "file:./dev.db";
  const filename = url.startsWith("file:") ? url.slice("file:".length) : url;
  const adapter = new PrismaBetterSqlite3({ url: filename });
  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const db = globalForPrisma.prisma ?? makeClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
