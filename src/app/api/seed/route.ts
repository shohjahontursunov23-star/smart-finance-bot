import { NextResponse } from "next/server";
import db from "@/lib/db";

export async function POST() {
  try {
    db.prepare("INSERT OR IGNORE INTO Settings (id) VALUES ('default')").run();
    const settings = db.prepare("SELECT * FROM Settings WHERE id = 'default'").get() as Record<string, unknown>;

    const needsPct = Number(settings?.needsPercent ?? 50);
    const wantsPct = Number(settings?.wantsPercent ?? 30);
    const savingsPct = Number(settings?.savingsPercent ?? 20);

    db.prepare("DELETE FROM txns").run();

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

    const insert = db.prepare(`
      INSERT INTO txns (id, amount, needsAmount, wantsAmount, savingsAmount, smsText, bankName, cardLast4, paymentLink, savingsTransferred, confirmedAt, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let count = 0;

    for (const sms of SAMPLE_SMS) {
      const match = sms.match(/(\d[\d\s,.]*)\s*(?:so'm|UZS)/i);
      if (!match) continue;
      const amount = parseInt(match[1].replace(/[\s,.]/g, ""), 10);
      if (isNaN(amount) || amount <= 0) continue;

      const lower = sms.toLowerCase();
      let bankName = "Noma'lum";
      if (lower.includes("uzum")) bankName = "Uzum Bank";
      else if (lower.includes("kapital")) bankName = "Kapitalbank";
      else if (lower.includes("tbc")) bankName = "TBC Bank";
      else if (lower.includes("anor")) bankName = "Anorbank";
      else if (lower.includes("nbu")) bankName = "NBU";

      const cardMatch = sms.match(/\*{0,4}(\d{4})/);
      const cardLast4 = cardMatch ? cardMatch[1] : "";

      let id = "";
      for (let i = 0; i < 20; i++) id += chars[Math.floor(Math.random() * chars.length)];

      const daysAgo = Math.floor(Math.random() * 30);
      const pastDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
      const transferred = Math.random() > 0.4 ? 1 : 0;

      insert.run(
        id, amount,
        Math.round((amount * needsPct) / 100),
        Math.round((amount * wantsPct) / 100),
        Math.round((amount * savingsPct) / 100),
        sms, bankName, cardLast4, "",
        transferred,
        transferred ? pastDate : null,
        pastDate, pastDate
      );
      count++;
    }

    return NextResponse.json({ success: true, count, message: `${count} ta namuna operatsiya qo'shildi` });
  } catch (error) {
    console.error("Seed error:", error);
    return NextResponse.json({ success: false, error: "Server xatosi" }, { status: 500 });
  }
}