import TelegramBot from "node-telegram-bot-api";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";

// ─── Types ───────────────────────────────────────────────────────────────────

interface AppSettings {
  botToken?: string;
  chatId?: string;
  needsPercent?: number;
  wantsPercent?: number;
  savingsPercent?: number;
  reportDayOfWeek?: number;
  reportHour?: number;
  budgetAlertThreshold?: number;
}

interface Transaction {
  id: string;
  amount: number;
  type: string;
  category: string;
  merchant?: string;
  description?: string;
  date: string;
  balance?: number;
}

interface ParsedSMS {
  success: boolean;
  amount?: number;
  type?: string;
  category?: string;
  merchant?: string;
  date?: string;
  balance?: number;
  originalText?: string;
  error?: string;
}

interface ReportData {
  totalIncome?: number;
  totalExpense?: number;
  transactionsCount?: number;
  categoryBreakdown?: Array<{
    category: string;
    percent: number;
    amount: number;
    allocated: number;
    transferred?: number;
    pending?: number;
  }>;
  savings?: {
    transferred?: number;
    pending?: number;
  };
}

// ─── Constants ───────────────────────────────────────────────────────────────

const PORT = 3003;
const MAIN_APP_URL = "http://localhost:3000";
const SETTINGS_POLL_INTERVAL = 60_000;
const WEEKLY_CHECK_INTERVAL = 60_000;

const BANK_SMS_KEYWORDS = [
  "so'm",
  "UZS",
  "karta",
  "Hisobingiz",
  "hisobingiz",
  "mablag'",
  "tolov",
  "to'lov",
  "kredit",
  "naqd",
  "otkazma",
  "o'tkazma",
  "8600",
  "9860",
];

// ─── State ───────────────────────────────────────────────────────────────────

let settings: AppSettings = {};
let bot: TelegramBot | null = null;
let botActive = false;
let io: SocketIOServer;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function log(msg: string) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${msg}`);
}

async function safeFetch(url: string, options?: RequestInit): Promise<Response | null> {
  try {
    const res = await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(10_000),
    });
    return res;
  } catch (err) {
    log(`⚠️  Fetch error (${url}): ${err}`);
    return null;
  }
}

function isBankSMS(text: string): boolean {
  const lower = text.toLowerCase();
  return BANK_SMS_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase()));
}

function formatAmount(amount: number): string {
  return amount.toLocaleString("uz-UZ") + " so'm";
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ─── Settings loader ─────────────────────────────────────────────────────────

async function loadSettings(): Promise<void> {
  const res = await safeFetch(`${MAIN_APP_URL}/api/settings`);
  if (!res || !res.ok) {
    log("⚠️  Could not load settings from main app");
    return;
  }
  try {
    settings = await res.json();
    log("✅ Settings loaded successfully");
  } catch {
    log("⚠️  Failed to parse settings response");
  }
}

// ─── Bot lifecycle ───────────────────────────────────────────────────────────

function startBot(token: string): void {
  if (botActive) return;

  try {
    bot = new TelegramBot(token, { polling: true });
    botActive = true;
    log("🤖 Telegram bot started polling");

    registerBotHandlers();

    bot.on("polling_error", (err) => {
      log(`⚠️  Polling error: ${err.message}`);
    });

    emitBotStatus(true);
  } catch (err) {
    log(`❌ Failed to start bot: ${err}`);
    botActive = false;
    emitBotStatus(false);
  }
}

function stopBot(): void {
  if (!bot || !botActive) return;

  try {
    bot.stopPolling();
    botActive = false;
    log("🤖 Telegram bot stopped polling");
    emitBotStatus(false);
  } catch (err) {
    log(`⚠️  Error stopping bot: ${err}`);
  }
}

function syncBotState(): void {
  if (!settings.botToken) {
    if (botActive) stopBot();
    return;
  }
  if (!botActive) {
    startBot(settings.botToken);
  }
}

// ─── Bot command handlers ────────────────────────────────────────────────────

function registerBotHandlers(): void {
  if (!bot) return;

  bot.onText(/\/start/, async (msg) => {
    if (!isAuthorized(msg.chat.id)) return;
    const text =
      "👋 <b>Salom! Men Smart Finance Bot man.</b>\n\n" +
      "Men sizning bank SMS xabarlaringizni tahlil qilishga yordam beraman. " +
      "Xarajatlaringizni kategoriyalarga ajrataman va oylik hisobotlar tayyorlayman.\n\n" +
      "📱 SMS xabarlarini shu yerga yuboring yoki quyidagi buyruqlardan foydalaning:\n" +
      "/help — Barcha buyruqlar ro'yxati";
    await bot!.sendMessage(msg.chat.id, text, { parse_mode: "HTML" });
  });

  bot.onText(/\/help/, async (msg) => {
    if (!isAuthorized(msg.chat.id)) return;
    const text =
      "📖 <b>Yordam</b>\n\n" +
      "📱 <b>SMS yuborish:</b> Bank SMS xabarini shu yerga yuboring, men uni tahlil qilaman.\n\n" +
      "📋 <b>Buyruqlar:</b>\n" +
      "/report — Oylik hisobot\n" +
      "/transactions — So'nggi 5 ta operatsiya\n" +
      "/balance — Balans va tushumlar\n" +
      "/settings — Byudjet sozlamalari\n";
    await bot!.sendMessage(msg.chat.id, text, { parse_mode: "HTML" });
  });

  bot.onText(/\/report/, async (msg) => {
    if (!isAuthorized(msg.chat.id)) return;
    await sendReport(msg.chat.id);
  });

  bot.onText(/\/transactions/, async (msg) => {
    if (!isAuthorized(msg.chat.id)) return;
    await sendTransactions(msg.chat.id);
  });

  bot.onText(/\/balance/, async (msg) => {
    if (!isAuthorized(msg.chat.id)) return;
    await sendBalance(msg.chat.id);
  });

  bot.onText(/\/settings/, async (msg) => {
    if (!isAuthorized(msg.chat.id)) return;
    await sendSettingsInfo(msg.chat.id);
  });

  // Handle regular text messages (bank SMS)
  bot.on("message", async (msg) => {
    if (!msg.text || !isAuthorized(msg.chat.id)) return;

    // Skip commands
    if (msg.text.startsWith("/")) return;

    const text = msg.text;
    if (isBankSMS(text)) {
      await handleBankSMS(msg.chat.id, text);
    }
  });
}

function isAuthorized(chatId: number): boolean {
  if (!settings.chatId) {
    log(`⚠️  No chatId configured, rejecting message from ${chatId}`);
    return false;
  }
  const allowed = Number(settings.chatId);
  if (chatId !== allowed) {
    log(`🚫 Unauthorized access from chat ${chatId} (allowed: ${allowed})`);
    return false;
  }
  return true;
}

// ─── Command implementations ─────────────────────────────────────────────────

async function sendReport(chatId: number): Promise<void> {
  if (!bot) return;
  await bot.sendMessage(chatId, "⏳ Hisobot tayyorlanmoqda...");

  const res = await safeFetch(`${MAIN_APP_URL}/api/report`);
  if (!res || !res.ok) {
    await bot.sendMessage(
      chatId,
      "❌ Hisobotni yuklab bo'lmadi. Iltimos keyinroq urinib ko'ring."
    );
    return;
  }

  try {
    const data: ReportData = await res.json();
    const text = formatReport(data);
    await bot.sendMessage(chatId, text, { parse_mode: "HTML" });
  } catch {
    await bot.sendMessage(chatId, "❌ Hisobotni tahlil qilishda xatolik yuz berdi.");
  }
}

function formatReport(data: ReportData): string {
  const income = data.totalIncome ?? 0;
  const count = data.transactionsCount ?? 0;
  const breakdown = data.categoryBreakdown ?? [];

  let text = `📊 <b>Oylik hisobot</b>\n\n`;
  text += `💰 Jami tushum: <b>${formatAmount(income)}</b>\n`;
  text += `📈 Operatsiyalar soni: <b>${count}</b>\n`;

  for (const cat of breakdown) {
    const emoji = getCategoryEmoji(cat.category);
    text += `\n${emoji} ${escapeHtml(cat.category)} (${cat.percent}%): <b>${formatAmount(cat.amount)}</b>\n`;
    text += `   🎯 Ajratilgan: ${formatAmount(cat.allocated)}\n`;

    if (cat.transferred !== undefined && cat.transferred > 0) {
      text += `   ✅ O'tkazilgan: ${formatAmount(cat.transferred)}\n`;
    }
    if (cat.pending !== undefined && cat.pending > 0) {
      text += `   ⏳ Kutilayotgan: ${formatAmount(cat.pending)}\n`;
    }
  }

  if (data.savings) {
    text += `\n🏦 <b>Tejash</b>\n`;
    if (data.savings.transferred) {
      text += `   ✅ O'tkazilgan: ${formatAmount(data.savings.transferred)}\n`;
    }
    if (data.savings.pending) {
      text += `   ⏳ Kutilayotgan: ${formatAmount(data.savings.pending)}\n`;
    }
  }

  return text;
}

function getCategoryEmoji(category: string): string {
  const lower = category.toLowerCase();
  if (lower.includes("ehtiyoj") || lower.includes("needs")) return "🟡";
  if (lower.includes("xohish") || lower.includes("wants")) return "🟣";
  if (lower.includes("tejash") || lower.includes("savings")) return "🟢";
  return "🔵";
}

async function sendTransactions(chatId: number): Promise<void> {
  if (!bot) return;
  await bot.sendMessage(chatId, "⏳ Operatsiyalar yuklanmoqda...");

  const res = await safeFetch(`${MAIN_APP_URL}/api/transactions`);
  if (!res || !res.ok) {
    await bot.sendMessage(
      chatId,
      "❌ Operatsiyalarni yuklab bo'lmadi. Iltimos keyinroq urinib ko'ring."
    );
    return;
  }

  try {
    const transactions: Transaction[] = await res.json();
    if (!transactions || transactions.length === 0) {
      await bot.sendMessage(chatId, "📭 Hali operatsiyalar yo'q.");
      return;
    }

    const last5 = transactions.slice(0, 5);
    let text = "📋 <b>So'nggi 5 ta operatsiya</b>\n\n";

    for (const tx of last5) {
      const typeEmoji = tx.type === "income" ? "📥" : "📤";
      const sign = tx.type === "income" ? "+" : "-";
      const dateStr = tx.date ? new Date(tx.date).toLocaleDateString("uz-UZ") : "";
      text += `${typeEmoji} ${escapeHtml(tx.description || tx.merchant || tx.category)}\n`;
      text += `   ${sign}${formatAmount(tx.amount)}`;
      if (dateStr) text += ` • ${dateStr}`;
      text += "\n\n";
    }

    await bot.sendMessage(chatId, text, { parse_mode: "HTML" });
  } catch {
    await bot.sendMessage(chatId, "❌ Operatsiyalarni tahlil qilishda xatolik yuz berdi.");
  }
}

async function sendBalance(chatId: number): Promise<void> {
  if (!bot) return;

  const res = await safeFetch(`${MAIN_APP_URL}/api/report`);
  if (!res || !res.ok) {
    await bot.sendMessage(
      chatId,
      "❌ Ma'lumotlarni yuklab bo'lmadi. Iltimos keyinroq urinib ko'ring."
    );
    return;
  }

  try {
    const data: ReportData = await res.json();
    const income = data.totalIncome ?? 0;
    const savingsTransferred = data.savings?.transferred ?? 0;
    const savingsPending = data.savings?.pending ?? 0;

    let text = "💰 <b>Balans xulosasi</b>\n\n";
    text += `📥 Jami tushum: <b>${formatAmount(income)}</b>\n`;
    text += `🏦 Tejash (o'tkazilgan): <b>${formatAmount(savingsTransferred)}</b>\n`;
    if (savingsPending > 0) {
      text += `⏳ Tejash (kutilayotgan): <b>${formatAmount(savingsPending)}</b>\n`;
    }
    text += `\n📊 Byudjet: ${settings.needsPercent ?? 50}% / ${settings.wantsPercent ?? 30}% / ${settings.savingsPercent ?? 20}%`;

    await bot.sendMessage(chatId, text, { parse_mode: "HTML" });
  } catch {
    await bot.sendMessage(chatId, "❌ Ma'lumotlarni tahlil qilishda xatolik yuz berdi.");
  }
}

async function sendSettingsInfo(chatId: number): Promise<void> {
  if (!bot) return;

  let text = "⚙️ <b>Hozirgi sozlamalar</b>\n\n";
  text += `📊 Byudjet foizlari:\n`;
  text += `   🟡 Ehtiyojlar: <b>${settings.needsPercent ?? 50}%</b>\n`;
  text += `   🟣 Xohish-istaklar: <b>${settings.wantsPercent ?? 30}%</b>\n`;
  text += `   🟢 Tejash: <b>${settings.savingsPercent ?? 20}%</b>\n`;

  const dayNames = ["Yakshanba", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"];
  const dayName = dayNames[settings.reportDayOfWeek ?? 1] ?? "Dushanba";
  text += `\n📅 Haftalik hisobot: ${dayName}, soat ${String(settings.reportHour ?? 9).padStart(2, "0")}:00\n`;
  text += `🤖 Bot holati: ${botActive ? "✅ Faol" : "❌ O'chirilgan"}`;

  await bot.sendMessage(chatId, text, { parse_mode: "HTML" });
}

// ─── Bank SMS handler ───────────────────────────────────────────────────────

async function handleBankSMS(chatId: number, smsText: string): Promise<void> {
  if (!bot) return;
  await bot.sendMessage(chatId, "📥 SMS qabul qilindi, tahlil qilinmoqda...");

  const res = await safeFetch(`${MAIN_APP_URL}/api/parse-sms`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: smsText }),
  });

  if (!res || !res.ok) {
    await bot.sendMessage(
      chatId,
      "❌ SMSni tahlil qilishda xatolik yuz berdi. Iltimos keyinroq urinib ko'ring."
    );
    return;
  }

  try {
    const data: ParsedSMS = await res.json();
    if (!data.success) {
      await bot.sendMessage(
        chatId,
        `⚠️ SMSni tahlil qilib bo'lmadi.\n\n📝 Asl matn:\n${escapeHtml(data.originalText || smsText)}\n\n❌ Sabab: ${escapeHtml(data.error || "Noma'lum")}`
      );
      return;
    }

    const text = formatParsedSMS(data);
    await bot.sendMessage(chatId, text, { parse_mode: "HTML" });

    // Emit to dashboard
    emitNewTransaction(data);
  } catch {
    await bot.sendMessage(chatId, "❌ SMSni tahlil qilishda xatolik yuz berdi.");
  }
}

function formatParsedSMS(data: ParsedSMS): string {
  const typeEmoji = data.type === "income" ? "📥" : "📤";
  const sign = data.type === "income" ? "+" : "-";
  const catEmoji = getCategoryEmoji(data.category || "");

  let text = `${typeEmoji} <b>Operatsiya tahlili</b>\n\n`;
  text += `💰 Miqdor: <b>${sign}${formatAmount(data.amount ?? 0)}</b>\n`;
  text += `📂 Turi: ${data.type === "income" ? "Tushum" : "Xarajat"}\n`;
  text += `${catEmoji} Kategoriya: <b>${escapeHtml(data.category || "Noma'lum")}</b>\n`;
  if (data.merchant) {
    text += `🏪 Joy: <b>${escapeHtml(data.merchant)}</b>\n`;
  }
  if (data.date) {
    text += `📅 Sana: ${new Date(data.date).toLocaleString("uz-UZ")}\n`;
  }
  if (data.balance !== undefined) {
    text += `💳 Qoldiq: <b>${formatAmount(data.balance)}</b>\n`;
  }

  return text;
}

// ─── Weekly report scheduler ─────────────────────────────────────────────────

function startWeeklyScheduler(): void {
  setInterval(() => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const hour = now.getHours();
    const minute = now.getMinutes();

    const targetDay = settings.reportDayOfWeek ?? 1; // Monday default
    const targetHour = settings.reportHour ?? 9;

    if (dayOfWeek === targetDay && hour === targetHour && minute === 0) {
      const chatId = settings.chatId ? Number(settings.chatId) : null;
      if (!chatId) {
        log("⚠️  Weekly report skipped: no chatId configured");
        return;
      }
      log("📅 Sending weekly report...");
      sendReport(chatId).catch(() => {});
    }
  }, WEEKLY_CHECK_INTERVAL);

  log(`📅 Weekly report scheduler started (checking every ${WEEKLY_CHECK_INTERVAL / 1000}s)`);
}

// ─── Socket.io ──────────────────────────────────────────────────────────────

function setupSocketIO(httpServer: ReturnType<typeof createServer>): void {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    log(`🔌 Socket connected: ${socket.id}`);
    socket.emit("bot-status", { active: botActive, tokenConfigured: !!settings.botToken });

    socket.on("disconnect", () => {
      log(`🔌 Socket disconnected: ${socket.id}`);
    });
  });
}

function emitBotStatus(active: boolean): void {
  if (io) {
    io.emit("bot-status", { active, tokenConfigured: !!settings.botToken });
  }
}

function emitNewTransaction(data: ParsedSMS): void {
  if (io) {
    io.emit("new-transaction", data);
  }
}

// ─── HTTP endpoints ─────────────────────────────────────────────────────────

function setupHttpEndpoints(httpServer: ReturnType<typeof createServer>): void {
  httpServer.on("request", async (req, res) => {
    // Only handle POST /notify
    if (req.method === "POST" && req.url === "/notify") {
      let body = "";

      req.on("data", (chunk: Buffer) => {
        body += chunk.toString();
      });

      req.on("end", async () => {
        try {
          const payload = JSON.parse(body);
          log(`📨 /notify received: ${JSON.stringify(payload)}`);

          // Send notification to configured Telegram chat
          const chatId = settings.chatId ? Number(settings.chatId) : null;
          if (chatId && bot && botActive) {
            const notifyText =
              "🔔 <b>Yangi operatsiya</b>\n\n" +
              `💰 Miqdor: <b>${payload.type === "income" ? "+" : "-"}${formatAmount(payload.amount ?? 0)}</b>\n` +
              `📂 Kategoriya: <b>${escapeHtml(payload.category || "Noma'lum")}</b>\n` +
              (payload.merchant ? `🏪 Joy: <b>${escapeHtml(payload.merchant)}</b>\n` : "") +
              (payload.description ? `📝: ${escapeHtml(payload.description)}\n` : "");

            try {
              await bot.sendMessage(chatId, notifyText, { parse_mode: "HTML" });
            } catch (err) {
              log(`⚠️  Failed to send Telegram notification: ${err}`);
            }
          } else {
            log("⚠️  Cannot send notification: bot not active or chatId not configured");
          }

          // Emit to dashboard via Socket.io
          emitNewTransaction(payload as ParsedSMS);

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true }));
        } catch (err) {
          log(`❌ Error processing /notify: ${err}`);
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: false, error: "Invalid payload" }));
        }
      });
      return;
    }

    // Health check
    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          status: "ok",
          botActive,
          tokenConfigured: !!settings.botToken,
          chatIdConfigured: !!settings.chatId,
        })
      );
      return;
    }

    // 404 for everything else
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  });
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  log("🚀 Telegram Bot Service starting...");

  // Create HTTP server
  const httpServer = createServer();

  // Setup Socket.io
  setupSocketIO(httpServer);

  // Setup HTTP endpoints
  setupHttpEndpoints(httpServer);

  // Start listening
  httpServer.listen(PORT, () => {
    log(`🌐 HTTP + Socket.io server listening on port ${PORT}`);
  });

  // Load settings and start bot
  await loadSettings();
  syncBotState();

  // Poll settings periodically
  setInterval(async () => {
    await loadSettings();
    syncBotState();
  }, SETTINGS_POLL_INTERVAL);

  // Start weekly report scheduler
  startWeeklyScheduler();

  log("✅ Telegram Bot Service is ready");
}

main().catch((err) => {
  log(`❌ Fatal error: ${err}`);
  process.exit(1);
});