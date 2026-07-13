import { NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET() {
  try {
    const transactions = db.prepare("SELECT * FROM txns ORDER BY createdAt DESC").all();
    return NextResponse.json(transactions);
  } catch (error) {
    console.error("GET transactions error:", error);
    return NextResponse.json({ error: "Server xatosi" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { amount, bankName, cardLast4, smsText } = body;

    if (!amount || typeof amount !== "number" || amount <= 0) {
      return NextResponse.json({ error: "Miqdor noto'g'ri" }, { status: 400 });
    }

    const settings = db.prepare("SELECT * FROM Settings WHERE id = 'default'").get() as Record<string, unknown>;
    const needsPct = Number(settings?.needsPercent ?? 50);
    const wantsPct = Number(settings?.wantsPercent ?? 30);
    const savingsPct = Number(settings?.savingsPercent ?? 20);

    const needsAmount = Math.round((amount * needsPct) / 100);
    const wantsAmount = Math.round((amount * wantsPct) / 100);
    const savingsAmount = Math.round((amount * savingsPct) / 100);

    let paymentLink = "";
    if (settings?.savingsCardNumber) {
      const cardNum = String(settings.savingsCardNumber).replace(/\s/g, "");
      if (settings.paymentService === "click") {
        paymentLink = `https://click.uz/pay?card=${cardNum}&amount=${savingsAmount}`;
      } else {
        paymentLink = `https://payme.uz/pay?card=${cardNum}&amount=${savingsAmount}`;
      }
    }

    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let id = "";
    for (let i = 0; i < 20; i++) id += chars[Math.floor(Math.random() * chars.length)];
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO txns (id, amount, needsAmount, wantsAmount, savingsAmount, smsText, bankName, cardLast4, paymentLink, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, amount, needsAmount, wantsAmount, savingsAmount, smsText || `Qo'lda kiritilgan: ${amount} so'm`, bankName || "Qo'lda", cardLast4 || "", paymentLink, now, now);

    const transaction = db.prepare("SELECT * FROM txns WHERE id = ?").get(id);
    return NextResponse.json(transaction, { status: 201 });
  } catch (error) {
    console.error("POST transaction error:", error);
    return NextResponse.json({ error: "Server xatosi" }, { status: 500 });
  }
}