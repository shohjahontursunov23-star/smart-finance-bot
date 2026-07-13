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

// HUMOcardbot Telegram message parser
function parseHUMOBotMessage(text: string): { amount: number; bankName: string; cardLast4: string } | null {
  const isHUMO = /HUMO Card:|💳.*HUMOCARD/i.test(text);
  if (!isHUMO) return null;

  // Try emoji format: ➖ 5.000,00 UZS or ➕ 5.000,00 UZS
  const emojiAmountMatch = text.match(/[➖➕]\s*([\d.,]+)\s*UZS/i);
  if (emojiAmountMatch) {
    const amount = parseInt(emojiAmountMatch[1].replace(/\./g, "").replace(",", ""), 10);
    if (!isNaN(amount) && amount > 0) {
      const cardMatch = text.match(/💳\s*HUMOCARD\s*\*(\d+)/i);
      return {
        amount,
        bankName: "HUMO",
        cardLast4: cardMatch ? cardMatch[1] : "",
      };
    }
  }

  // Try regular SMS format from HUMO
  const regularAmountMatch = text.match(/(\d[\d\s,.]*)\s*(?:so'm|UZS)/i);
  if (regularAmountMatch) {
    const amount = parseInt(regularAmountMatch[1].replace(/[\s,.]/g, ""), 10);
    if (!isNaN(amount) && amount > 0) {
      const cardMatch = text.match(/HUMOCARD\s*\*(\d+)/i);
      return {
        amount,
        bankName: "HUMO",
        cardLast4: cardMatch ? cardMatch[1] : "",
      };
    }
  }

  return null;
}

// SMS parsing patterns for Uzbekistan banks
function detectBank(sms: string): string {
  if (/HUMO/i.test(sms)) return "HUMO";
  const bankKeywords: { bank: string; keywords: string[] }[] = [
    { bank: "Uzum Bank", keywords: ["uzum", "uzumbank"] },
    { bank: "Kapitalbank", keywords: ["kapital"] },
    { bank: "TBC Bank", keywords: ["tbc"] },
    { bank: "Anorbank", keywords: ["anor"] },
    { bank: "NBU", keywords: ["nbu", "milliy"] },
    { bank: "Click", keywords: ["click"] },
    { bank: "Ipoteka Bank", keywords: ["ipoteka"] },
    { bank: "Turon Bank", keywords: ["turon"] },
    { bank: "Infinbank", keywords: ["infin"] },
    { bank: "Soliq Bank", keywords: ["soliq"] },
    { bank: "Xalq Bank", keywords: ["xalq"] },
    { bank: "SQB", keywords: ["sqb", "savdogar"] },
    { bank: "Aloqa Bank", keywords: ["aloqa"] },
    { bank: "Trustbank", keywords: ["trust"] },
    { bank: "Hamkorbank", keywords: ["hamkor"] },
    { bank: "Davrbank", keywords: ["davr"] },
    { bank: "Mo'javodor", keywords: ["mojavodor"] },
  ];
  const lower = sms.toLowerCase();
  for (const { bank, keywords } of bankKeywords) {
    if (keywords.some((k) => lower.includes(k))) return bank;
  }
  return "Noma'lum";
}

function extractAmount(sms: string): number | null {
  const patterns = [
    /(?:kartaingizga|o'tkazildi|kredit|tushdi|postuplenie|received|hisob|karta|popolnenie)[^\d]*(\d[\d\s,.]*)\s*(?:so'm|UZS)/i,
    /(\d[\d\s,.]*)\s*(?:so'm|UZS|sum)/i,
  ];
  for (const pattern of patterns) {
    const match = sms.match(pattern);
    if (match) {
      const raw = match[1].replace(/[\s,.]/g, "");
      const num = parseInt(raw, 10);
      if (!isNaN(num) && num > 0) return num;
    }
  }
  return null;
}

function extractCardLast4(sms: string): string {
  const match = sms.match(/(?:karta|card|HUMOCARD)[^:]*:?\s*\*?(\d{4})/i);
  return match ? match[1] : "";
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sms, apiKey: providedKey } = body;

    if (!sms || typeof sms !== "string") {
      return NextResponse.json({ error: "SMS matni talab qilinadi" }, { status: 400, headers: CORS_HEADERS });
    }

    // Check API key if set in settings
    const settings = await db.settings.findUnique({ where: { id: "default" } });
    if (settings?.apiKey && settings.apiKey.length > 10) {
      if (providedKey !== settings.apiKey) {
        return NextResponse.json({ error: "API kalit noto'g'ri" }, { status: 401, headers: CORS_HEADERS });
      }
    }

    // Try HUMOcardbot format first, then generic SMS
    const botResult = parseHUMOBotMessage(sms);
    const amount = botResult?.amount ?? extractAmount(sms);
    const bankName = botResult?.bankName ?? detectBank(sms);
    const cardLast4 = botResult?.cardLast4 || extractCardLast4(sms);

    if (amount === null) {
      return NextResponse.json({ error: "SMS'dan pul miqdorini aniqlab bo'lmadi", parsed: false }, { status: 422, headers: CORS_HEADERS });
    }

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
        amount, needsAmount, wantsAmount, savingsAmount,
        smsText: sms, bankName, cardLast4, paymentLink,
      },
    });

    return NextResponse.json({
      parsed: true,
      transaction: {
        id: transaction.id, amount: transaction.amount,
        needsAmount: transaction.needsAmount, wantsAmount: transaction.wantsAmount,
        savingsAmount: transaction.savingsAmount, bankName: transaction.bankName,
        cardLast4: transaction.cardLast4, paymentLink: transaction.paymentLink,
        createdAt: transaction.createdAt,
      },
      breakdown: {
        needs: { percent: needsPct, amount: needsAmount, label: "Ehtiyojlar" },
        wants: { percent: wantsPct, amount: wantsAmount, label: "Xohish-istaklar" },
        savings: { percent: savingsPct, amount: savingsAmount, label: "Tejash" },
      },
    }, { headers: CORS_HEADERS });
  } catch (error) {
    console.error("SMS parse error:", error);
    return NextResponse.json({ error: "Server xatosi" }, { status: 500, headers: CORS_HEADERS });
  }
}