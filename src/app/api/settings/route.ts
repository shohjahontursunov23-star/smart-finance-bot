import { NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET() {
  try {
    const settings = db.prepare("SELECT * FROM Settings WHERE id = 'default'").get();
    return NextResponse.json(settings);
  } catch (error) {
    console.error("GET settings error:", error);
    return NextResponse.json({ error: "Server xatosi" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const {
      needsPercent, wantsPercent, savingsPercent,
      savingsCardNumber, savingsCardBank, paymentService,
      telegramBotToken, telegramChatId,
      reportDayOfWeek, reportHour,
    } = body;

    const n = needsPercent ?? 50;
    const w = wantsPercent ?? 30;
    const s = savingsPercent ?? 20;
    if (n + w + s !== 100) {
      return NextResponse.json({ error: `Foizlar yig'indisi 100 bo'lishi kerak (hozir: ${n + w + s})` }, { status: 400 });
    }

    const now = new Date().toISOString();
    db.prepare(`
      UPDATE Settings SET
        needsPercent = ?, wantsPercent = ?, savingsPercent = ?,
        savingsCardNumber = ?, savingsCardBank = ?, paymentService = ?,
        telegramBotToken = ?, telegramChatId = ?,
        reportDayOfWeek = ?, reportHour = ?, updatedAt = ?
      WHERE id = 'default'
    `).run(
      n, w, s,
      savingsCardNumber ?? "", savingsCardBank ?? "payme", paymentService ?? "payme",
      telegramBotToken ?? "", telegramChatId ?? "",
      reportDayOfWeek ?? 7, reportHour ?? 20, now
    );

    const settings = db.prepare("SELECT * FROM Settings WHERE id = 'default'").get();
    return NextResponse.json(settings);
  } catch (error) {
    console.error("PUT settings error:", error);
    return NextResponse.json({ error: "Server xatosi" }, { status: 500 });
  }
}