import { NextResponse } from "next/server";
import db from "@/lib/db";
import * as XLSX from "xlsx";

export async function GET() {
  try {
    const txs = db.prepare("SELECT * FROM txns ORDER BY createdAt DESC").all() as Record<string, unknown>[];
    const settings = db.prepare("SELECT * FROM Settings WHERE id = 'default'").get() as Record<string, unknown> | undefined;

    const rows = txs.map((tx) => ({
      Sana: new Date(String(tx.createdAt)).toLocaleDateString("uz-UZ"),
      Bank: tx.bankName,
      Karta: tx.cardLast4 ? `****${tx.cardLast4}` : "",
      "Miqdor (so'm)": tx.amount,
      Ehtiyojlar: tx.needsAmount,
      "Xohish-istaklar": tx.wantsAmount,
      Tejash: tx.savingsAmount,
      Holat: Number(tx.savingsTransferred) === 1 ? "Tasdiqlangan" : "Kutilmoqda",
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [{ wch: 14 }, { wch: 16 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 12 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, ws, "Tranzaksiyalar");

    const totalIncome = txs.reduce((s, t) => s + Number(t.amount), 0);
    const totalSavings = txs.reduce((s, t) => s + Number(t.savingsAmount), 0);
    const transferred = txs.filter((t) => Number(t.savingsTransferred) === 1).reduce((s, t) => s + Number(t.savingsAmount), 0);

    const summaryRows = [
      { "": "UMUMIY HISOBOT" },
      { "Jami tranzaksiyalar": txs.length },
      { "Jami tushum (so'm)": totalIncome },
      { "Jami tejash (so'm)": totalSavings },
      { "O'tkazilgan tejash (so'm)": transferred },
      { "Kutilayotgan tejash (so'm)": totalSavings - transferred },
      { "": "" }, { "": "BYUDJET FOIZLARI" },
      { Ehtiyojlar: `${settings?.needsPercent ?? 50}%` },
      { "Xohish-istaklar": `${settings?.wantsPercent ?? 30}%` },
      { Tejash: `${settings?.savingsPercent ?? 20}%` },
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), "Hisobot");

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="smart-finance-${new Date().toISOString().slice(0, 10)}.xlsx"`,
      },
    });
  } catch (error) {
    console.error("Excel export error:", error);
    return NextResponse.json({ error: "Export xatosi" }, { status: 500 });
  }
}