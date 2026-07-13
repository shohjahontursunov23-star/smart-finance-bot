import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// HUMOcardbot Telegram xabar formati:
// HUMO Card:
// 💸 To'lov
// ➖ 5.000,00 UZS
// 📍 PAYNET P2P HUM2UZC>S
// 💳 HUMOCARD *4661
// 🕓 03:31 13.07.2026
// 💰 211.322,00 UZS
function parseHUMOBotMessage(
  text: string
): { amount: number; bankName: string; cardLast4: string } | null {
  if (!/HUMO Card:|💳.*HUMOCARD/i.test(text)) return null;

  // Emoji format: ➖ 5.000,00 UZS
  const emojiMatch = text.match(/[➖➕]\s*([\d.,]+)\s*UZS/i);
  if (emojiMatch) {
    const amount = parseInt(emojiMatch[1].replace(/\./g, "").replace(",", ""), 10);
    if (!isNaN(amount) && amount > 0) {
      const cardMatch = text.match(/💳\s*HUMOCARD\s*\*(\d+)/i);
      return {
        amount,
        bankName: "HUMO",
        cardLast4: cardMatch ? cardMatch[1] : "",
      };
    }
  }

  // Regular format
  const regularMatch = text.match(/(\d[\d\s,.]*)\s*(?:so'm|UZS)/i);
  if (regularMatch) {
    const amount = parseInt(regularMatch[1].replace(/[\s,.]/g, ""), 10);
    if (!isNaN(amount) && amount > 0) {
      const cardMatch = text.match(/HUMOCARD\s*\*(\d+)/i);
      return { amount, bankName: "HUMO", cardLast4: cardMatch ? cardMatch[1] : "" };
    }
  }

  return null;
}

// O'zbekiston banklari bo'yicha aniqlash
function detectBank(sms: string): string {
  if (/HUMO/i.test(sms)) return "HUMO";
  const banks: { name: string; words: string[] }[] = [
    { name: "Uzum Bank", words: ["uzum", "uzumbank"] },
    { name: "Kapitalbank", words: ["kapital"] },
    { name: "TBC Bank", words: ["tbc"] },
    { name: "Anorbank", words: ["anor"] },
    { name: "NBU", words: ["nbu", "milliy"] },
    { name: "Click", words: ["click"] },
    { name: "Ipoteka Bank", words: ["ipoteka"] },
    { name: "Turon Bank", words: ["turon"] },
    { name: "Infinbank", words: ["infin"] },
    { name: "Soliq Bank", words: ["soliq"] },
    { name: "Xalq Bank", words: ["xalq"] },
    { name: "SQB", words: ["sqb", "savdogar"] },
    { name: "Aloqa Bank", words: ["aloqa"] },
    { name: "Trustbank", words: ["trust"] },
    { name: "Hamkorbank", words: ["hamkor"] },
    { name: "Davrbank", words: ["davr"] },
  ];
  const lower = sms.toLowerCase();
  for (const b of banks) {
    if (b.words.some((w) => lower.includes(w))) return b.name;
  }
  return "Noma'lum";
}

// Pul miqdorini ajratib olish
function extractAmount(sms: string): number | null {
  const patterns = [
    /(?:kartaingizga|o'tkazildi|kredit|tushdi|postuplenie|received|hisob|karta|popolnenie)[^\d]*(\d[\d\s,.]*)\s*(?:so'm|UZS)/i,
    /(\d[\d\s,.]*)\s*(?:so'm|UZS|sum)/i,
  ];
  for (const p of patterns) {
    const m = sms.match(p);
    if (m) {
      const num = parseInt(m[1].replace(/[\s,.]/g, ""), 10);
      if (!isNaN(num) && num > 0) return num;
    }
  }
  return null;
}

// Karta oxirgi 4 raqam
function extractCardLast4(sms: string): string {
  const m = sms.match(/(?:karta|card|HUMOCARD)[^:]*:?\s*\*?(\d{4})/i);
  return m ? m[1] : "";
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sms, apiKey: providedKey } = body;

    if (!sms || typeof sms !== "string") {
      return NextResponse.json(
        { error: "SMS matni talab qilinadi" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // API kalit tekshirish
    const settings = await db.settings.findUnique({ where: { id: "default" } });
    if (settings?.apiKey && settings.apiKey.length > 10) {
      if (providedKey !== settings.apiKey) {
        return NextResponse.json(
          { error: "API kalit noto'g'ri" },
          { status: 401, headers: CORS_HEADERS }
        );
      }
    }

    // HUMOcardbot formatni avval tekshiramiz
    const botResult = parseHUMOBotMessage(sms);
    const amount = botResult?.amount ?? extractAmount(sms);
    const bankName = botResult?.bankName ?? detectBank(sms);
    const cardLast4 = botResult?.cardLast4 || extractCardLast4(sms);

    if (amount === null) {
      return NextResponse.json(
        { error: "SMS'dan pul miqdorini aniqlab bo'lmadi", parsed: false },
        { status: 422, headers: CORS_HEADERS }
      );
    }

    const needsPct = settings?.needsPercent ?? 50;
    const wantsPct = settings?.wantsPercent ?? 30;
    const savingsPct = settings?.savingsPercent ?? 20;

    const needsAmount = Math.round((amount * needsPct) / 100);
    const wantsAmount = Math.round((amount * wantsPct) / 100);
    const savingsAmount = Math.round((amount * savingsPct) / 100);

    // To'lov havolasi
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
        smsText: sms,
        bankName,
        cardLast4,
        paymentLink,
      },
    });

    return NextResponse.json(
      {
        parsed: true,
        transaction: {
          id: transaction.id,
          amount: transaction.amount,
          needsAmount: transaction.needsAmount,
          wantsAmount: transaction.wantsAmount,
          savingsAmount: transaction.savingsAmount,
          bankName: transaction.bankName,
          cardLast4: transaction.cardLast4,
          paymentLink: transaction.paymentLink,
          createdAt: transaction.createdAt,
        },
        breakdown: {
          needs: { percent: needsPct, amount: needsAmount, label: "Ehtiyojlar" },
          wants: { percent: wantsPct, amount: wantsAmount, label: "Xohish-istaklar" },
          savings: { percent: savingsPct, amount: savingsAmount, label: "Tejash" },
        },
      },
      { headers: CORS_HEADERS }
    );
  } catch (error) {
    console.error("SMS parse error:", error);
    return NextResponse.json(
      { error: "Server xatosi" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}