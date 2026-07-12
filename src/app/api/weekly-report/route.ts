import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST() {
  try {
    const settings = await db.settings.findUnique({ where: { id: "default" } });

    if (!settings?.telegramBotToken || !settings?.telegramChatId) {
      return NextResponse.json({ success: false, error: "Bot token yoki Chat ID kiritilmagan. Sozlamalar → Telegram Bot" });
    }

    // Get current week data
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const weekTransactions = await db.transaction.findMany({
      where: { createdAt: { gte: weekAgo } },
      orderBy: { createdAt: "desc" },
    });

    if (weekTransactions.length === 0) {
      return NextResponse.json({ success: false, error: "Bu hafta operatsiya yo'q" });
    }

    const totalIncome = weekTransactions.reduce((s, t) => s + t.amount, 0);
    const totalNeeds = weekTransactions.reduce((s, t) => s + t.needsAmount, 0);
    const totalWants = weekTransactions.reduce((s, t) => s + t.wantsAmount, 0);
    const totalSavings = weekTransactions.reduce((s, t) => s + t.savingsAmount, 0);
    const transferred = weekTransactions.filter((t) => t.savingsTransferred).reduce((s, t) => s + t.savingsAmount, 0);
    const pending = totalSavings - transferred;

    const fmt = (n: number) => n.toLocaleString("uz-UZ");

    const reportDate = now.toLocaleDateString("uz-UZ", { day: "numeric", month: "long", year: "numeric" });

    // Build Telegram message
    const message = [
      `<b>📊 Haftalik Moliyaviy Hisobot</b>`,
      `<i>${reportDate}</i>`,
      ``,
      `<b>💰 Jami tushum:</b> ${fmt(totalIncome)} so'm`,
      ``,
      `<b>📌 Taqsimot (${settings.needsPercent}/${settings.wantsPercent}/${settings.savingsPercent}):</b>`,
      `  🟡 Ehtiyojlar: ${fmt(totalNeeds)} so'm (${settings.needsPercent}%)`,
      `  🟣 Xohish-istaklar: ${fmt(totalWants)} so'm (${settings.wantsPercent}%)`,
      `  🟢 Tejash: ${fmt(totalSavings)} so'm (${settings.savingsPercent}%)`,
      ``,
      `<b>🏦 Tejash holati:</b>`,
      `  ✅ O'tkazilgan: ${fmt(transferred)} so'm`,
      `  ⏳ Kutilmoqda: ${fmt(pending)} so'm`,
      ``,
      `<b>📋 Operatsiyalar:</b> ${weekTransactions.length} ta`,
    ].join("\n");

    // Add last 5 transactions
    const recent = weekTransactions.slice(0, 5);
    if (recent.length > 0) {
      message.push(`\n<b>So'nggi operatsiyalar:</b>`);
      for (const tx of recent) {
        const date = new Date(tx.createdAt).toLocaleDateString("uz-UZ", { day: "2-digit", month: "short" });
        message.push(`  • ${date} | ${tx.bankName} | <b>${fmt(tx.amount)}</b> so'm`);
      }
    }

    message.push(`\n<i>— Smart Finance Bot</i>`);

    // Send via Telegram
    const res = await fetch(
      `https://api.telegram.org/bot${settings.telegramBotToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: settings.telegramChatId,
          text: message,
          parse_mode: "HTML",
        }),
      }
    );

    const data = await res.json();

    if (data.ok) {
      return NextResponse.json({
        success: true,
        message: "Haftalik hisobot Telegram'ga yuborildi",
        report: {
          totalIncome, totalNeeds, totalWants, totalSavings,
          transferred, pending, transactionCount: weekTransactions.length,
        },
      });
    }

    return NextResponse.json({ success: false, error: "Telegram'ga yuborish xatosi: " + (data.description || "Noto'g'ri token/Chat ID") });
  } catch (error) {
    console.error("Weekly report error:", error);
    return NextResponse.json({ success: false, error: "Server xatosi" }, { status: 500 });
  }
}

// GET — preview the report without sending
export async function GET() {
  try {
    const settings = await db.settings.findUnique({ where: { id: "default" } });
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const weekTransactions = await db.transaction.findMany({
      where: { createdAt: { gte: weekAgo } },
      orderBy: { createdAt: "desc" },
    });

    const totalIncome = weekTransactions.reduce((s, t) => s + t.amount, 0);
    const totalNeeds = weekTransactions.reduce((s, t) => s + t.needsAmount, 0);
    const totalWants = weekTransactions.reduce((s, t) => s + t.wantsAmount, 0);
    const totalSavings = weekTransactions.reduce((s, t) => s + t.savingsAmount, 0);
    const transferred = weekTransactions.filter((t) => t.savingsTransferred).reduce((s, t) => s + t.savingsAmount, 0);

    const nextReport = new Date();
    const dayOfWeek = settings?.reportDayOfWeek ?? 7;
    const hour = settings?.reportHour ?? 20;
    const currentDay = nextReport.getDay();
    let daysUntil = dayOfWeek - currentDay;
    if (daysUntil <= 0) daysUntil += 7;
    nextReport.setDate(nextReport.getDate() + daysUntil);
    nextReport.setHours(hour, 0, 0, 0);

    return NextResponse.json({
      canSend: !!(settings?.telegramBotToken && settings?.telegramChatId),
      botConnected: !!(settings?.telegramBotToken),
      chatIdSet: !!(settings?.telegramChatId),
      nextReport: nextReport.toISOString(),
      reportDayOfWeek: settings?.reportDayOfWeek ?? 7,
      reportHour: settings?.reportHour ?? 20,
      preview: {
        totalIncome, totalNeeds, totalWants, totalSavings,
        transferred, pending: totalSavings - transferred,
        transactionCount: weekTransactions.length,
      },
    });
  } catch (error) {
    console.error("Weekly report preview error:", error);
    return NextResponse.json({ error: "Server xatosi" }, { status: 500 });
  }
}