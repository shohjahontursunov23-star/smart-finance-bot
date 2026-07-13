import { NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET() {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
    monthEnd.replace("T00", "T00"); // just ensure format

    const monthTxs = db.prepare("SELECT * FROM txns WHERE createdAt >= ? AND createdAt < ? ORDER BY createdAt DESC").all(monthStart, new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString()) as Record<string, unknown>[];

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const weekTxs = db.prepare("SELECT * FROM txns WHERE createdAt >= ? ORDER BY createdAt DESC").all(weekAgo) as Record<string, unknown>[];

    const sum = (arr: Record<string, unknown>[], key: string) => arr.reduce((s, t) => s + Number(t[key] || 0), 0);
    const sumIf = (arr: Record<string, unknown>[], key: string, filterKey: string) => arr.filter(t => Number(t[filterKey]) === 1).reduce((s, t) => s + Number(t[key] || 0), 0);

    // Kunlik statistika
    const dailyStats: { date: string; income: number; savings: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const day = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate()).toISOString();
      const dayEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1).toISOString();
      const dayTx = db.prepare("SELECT * FROM txns WHERE createdAt >= ? AND createdAt < ?").all(dayStart, dayEnd) as Record<string, unknown>[];
      dailyStats.push({
        date: day.toLocaleDateString("uz-UZ", { day: "2-digit", month: "short" }),
        income: sum(dayTx, "amount"),
        savings: sum(dayTx, "savingsAmount"),
      });
    }

    // Banklar bo'yicha
    const bankStats: Record<string, { count: number; total: number }> = {};
    for (const t of monthTxs) {
      const bank = String(t.bankName || "Noma'lum");
      if (!bankStats[bank]) bankStats[bank] = { count: 0, total: 0 };
      bankStats[bank].count++;
      bankStats[bank].total += Number(t.amount);
    }

    return NextResponse.json({
      month: {
        totalIncome: sum(monthTxs, "amount"),
        totalNeeds: sum(monthTxs, "needsAmount"),
        totalWants: sum(monthTxs, "wantsAmount"),
        totalSavings: sum(monthTxs, "savingsAmount"),
        transferredSavings: sumIf(monthTxs, "savingsAmount", "savingsTransferred"),
        pendingSavings: sum(monthTxs, "savingsAmount") - sumIf(monthTxs, "savingsAmount", "savingsTransferred"),
        transactionCount: monthTxs.length,
      },
      week: {
        totalIncome: sum(weekTxs, "amount"),
        totalNeeds: sum(weekTxs, "needsAmount"),
        totalWants: sum(weekTxs, "wantsAmount"),
        totalSavings: sum(weekTxs, "savingsAmount"),
        transactionCount: weekTxs.length,
      },
      dailyStats,
      bankStats,
    });
  } catch (error) {
    console.error("Report error:", error);
    return NextResponse.json({ error: "Server xatosi" }, { status: 500 });
  }
}