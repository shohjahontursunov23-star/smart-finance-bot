import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DB_PATH = process.env.DATABASE_URL?.replace("file:", "") || "/tmp/custom.db";

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (_db) return _db;

  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");

  // Settings jadvali
  _db.exec(`
    CREATE TABLE IF NOT EXISTS Settings (
      id                TEXT PRIMARY KEY DEFAULT 'default',
      needsPercent      INTEGER NOT NULL DEFAULT 50,
      wantsPercent      INTEGER NOT NULL DEFAULT 30,
      savingsPercent    INTEGER NOT NULL DEFAULT 20,
      savingsCardNumber TEXT NOT NULL DEFAULT '',
      savingsCardBank   TEXT NOT NULL DEFAULT 'payme',
      telegramBotToken  TEXT NOT NULL DEFAULT '',
      telegramChatId    TEXT NOT NULL DEFAULT '',
      reportDayOfWeek   INTEGER NOT NULL DEFAULT 7,
      reportHour        INTEGER NOT NULL DEFAULT 20,
      paymentService    TEXT NOT NULL DEFAULT 'payme',
      apiKey            TEXT NOT NULL DEFAULT '',
      createdAt         TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt         TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Tranzaksiyalar jadvali
  _db.exec(`
    CREATE TABLE IF NOT EXISTS txns (
      id                 TEXT PRIMARY KEY,
      amount             INTEGER NOT NULL,
      needsAmount        INTEGER NOT NULL,
      wantsAmount        INTEGER NOT NULL,
      savingsAmount      INTEGER NOT NULL,
      savingsTransferred INTEGER NOT NULL DEFAULT 0,
      smsText            TEXT NOT NULL,
      bankName           TEXT NOT NULL DEFAULT '',
      cardLast4          TEXT NOT NULL DEFAULT '',
      paymentLink        TEXT NOT NULL DEFAULT '',
      confirmedAt        TEXT,
      createdAt          TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt          TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Default settings qo'shish
  _db.exec(`INSERT OR IGNORE INTO Settings (id) VALUES ('default')`);

  return _db;
}

export const db = getDb();
export default db;