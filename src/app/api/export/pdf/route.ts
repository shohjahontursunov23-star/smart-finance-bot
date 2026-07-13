import { NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET() {
  try {
    const txs = db.prepare("SELECT * FROM txns ORDER BY createdAt DESC").all() as Record<string, unknown>[];
    const settings = db.prepare("SELECT * FROM Settings WHERE id = 'default'").get() as Record<string, unknown> | undefined;

    const sum = (key: string) => txs.reduce((s, t) => s + Number(t[key] || 0), 0);
    const sumIf = (key: string, fKey: string) => txs.filter(t => Number(t[fKey]) === 1).reduce((s, t) => s + Number(t[key] || 0), 0);
    const fmt = (n: number) => n.toLocaleString("uz-UZ");

    const totalIncome = sum("amount");
    const totalSavings = sum("savingsAmount");
    const transferred = sumIf("savingsAmount", "savingsTransferred");
    const pending = totalSavings - transferred;

    const date = new Date().toLocaleDateString("uz-UZ", { day: "numeric", month: "long", year: "numeric" });
    const np = Number(settings?.needsPercent ?? 50);
    const wp = Number(settings?.wantsPercent ?? 30);
    const sp = Number(settings?.savingsPercent ?? 20);

    const html = `<!DOCTYPE html><html lang="uz"><head><meta charset="utf-8"><title>Smart Finance Bot</title>
<style>
  @page{size:A4;margin:15mm}*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,sans-serif;color:#1a1a1a;max-width:210mm;margin:0 auto;font-size:13px;line-height:1.5}
  @media print{.no-print{display:none!important}}
  .header{text-align:center;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #10b981}
  .header h1{font-size:22px;color:#059669}.header .subtitle{color:#6b7280;font-size:12px}
  .print-btn{position:fixed;top:20px;right:20px;background:#059669;color:white;border:none;padding:10px 20px;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600}
  .stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:24px}
  .stat{background:#f9fafb;border-radius:10px;padding:14px;border:1px solid #e5e7eb;text-align:center}
  .stat-label{font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px}
  .stat-value{font-size:18px;font-weight:700}.stat-value.green{color:#059669}.stat-value.emerald{color:#10b981}
  .section{margin-bottom:20px}.section-title{font-size:14px;font-weight:700;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid #e5e7eb;color:#374151}
  .budget-bar{height:24px;border-radius:12px;overflow:hidden;display:flex;margin-bottom:20px}
  .budget-bar>div{display:flex;align-items:center;justify-content:center;color:white;font-size:10px;font-weight:600}
  table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:20px}
  th{background:#f3f4f6;padding:8px 10px;text-align:left;font-weight:600;border-bottom:2px solid #e5e7eb;font-size:11px}
  td{padding:8px 10px;border-bottom:1px solid #f3f4f6}
  .badge{display:inline-block;padding:2px 8px;border-radius:9999px;font-size:10px;font-weight:600}
  .badge-ok{background:#d1fae5;color:#065f46}.badge-pending{background:#fef3c7;color:#92400e}
  .amount{font-weight:600;text-align:right}.savings-col{color:#059669;font-weight:600;text-align:right}
  .summary-row{display:flex;justify-content:space-between;padding:6px 0;font-size:13px}
  .footer{margin-top:30px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:10px;color:#9ca3af;text-align:center}
  @media(max-width:600px){.stats{grid-template-columns:1fr}table{font-size:10px}th,td{padding:6px}}
</style></head><body>
<button class="print-btn no-print" onclick="window.print()">🖨️ Chop etish</button>
<div class="header"><h1>📊 Smart Finance Bot</h1><p class="subtitle">Moliyaviy hisobot — ${date}</p></div>
<div class="stats">
  <div class="stat"><div class="stat-label">Jami tushum</div><div class="stat-value emerald">${fmt(totalIncome)} so'm</div></div>
  <div class="stat"><div class="stat-label">Tranzaksiyalar</div><div class="stat-value">${txs.length} ta</div></div>
  <div class="stat"><div class="stat-label">O'tkazilgan tejash</div><div class="stat-value green">${fmt(transferred)} so'm</div></div>
</div>
<div class="section">
  <div class="section-title">Byudjet taqsimoti (${np}/${wp}/${sp})</div>
  <div class="budget-bar">
    <div style="width:${np}%;background:#f59e0b">${np}%</div>
    <div style="width:${wp}%;background:#8b5cf6">${wp}%</div>
    <div style="width:${sp}%;background:#10b981">${sp}%</div>
  </div>
</div>
<div class="section"><div class="section-title">Tranzaksiyalar</div><table>
<thead><tr><th>#</th><th>Sana</th><th>Bank</th><th>Karta</th><th class="amount">Miqdor</th><th class="savings-col">Tejash</th><th>Holat</th></tr></thead><tbody>
${txs.map((tx, i) => `<tr><td>${i + 1}</td><td>${new Date(String(tx.createdAt)).toLocaleDateString("uz-UZ", { day: "2-digit", month: "short", year: "numeric" })}</td><td>${tx.bankName}</td><td>${tx.cardLast4 ? "****" + tx.cardLast4 : "—"}</td><td class="amount"><strong>${fmt(Number(tx.amount))}</strong></td><td class="savings-col">${fmt(Number(tx.savingsAmount))}</td><td><span class="badge ${Number(tx.savingsTransferred) === 1 ? "badge-ok" : "badge-pending"}">${Number(tx.savingsTransferred) === 1 ? "Tasdiqlangan" : "Kutilmoqda"}</span></td></tr>`).join("")}
</tbody></table></div>
<div class="section"><div class="section-title">Umumiy hisob</div>
<div class="summary-row"><span>Jami tushum:</span><span><strong>${fmt(totalIncome)} so'm</strong></span></div>
<div class="summary-row"><span>Ehtiyojlar (${np}%):</span><span>${fmt(sum("needsAmount"))} so'm</span></div>
<div class="summary-row"><span>Xohish-istaklar (${wp}%):</span><span>${fmt(sum("wantsAmount"))} so'm</span></div>
<div class="summary-row"><span>Tejash (${sp}%):</span><span>${fmt(totalSavings)} so'm</span></div>
<div class="summary-row"><span style="color:#059669">O'tkazilgan:</span><span style="color:#059669;font-weight:600">${fmt(transferred)} so'm</span></div>
<div class="summary-row"><span style="color:#d97706">Kutilayotgan:</span><span style="color:#d97706;font-weight:600">${fmt(pending)} so'm</span></div>
</div>
<div class="footer">Smart Finance Bot &copy; ${new Date().getFullYear()}</div>
<script>window.addEventListener('load',()=>setTimeout(()=>window.print(),500))</script>
</body></html>`;

    return new NextResponse(html, {
      headers: { "Content-Type": "text/html; charset=utf-8", "Content-Disposition": `inline; filename="smart-finance-${new Date().toISOString().slice(0, 10)}.html"` },
    });
  } catch (error) {
    console.error("PDF export error:", error);
    return NextResponse.json({ error: "Export xatosi" }, { status: 500 });
  }
}