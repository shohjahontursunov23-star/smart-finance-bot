---
Task ID: 1
Agent: Main
Task: Barcha yangi funksiyalarni loyihaga qo'shish

Work Log:
- Loyihani to'liq o'qib, hozirgi holatni tahlil qildi (page.tsx ~1044 qator, 17 bank, shadcn/ui, recharts, framer-motion)
- `.env.example` fayli yaratildi (DATABASE_URL, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID)
- `Dockerfile` yaratildi (multi-stage: deps → builder → runner, node:20-alpine, standalone output)
- `nixpacks.toml` yaratildi (Railway uchun build sozlamalari)
- `/api/parse-sms/route.ts` ga CORS headers qo'shildi (OPTIONS + POST, Access-Control-Allow-Origin: *)
- `/api/weekly-report/route.ts` yangi API yaratildi:
  - GET: haftalik hisobot preview (canSend, nextReport, preview data)
  - POST: Telegram'ga formatlangan hisobot yuborish
- `page.tsx` yangilandi:
  - framer-motion animatsiya variantlari qo'shildi (fadeInUp, scaleIn, slideInLeft, slideInRight)
  - Stat kartalari stagger animatsiya bilan
  - Chart kartalari slide-in animatsiya bilan
  - Haftalik hisobot kartasi Sozlamalar tab da qo'shildi
  - Export section 4 ta tugmaga kengaytirildi (Excel, PDF, API URL, Haftalik xabar)
  - PDF chop etish funksiyasi qo'shildi
  - CalendarDays, Printer, Megaphone iconlar import qilindi
- `/api/export/pdf/route.ts` yaxshilandi:
  - Chop etish tugmasi (window.print() auto-trigger)
  - Byudjet bar vizualizatsiya (foizlar rangli chiziq)
  - Umumiy hisob jadvali
  - Responsive dizayn

Stage Summary:
- Barcha testlar muvaffaqiyatli: LINT ✓, PAGE 200 ✓, WEEKLY-REPORT API 200 ✓, CORS OPTIONS 204 ✓, SMS PARSE 200 ✓, EXCEL 200 (20KB) ✓, PDF 200 (7KB) ✓, BROWSER test ✓
- Yangi fayllar: .env.example, Dockerfile, nixpacks.toml, src/app/api/weekly-report/route.ts
- O'zgartirilgan fayllar: src/app/api/parse-sms/route.ts, src/app/api/export/pdf/route.ts, src/app/page.tsx