import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const txs = await db.transaction.findMany({ orderBy: { createdAt: "desc" } });
    const settings = await db.settings.findUnique({ where: { id: "default" } });
    const totalIncome = txs.reduce((s, t) => s + t.amount, 0);
    const totalNeeds = txs.reduce((s, t) => s + t.needsAmount, 0);
    const totalWants = txs.reduce((s, t) => s + t.wantsAmount, 0);
    const totalSavings = txs.reduce((s, t) => s + t.savingsAmount, 0);
    const transferred = txs.filter((t) => t.savingsTransferred).reduce((s, t) => s + t.savingsAmount, 0);
    const fmt = (n: number) => n.toLocaleString("uz-UZ");

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Smart Finance Bot - Hisobot</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:system-ui,-apple-system,sans-serif;padding:40px;color:#1a1a1a;max-width:800px;margin:0 auto}
  h1{font-size:24px;margin-bottom:4px;color:#059669}
  .subtitle{color:#6b7280;font-size:13px;margin-bottom:24px}
  .stats{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:24px}
  .stat{background:#f9fafb;border-radius:12px;padding:16px;border:1px solid #e5e7eb}
  .stat-label{font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px}
  .stat-value{font-size:20px;font-weight:700;margin-top:4px}
  .stat-value.green{color:#059669}
  .stat-value.amber{color:#d97706}
  .stat-value.violet{color:#7c3aed}
  table{width:100%;border-collapse:collapse;font-size:13px;margin-bottom:24px}
  th{background:#f3f4f6;padding:10px 12px;text-align:left;font-weight:600;border-bottom:2px solid #e5e7eb}
  td{padding:10px 12px;border-bottom:1px solid #f3f4f6}
  tr:hover td{background:#f9fafb}
  .badge{display:inline-block;padding:2px 8px;border-radius:9999px;font-size:10px;font-weight:600}
  .badge-ok{background:#d1fae5;color:#065f46}
  .badge-pending{background:#fef3c7;color:#92400e}
  .footer{margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;text-align:center}
  @media print{body{padding:20px}}
</style></head><body>
<h1>📊 Smart Finance Bot</h1>
<p class="subtitle">Oylik moliyaviy hisobot — ${new Date().toLocaleDateString("uz-UZ", { day: "numeric", month: "long", year: "numeric" })}</p>
<div class="stats">
  <div class="stat"><div class="stat-label">Jami tushum</div><div class="stat-value">${fmt(totalIncome)} so'm</div></div>
  <div class="stat"><div class="stat-label">Tranzaksiyalar soni</div><div class="stat-value">${txs.length}</div></div>
  <div class="stat"><div class="stat-label">Ehtiyojlar (${settings?.needsPercent ?? 50}%)</div><div class="stat-value amber">${fmt(totalNeeds)} so'm</div></div>
  <div class="stat"><div class="stat-label">Xohish-istaklar (${settings?.wantsPercent ?? 30}%)</div><div class="stat-value violet">${fmt(totalWants)} so'm</div></div>
  <div class="stat"><div class="stat-label">Tejash (${settings?.savingsPercent ?? 20}%)</div><div class="stat-value green">${fmt(totalSavings)} so'm</div></div>
  <div class="stat"><div class="stat-label">O'tkazilgan</div><div class="stat-value green">${fmt(transferred)} so'm</div></div>
</div>
<h2 style="font-size:16px;margin-bottom:12px">Tranzaksiyalar</h2>
<table><thead><tr><th>Sana</th><th>Bank</th><th>Karta</th><th>Miqdor</th><th>Tejash</th><th>Holat</th></tr></thead><tbody>
${txs.map((tx) => `<tr><td>${new Date(tx.createdAt).toLocaleDateString("uz-UZ")}</td><td>${tx.bankName}</td><td>${tx.cardLast4 ? "****" + tx.cardLast4 : "—"}</td><td><strong>${fmt(tx.amount)}</strong></td><td style="color:#059669">${fmt(tx.savingsAmount)}</td><td><span class="badge ${tx.savingsTransferred ? "badge-ok" : "badge-pending"}">${tx.savingsTransferred ? "Tasdiqlangan" : "Kutilmoqda"}</span></td></tr>`).join("")}
</tbody></table>
<div class="footer">Smart Finance Bot &copy; ${new Date().getFullYear()} — Shaxsiy moliyaviy avtomatlashtirish</div>
</body></html>`;

    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `inline; filename="smart-finance-${new Date().toISOString().slice(0, 10)}.html"`,
      },
    });
  } catch (error) {
    console.error("PDF export error:", error);
    return NextResponse.json({ error: "Export xatosi" }, { status: 500 });
  }
}