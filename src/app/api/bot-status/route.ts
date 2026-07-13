import { NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET() {
  try {
    const settings = db.prepare("SELECT * FROM Settings WHERE id = 'default'").get() as Record<string, unknown> | undefined;

    if (!settings?.telegramBotToken) {
      return NextResponse.json({ connected: false, message: "Bot token kiritilmagan" });
    }

    const res = await fetch(`https://api.telegram.org/bot${settings.telegramBotToken}/getMe`);
    const data = await res.json();

    if (data.ok) {
      return NextResponse.json({ connected: true, botName: data.result.first_name, username: data.result.username });
    }
    return NextResponse.json({ connected: false, message: "Bot token noto'g'ri" });
  } catch {
    return NextResponse.json({ connected: false, message: "Tekshirib bo'lmadi" });
  }
}

export async function POST(request: Request) {
  try {
    const { message } = await request.json();
    const settings = db.prepare("SELECT * FROM Settings WHERE id = 'default'").get() as Record<string, unknown> | undefined;

    if (!settings?.telegramBotToken || !settings?.telegramChatId) {
      return NextResponse.json({ success: false, error: "Bot token yoki Chat ID kiritilmagan" });
    }

    const res = await fetch(`https://api.telegram.org/bot${settings.telegramBotToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: settings.telegramChatId, text: message, parse_mode: "HTML" }),
    });
    const data = await res.json();
    return NextResponse.json({ success: data.ok });
  } catch {
    return NextResponse.json({ success: false, error: "Xatolik" });
  }
}