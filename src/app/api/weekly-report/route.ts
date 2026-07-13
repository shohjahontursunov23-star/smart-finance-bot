import { NextResponse } from "next/server";
import db from "@/lib/db";

export async function POST() {
  try {
    const settings = db.prepare("SELECT * FROM Settings WHERE id = 'default'").get() as Record<string, unknown> | undefined;

    if (!settings?.telegramBotToken || !settings?.telegramChatId) {
      return NextResponse.json({ success: false, error: "Bot token yoki Chat ID kiritilmagan" });
    }

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const txs = db.prepare("SELECT * FROM Transaction WHERE createdAt >= ? ORDER BY createdAt DESC").all(weekAgo) as Record<string, unknown>[];

    if (txs.length === 0) {
      return NextResponse.json({ success: false, error: "Bu hafta operatsiya yo'q" });
    }

    const fmt = (n: number) => Number(n).toLocaleString("uz-UZ");
    const totalIncome = txs.reduce((s, t) => s + Number(t.amount), 0);
    const totalNeeds = txs.reduce((s, t) => s + Number(t.needsAmount), 0);
    const totalWants = txs.reduce((s, t) => s + Number(t.wantsAmount), 0);
    const totalSavings = txs.reduce((s, t) => s + Number(t.savingsAmount), 0);
    const transferred = txs.filter((t) => Number(t.savingsTransferred) === 1).reduce((s, t) => s + Number(t.savingsAmount), 0);

    const now = new Date();
    const reportDate = now.toLocaleDateString("uz-UZ", { day: "numeric", month: "long", year: "numeric" });
    const np = Number(settings.needsPercent ?? 50);
    const wp = Number(settings.wantsPercent ?? 30);
    const sp = Number(settings.savingsPercent ?? 20);

    const message = [
      `<b>📊 Haftalik Moliyaviy Hisobot</b>`,
      `<i>${reportDate}</i>`, "",
      `<b>💰 Jami tushum:</b> ${fmt(totalIncome)} so'm`, "",
      `<b>📌 Taqsimot (${np}/${wp}/${sp}):</b>`,
      `  🟡 Ehtiyojlar: ${fmt(totalNeeds)} so'm (${np}%)`,
      `  🟣 Xohish-istaklar: ${fmt(totalWants)} so'm (${wp}%)`,
      `  🟢 Tejash: ${fmt(totalSavings)} so'm (${sp}%)`, "",
      `<b>🏦 Tejash holati:</b>`,
      `  ✅ O'tkazilgan: ${fmt(transferred)} so'm`,
      `  ⏳ Kutilmoqda: ${fmt(totalSavings - transferred)} so'm`, "",
      `<b>📋 Operatsiyalar:</b> ${txs.length} ta`,
    ].join("\n");

    const recent = txs.slice(0, 5);
    if (recent.length > 0) {
      message.push(`\n<b>So'nggi operatsiyalar:</b>`);
      for (const tx of recent) {
        const date = new Date(String(tx.createdAt)).toLocaleDateString("uz-UZ", { day: "2-digit", month: "short" });
        message.push(`  • ${date} | ${tx.bankName} | <b>${fmt(Number(tx.amount))}</b> so'm`);
      }
    }
    message.push(`\n<i>— Smart Finance Bot</i>`);

    const res = await fetch(`https://api.telegram.org/bot${settings.telegramBotToken}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: settings.telegramChatId, text: message, parse_mode: "HTML" }),
    });
    const data = await res.json();
    return NextResponse.json(data.ok ? { success: true, message: "Hisobot yuborildi" } : { success: false, error: "Telegram xatosi" });
  } catch (error) {
    console.error("Weekly report error:", error);
    return NextResponse.json({ success: false, error: "Server xatosi" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const settings = db.prepare("SELECT * FROM Settings WHERE id = 'default'").get() as Record<string, unknown> | undefined;
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const txs = db.prepare("SELECT * FROM Transaction WHERE createdAt >= ?").all(weekAgo) as Record<string, unknown>[];

    const totalSavings = txs.reduce((s, t) => s + Number(t.savingsAmount), 0);
    const transferred = txs.filter((t) => Number(t.savingsTransferred) === 1).reduce((s, t) => s + Number(t.savingsAmount), 0);

    const nextReport = new Date();
    const dow = Number(settings?.reportDayOfWeek ?? 7);
    const hour = Number(settings?.reportHour ?? 20);
    let daysUntil = dow - nextReport.getDay();
    if (daysUntil <= 0) daysUntil += 7;
    nextReport.setDate(nextReport.getDate() + daysUntil);
    nextReport.setHours(hour, 0, 0, 0);

    return NextResponse.json({
      canSend: !!(settings?.telegramBotToken && settings?.telegramChatId),
      botConnected: !!(settings?.telegramBotToken),
      chatIdSet: !!(settings?.telegramChatId),
      nextReport: nextReport.toISOString(),
      preview: { totalIncome: txs.reduce((s, t) => s + Number(t.amount), 0), totalSavings, transferred, pending: totalSavings - transferred, transactionCount: txs.length },
    });
  } catch (error) {
    console.error("Weekly report error:", error);
    return NextResponse.json({ error: "Server xatosi" }, { status: 500 });
  }
}