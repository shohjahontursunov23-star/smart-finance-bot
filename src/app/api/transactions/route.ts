import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const transactions = await db.transaction.findMany({
      orderBy: { createdAt: "desc" },
    });
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
      return NextResponse.json(
        { error: "Miqdor noto'g'ri" },
        { status: 400 }
      );
    }

    const settings = await db.settings.findUnique({ where: { id: "default" } });
    const needsPct = settings?.needsPercent ?? 50;
    const wantsPct = settings?.wantsPercent ?? 30;
    const savingsPct = settings?.savingsPercent ?? 20;

    const needsAmount = Math.round((amount * needsPct) / 100);
    const wantsAmount = Math.round((amount * wantsPct) / 100);
    const savingsAmount = Math.round((amount * savingsPct) / 100);

    let paymentLink = "";
    if (settings?.savingsCardNumber) {
      const cardNum = settings.savingsCardNumber.replace(/\s/g, "");
      if (settings.paymentService === "click") {
        paymentLink = `https://click.uz/pay?card=${cardNum}&amount=${savingsAmount}`;
      } else {
        paymentLink = `https://payme.uz/pay?card=${cardNum}&amount=${savingsAmount}`;
      }
    }

    const transaction = await db.transaction.create({
      data: {
        amount,
        needsAmount,
        wantsAmount,
        savingsAmount,
        smsText: smsText || `Qo'lda kiritilgan: ${amount} so'm`,
        bankName: bankName || "Qo'lda",
        cardLast4: cardLast4 || "",
        paymentLink,
      },
    });

    return NextResponse.json(transaction, { status: 201 });
  } catch (error) {
    console.error("POST transaction error:", error);
    return NextResponse.json({ error: "Server xatosi" }, { status: 500 });
  }
}