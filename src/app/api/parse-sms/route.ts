import { NextResponse } from "next/server";
import db from "@/lib/db";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// HUMOcardbot Telegram xabar parser
function parseHUMOBotMessage(text: string): { amount: number; bankName: string; cardLast4: string } | null {
  if (!/HUMO Card:|💳.*HUMOCARD/i.test(text)) return null;

  const emojiMatch = text.match(/[➖➕]\s*([\d.,]+)\s*UZS/i);
  if (emojiMatch) {
    const amount = parseInt(emojiMatch[1].replace(/\./g, "").replace(",", ""), 10);
    if (!isNaN(amount) && amount > 0) {
      const cardMatch = text.match(/💳\s*HUMOCARD\s*\*(\d+)/i);
      return { amount, bankName: "HUMO", cardLast4: cardMatch ? cardMatch[1] : "" };
    }
  }

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

function extractCardLast4(sms: string): string {
  const m = sms.match(/(?:karta|card|HUMOCARD)[^:]*:?\s*\*?(\d{4})/i);
  return m ? m[1] : "";
}

function generateId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  for (let i = 0; i < 20; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sms, apiKey: providedKey } = body;

    if (!sms || typeof sms !== "string") {
      return NextResponse.json({ error: "SMS matni talab qilinadi" }, { status: 400, headers: CORS_HEADERS });
    }

    // API kalit tekshirish
    const settings = db.prepare("SELECT * FROM Settings WHERE id = 'default'").get() as Record<string, unknown>;
    if (settings?.apiKey && String(settings.apiKey).length > 10) {
      if (providedKey !== settings.apiKey) {
        return NextResponse.json({ error: "API kalit noto'g'ri" }, { status: 401, headers: CORS_HEADERS });
      }
    }

    // Parsing
    const botResult = parseHUMOBotMessage(sms);
    const amount = botResult?.amount ?? extractAmount(sms);
    const bankName = botResult?.bankName ?? detectBank(sms);
    const cardLast4 = botResult?.cardLast4 || extractCardLast4(sms);

    if (amount === null) {
      return NextResponse.json({ error: "SMS'dan pul miqdorini aniqlab bo'lmadi", parsed: false }, { status: 422, headers: CORS_HEADERS });
    }

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

    const id = generateId();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO txns (id, amount, needsAmount, wantsAmount, savingsAmount, smsText, bankName, cardLast4, paymentLink, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, amount, needsAmount, wantsAmount, savingsAmount, sms, bankName, cardLast4, paymentLink, now, now);

    return NextResponse.json({
      parsed: true,
      transaction: { id, amount, needsAmount, wantsAmount, savingsAmount, bankName, cardLast4, paymentLink, createdAt: now },
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