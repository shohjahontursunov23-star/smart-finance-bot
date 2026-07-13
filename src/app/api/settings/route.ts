import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    let settings = await db.settings.findUnique({ where: { id: "default" } });
    if (!settings) {
      settings = await db.settings.create({ data: { id: "default" } });
    }
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
      needsPercent,
      wantsPercent,
      savingsPercent,
      savingsCardNumber,
      savingsCardBank,
      paymentService,
      telegramBotToken,
      telegramChatId,
      reportDayOfWeek,
      reportHour,
    } = body;

    // Foizlar yig'indisi 100 bo'lishi kerak
    const total =
      (needsPercent ?? 50) + (wantsPercent ?? 30) + (savingsPercent ?? 20);
    if (total !== 100) {
      return NextResponse.json(
        { error: `Foizlar yig'indisi 100 bo'lishi kerak (hozir: ${total})` },
        { status: 400 }
      );
    }

    const settings = await db.settings.upsert({
      where: { id: "default" },
      update: {
        ...(needsPercent !== undefined && { needsPercent }),
        ...(wantsPercent !== undefined && { wantsPercent }),
        ...(savingsPercent !== undefined && { savingsPercent }),
        ...(savingsCardNumber !== undefined && { savingsCardNumber }),
        ...(savingsCardBank !== undefined && { savingsCardBank }),
        ...(paymentService !== undefined && { paymentService }),
        ...(telegramBotToken !== undefined && { telegramBotToken }),
        ...(telegramChatId !== undefined && { telegramChatId }),
        ...(reportDayOfWeek !== undefined && { reportDayOfWeek }),
        ...(reportHour !== undefined && { reportHour }),
      },
      create: {
        id: "default",
        needsPercent: needsPercent ?? 50,
        wantsPercent: wantsPercent ?? 30,
        savingsPercent: savingsPercent ?? 20,
        savingsCardNumber: savingsCardNumber ?? "",
        savingsCardBank: savingsCardBank ?? "payme",
        paymentService: paymentService ?? "payme",
        telegramBotToken: telegramBotToken ?? "",
        telegramChatId: telegramChatId ?? "",
        reportDayOfWeek: reportDayOfWeek ?? 7,
        reportHour: reportHour ?? 20,
      },
    });

    return NextResponse.json(settings);
  } catch (error) {
    console.error("PUT settings error:", error);
    return NextResponse.json({ error: "Server xatosi" }, { status: 500 });
  }
}