import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

async function ensureTables(db: PrismaClient) {
  // Try to query — if it works, tables exist
  try {
    await db.settings.findFirst()
    return
  } catch {}

  // Create Settings table
  try {
    await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "Settings" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "needsPercent" INTEGER NOT NULL DEFAULT 50,
  "wantsPercent" INTEGER NOT NULL DEFAULT 30,
  "savingsPercent" INTEGER NOT NULL DEFAULT 20,
  "savingsCardNumber" TEXT NOT NULL DEFAULT '',
  "savingsCardBank" TEXT NOT NULL DEFAULT 'payme',
  "telegramBotToken" TEXT NOT NULL DEFAULT '',
  "telegramChatId" TEXT NOT NULL DEFAULT '',
  "reportDayOfWeek" INTEGER NOT NULL DEFAULT 7,
  "reportHour" INTEGER NOT NULL DEFAULT 20,
  "paymentService" TEXT NOT NULL DEFAULT 'payme',
  "apiKey" TEXT NOT NULL DEFAULT '',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
)`)
  } catch {}

  // Create Transaction table
  try {
    await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "Transaction" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "amount" INTEGER NOT NULL,
  "needsAmount" INTEGER NOT NULL,
  "wantsAmount" INTEGER NOT NULL,
  "savingsAmount" INTEGER NOT NULL,
  "savingsTransferred" BOOLEAN NOT NULL DEFAULT 0,
  "smsText" TEXT NOT NULL,
  "bankName" TEXT NOT NULL DEFAULT '',
  "cardLast4" TEXT NOT NULL DEFAULT '',
  "paymentLink" TEXT NOT NULL DEFAULT '',
  "confirmedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
)`)
  } catch {}

  // Insert default settings row
  try {
    await db.$executeRawUnsafe(`INSERT OR IGNORE INTO "Settings" ("id") VALUES ('default')`)
  } catch {}
}

const db = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

// Ensure tables exist (non-blocking)
ensureTables(db).catch(console.error)

export { db }