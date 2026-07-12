import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import fs from "fs";
import path from "path";

const SAMPLE_SMS = [
  "Uzum Bank. Karta: 1234. Balans: 550,000 so'm. Kartaingizga 50,000 so'm o'tkazildi.",
  "Kapitalbank: Kartangizga 1,250,000 so'm tushdi. Karta ****4567. Balans: 3,200,000 so'm.",
  "TBC Bank: Hisobingizga 320,000 so'm o'tkazildi. Karta ****8901.",
  "Anorbank: Kartaingizga 750,000 so'm tushdi. Balans: 2,100,000 so'm. Karta: ****2345.",
  "Uzum Bank: Karta ****6789. Kartaingizga 2,000,000 so'm o'tkazildi. Balans: 5,500,000 so'm.",
  "NBU: Kartangizga 180,000 so'm tushdi. Karta ****1111. Balans: 900,000 so'm.",
  "Uzum Bank: Karta ****1234. Kartaingizga 95,000 so'm o'tkazildi. Balans: 645,000 so'm.",
  "Kapitalbank: Hisobingizga 3,500,000 so'm tushdi. Karta ****4567. Balans: 8,700,000 so'm.",
];

export async function POST() {
  try {
    // Ensure db folder exists
    const dbDir = path.join(process.cwd(), "db");
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    // Ensure default settings exist
    try {
      await db.settings.upsert({
        where: { id: "default" },
        update: {},
        create: {
          id: "default",
          needsPercent: 50,
          wantsPercent: 30,
          savingsPercent: 20,
        },
      });
    } catch (settingsErr) {
      console.error("Settings upsert error:", settingsErr);
      // Non-fatal — continue with defaults
    }

    const settings = await db.settings.findUnique({ where: { id: "default" } });
    const needsPct = settings?.needsPercent ?? 50;
    const wantsPct = settings?.wantsPercent ?? 30;
    const savingsPct = settings?.savingsPercent ?? 20;

    // Clear old seed data to avoid duplicates
    await db.transaction.deleteMany({});

    const created = [];
    for (const sms of SAMPLE_SMS) {
      // Extract amount
      const match = sms.match(/(\d[\d\s,.]*)\s*(?:so'm|UZS)/i);
      if (!match) continue;

      const amount = parseInt(match[1].replace(/[\s,.]/g, ""), 10);
      if (isNaN(amount) || amount <= 0) continue;

      // Detect bank
      const lower = sms.toLowerCase();
      let bankName = "Noma'lum";
      if (lower.includes("uzum")) bankName = "Uzum Bank";
      else if (lower.includes("kapital")) bankName = "Kapitalbank";
      else if (lower.includes("tbc")) bankName = "TBC Bank";
      else if (lower.includes("anor")) bankName = "Anorbank";
      else if (lower.includes("nbu")) bankName = "NBU";

      // Extract card last 4
      const cardMatch = sms.match(/\*{0,4}(\d{4})/);
      const cardLast4 = cardMatch ? cardMatch[1] : "";

      const needsAmount = Math.round((amount * needsPct) / 100);
      const wantsAmount = Math.round((amount * wantsPct) / 100);
      const savingsAmount = Math.round((amount * savingsPct) / 100);

      // Random date within last 30 days
      const daysAgo = Math.floor(Math.random() * 30);
      const pastDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);

      const tx = await db.transaction.create({
        data: {
          amount,
          needsAmount,
          wantsAmount,
          savingsAmount,
          smsText: sms,
          bankName,
          cardLast4,
          paymentLink: "",
          savingsTransferred: Math.random() > 0.4,
          confirmedAt: Math.random() > 0.4 ? pastDate : null,
          createdAt: pastDate,
        },
      });
      created.push(tx);
    }

    return NextResponse.json({
      success: true,
      count: created.length,
      message: `${created.length} ta namuna operatsiya qo'shildi`,
    });
  } catch (error) {
    console.error("Seed error:", error);
    const message = error instanceof Error ? error.message : "Noma'lum xatolik";
    return NextResponse.json(
      { success: false, error: "Server xatosi", details: message },
      { status: 500 }
    );
  }
}