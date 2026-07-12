import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const now = new Date();

    // Current month stats
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const monthTransactions = await db.transaction.findMany({
      where: {
        createdAt: { gte: monthStart, lt: monthEnd },
      },
      orderBy: { createdAt: "desc" },
    });

    const totalIncome = monthTransactions.reduce((s, t) => s + t.amount, 0);
    const totalNeeds = monthTransactions.reduce((s, t) => s + t.needsAmount, 0);
    const totalWants = monthTransactions.reduce((s, t) => s + t.wantsAmount, 0);
    const totalSavings = monthTransactions.reduce(
      (s, t) => s + t.savingsAmount,
      0
    );
    const transferredSavings = monthTransactions
      .filter((t) => t.savingsTransferred)
      .reduce((s, t) => s + t.savingsAmount, 0);

    // Weekly stats (last 7 days)
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const weekTransactions = await db.transaction.findMany({
      where: { createdAt: { gte: weekAgo } },
      orderBy: { createdAt: "desc" },
    });

    const weekIncome = weekTransactions.reduce((s, t) => s + t.amount, 0);
    const weekNeeds = weekTransactions.reduce((s, t) => s + t.needsAmount, 0);
    const weekWants = weekTransactions.reduce((s, t) => s + t.wantsAmount, 0);
    const weekSavings = weekTransactions.reduce(
      (s, t) => s + t.savingsAmount,
      0
    );

    // Daily stats for chart (last 14 days)
    const dailyStats: { date: string; income: number; savings: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const day = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate());
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

      const dayTx = await db.transaction.findMany({
        where: { createdAt: { gte: dayStart, lt: dayEnd } },
      });

      dailyStats.push({
        date: day.toLocaleDateString("uz-UZ", { day: "2-digit", month: "short" }),
        income: dayTx.reduce((s, t) => s + t.amount, 0),
        savings: dayTx.reduce((s, t) => s + t.savingsAmount, 0),
      });
    }

    // Bank breakdown
    const bankStats = monthTransactions.reduce(
      (acc, t) => {
        const bank = t.bankName || "Noma'lum";
        if (!acc[bank]) acc[bank] = { count: 0, total: 0 };
        acc[bank].count++;
        acc[bank].total += t.amount;
        return acc;
      },
      {} as Record<string, { count: number; total: number }>
    );

    return NextResponse.json({
      month: {
        totalIncome,
        totalNeeds,
        totalWants,
        totalSavings,
        transferredSavings,
        pendingSavings: totalSavings - transferredSavings,
        transactionCount: monthTransactions.length,
      },
      week: {
        totalIncome: weekIncome,
        totalNeeds: weekNeeds,
        totalWants: weekWants,
        totalSavings: weekSavings,
        transactionCount: weekTransactions.length,
      },
      dailyStats,
      bankStats,
    });
  } catch (error) {
    console.error("Report error:", error);
    return NextResponse.json({ error: "Server xatosi" }, { status: 500 });
  }
}