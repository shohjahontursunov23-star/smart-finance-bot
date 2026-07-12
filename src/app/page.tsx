"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "next-themes";
// Socket.io — will connect when bot service is running
// import io, { Socket } from "socket.io-client";
import {
  Wallet, TrendingUp, PiggyBank, ShoppingCart, Send, Trash2,
  CheckCircle2, XCircle, Settings2, BarChart3, MessageSquare,
  RefreshCw, Plus, ExternalLink, Clock, Building2, Bot,
  ChevronDown, Copy, Zap, ShieldCheck, ArrowRight, Moon, Sun,
  FileDown, FileSpreadsheet, Key, Radio, Link2, Wifi, WifiOff,
  Smartphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Toaster, toast } from "sonner";

// ============================================================
// Types
// ============================================================
interface Transaction {
  id: string; amount: number; needsAmount: number; wantsAmount: number;
  savingsAmount: number; savingsTransferred: boolean; smsText: string;
  bankName: string; cardLast4: string; paymentLink: string;
  confirmedAt: string | null; createdAt: string; updatedAt: string;
}

interface Settings {
  id: string; needsPercent: number; wantsPercent: number; savingsPercent: number;
  savingsCardNumber: string; savingsCardBank: string; paymentService: string;
  telegramBotToken: string; telegramChatId: string; reportDayOfWeek: number;
  reportHour: number; apiKey: string;
}

interface ReportData {
  month: { totalIncome: number; totalNeeds: number; totalWants: number;
    totalSavings: number; transferredSavings: number; pendingSavings: number; transactionCount: number; };
  week: { totalIncome: number; totalNeeds: number; totalWants: number;
    totalSavings: number; transactionCount: number; };
  dailyStats: { date: string; income: number; savings: number }[];
  bankStats: Record<string, { count: number; total: number }>;
}

// ============================================================
// Helpers
// ============================================================
function formatMoney(n: number): string { return n.toLocaleString("uz-UZ") + " so'm"; }
const NEEDS_COLOR = "#f59e0b";
const WANTS_COLOR = "#8b5cf6";
const SAVINGS_COLOR = "#10b981";

const DAYS_UZ = ["", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba", "Yakshanba"];

// ============================================================
// Main Page
// ============================================================
export default function SmartFinanceDashboard() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("dashboard");

  // Settings form state
  const [editSettings, setEditSettings] = useState({
    needsPercent: 50, wantsPercent: 30, savingsPercent: 20,
    savingsCardNumber: "", paymentService: "payme" as string,
  });
  const [savingSettings, setSavingSettings] = useState(false);

  // Bot & API Key state
  const [editBotToken, setEditBotToken] = useState("");
  const [editChatId, setEditChatId] = useState("");
  const [editReportDay, setEditReportDay] = useState(7);
  const [editReportHour, setEditReportHour] = useState(20);
  const [botStatus, setBotStatus] = useState<{ connected: boolean; botName?: string; username?: string; message?: string } | null>(null);
  const [testingBot, setTestingBot] = useState(false);
  const [savingBot, setSavingBot] = useState(false);
  const [generatingKey, setGeneratingKey] = useState(false);
  const [apiKey, setApiKey] = useState("");

  // SMS parser state
  const [smsInput, setSmsInput] = useState("");
  const [parsedResult, setParsedResult] = useState<any>(null);
  const [parsing, setParsing] = useState(false);

  // Manual add state
  const [manualAmount, setManualAmount] = useState("");
  const [manualBank, setManualBank] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addingManual, setAddingManual] = useState(false);

  // Confirm dialog
  const [confirmTx, setConfirmTx] = useState<Transaction | null>(null);

  // Socket.io
  const socketRef = useRef<any>(null);

  useEffect(() => { setMounted(true); }, []);

  // Socket.io — connect when bot service is running (port 3003)
  // useEffect(() => {
  //   try {
  //     const socket = io("/?XTransformPort=3003", { transports: ["websocket"], reconnectionAttempts: 5, reconnectionDelay: 3000 });
  //     socketRef.current = socket;
  //     socket.on("connect", () => console.log("WebSocket connected"));
  //     socket.on("bot-status", (status: any) => setBotStatus(status));
  //     socket.on("new-transaction", () => { toast.info("Yangi tranzaksiya qo'shildi!"); fetchData(); });
  //     socket.on("disconnect", () => console.log("WebSocket disconnected"));
  //     return () => { socket.disconnect(); };
  //   } catch { /* non-fatal */ }
  // }, []);

  const fetchData = useCallback(async () => {
    try {
      const [txRes, setRes, repRes, botRes] = await Promise.all([
        fetch("/api/transactions"), fetch("/api/settings"),
        fetch("/api/report"), fetch("/api/bot-status"),
      ]);
      const txData = await txRes.json();
      const setData = await setRes.json();
      const repData = await repRes.json();
      const botData = await botRes.json();

      setTransactions(Array.isArray(txData) ? txData : []);
      setSettings(setData);
      setReport(repData);
      setBotStatus(botData);
      if (setData) {
        setEditSettings({
          needsPercent: setData.needsPercent, wantsPercent: setData.wantsPercent,
          savingsPercent: setData.savingsPercent, savingsCardNumber: setData.savingsCardNumber,
          paymentService: setData.paymentService,
        });
        setEditBotToken(setData.telegramBotToken || "");
        setEditChatId(setData.telegramChatId || "");
        setEditReportDay(setData.reportDayOfWeek || 7);
        setEditReportHour(setData.reportHour || 20);
        setApiKey(setData.apiKey || "");
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleParseSMS = async () => {
    if (!smsInput.trim()) return;
    setParsing(true); setParsedResult(null);
    try {
      const res = await fetch("/api/parse-sms", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sms: smsInput }),
      });
      const data = await res.json();
      setParsedResult(data);
      if (data.parsed) { toast.success("SMS muvaffaqiyatli tahlil qilindi!"); fetchData(); }
      else toast.error(data.error || "Tahlil qilinmadi");
    } catch { toast.error("Xatolik yuz berdi"); }
    finally { setParsing(false); }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editSettings),
      });
      if (res.ok) { toast.success("Sozlamalar saqlandi!"); fetchData(); }
      else { const data = await res.json(); toast.error(data.error || "Xatolik"); }
    } catch { toast.error("Xatolik yuz berdi"); }
    finally { setSavingSettings(false); }
  };

  const handleSaveBotSettings = async () => {
    setSavingBot(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telegramBotToken: editBotToken, telegramChatId: editChatId,
          reportDayOfWeek: editReportDay, reportHour: editReportHour,
        }),
      });
      if (res.ok) { toast.success("Bot sozlamalari saqlandi!"); fetchData(); }
      else { const data = await res.json(); toast.error(data.error || "Xatolik"); }
    } catch { toast.error("Xatolik yuz berdi"); }
    finally { setSavingBot(false); }
  };

  const handleTestBot = async () => {
    setTestingBot(true);
    try {
      const res = await fetch("/api/bot-status");
      const data = await res.json();
      setBotStatus(data);
      if (data.connected) toast.success(`Bot ulandi: @${data.username}`);
      else toast.error(data.message || "Bot ulanmadi");
    } catch { toast.error("Tekshirib bo'lmadi"); }
    finally { setTestingBot(false); }
  };

  const handleSendTestMessage = async () => {
    setTestingBot(true);
    try {
      const res = await fetch("/api/bot-status", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "✅ <b>Smart Finance Bot</b> muvaffaqiyatli ulandi!\n\n📊 /report — Hisobot ko'rish\n📱 SMS yuboring yoki forward qiling — avtomatik tahlil" }),
      });
      const data = await res.json();
      if (data.success) toast.success("Test xabari yuborildi!");
      else toast.error("Xabar yuborilmadi — token yoki Chat ID ni tekshiring");
    } catch { toast.error("Xatolik"); }
    finally { setTestingBot(false); }
  };

  const handleGenerateApiKey = async () => {
    setGeneratingKey(true);
    try {
      const res = await fetch("/api/api-key", { method: "POST" });
      const data = await res.json();
      if (data.success) { setApiKey(data.apiKey); toast.success("API kalit generatsiya qilindi!"); fetchData(); }
      else toast.error("Xatolik");
    } catch { toast.error("Xatolik"); }
    finally { setGeneratingKey(false); }
  };

  const handleConfirmTransfer = async (txId: string) => {
    try {
      await fetch(`/api/transactions/${txId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ savingsTransferred: true }) });
      toast.success("O'tkazma tasdiqlandi!"); setConfirmTx(null); fetchData();
    } catch { toast.error("Xatolik"); }
  };

  const handleDeleteTx = async (txId: string) => {
    try {
      await fetch(`/api/transactions/${txId}`, { method: "DELETE" });
      toast.success("O'chirildi"); fetchData();
    } catch { toast.error("Xatolik"); }
  };

  const handleManualAdd = async () => {
    if (!manualAmount) return; setAddingManual(true);
    try {
      const res = await fetch("/api/transactions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: parseInt(manualAmount.replace(/\s/g, ""), 10), bankName: manualBank || "Qo'lda kiritilgan" }),
      });
      if (res.ok) { toast.success("Operatsiya qo'shildi!"); setShowAddDialog(false); setManualAmount(""); setManualBank(""); fetchData(); }
    } catch { toast.error("Xatolik"); }
    finally { setAddingManual(false); }
  };

  const handleSeed = async () => {
    try {
      const res = await fetch("/api/seed", { method: "POST" });
      const data = await res.json();
      if (data.success) { toast.success(data.message); fetchData(); }
      else toast.error(data.details || data.error || "Xatolik yuz berdi");
    } catch { toast.error("Tarmoq xatosi"); }
  };

  const handleCopyLink = (link: string) => { navigator.clipboard.writeText(link); toast.success("Nusxalandi!"); };
  const handleCopy = (text: string) => { navigator.clipboard.writeText(text); toast.success("Nusxalandi!"); };

  if (loading || !mounted) return <DashboardSkeleton />;

  const pieData = report
    ? [{ name: "Ehtiyojlar", value: report.month.totalNeeds, color: NEEDS_COLOR },
       { name: "Xohish-istaklar", value: report.month.totalWants, color: WANTS_COLOR },
       { name: "Tejash", value: report.month.totalSavings, color: SAVINGS_COLOR }].filter((d) => d.value > 0)
    : [];

  const macroDroidUrl = typeof window !== "undefined" ? `${window.location.origin}/api/parse-sms` : "/api/parse-sms";

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-950 dark:to-gray-900">
      <Toaster position="top-right" richColors theme={theme === "dark" ? "dark" : "light"} />

      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg border-b border-gray-200/60 dark:border-gray-700/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/25">
              <Wallet className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900 dark:text-white leading-tight">Smart Finance</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400 hidden sm:block">Moliyaviy avtomatlashtirish</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Button variant="ghost" size="icon" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} className="h-9 w-9">
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
            <Button variant="outline" size="sm" onClick={handleSeed} className="text-xs hidden sm:flex">
              <Zap className="w-3.5 h-3.5 mr-1.5" /> Namuna
            </Button>
            <Button size="sm" onClick={() => setShowAddDialog(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/25">
              <Plus className="w-4 h-4 mr-1.5" /><span className="hidden sm:inline">Qo&apos;shish</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-6 bg-white dark:bg-gray-800 border border-gray-200/60 dark:border-gray-700 p-1 rounded-xl shadow-sm">
            {[
              { v: "dashboard", icon: <BarChart3 className="w-3.5 h-3.5 mr-1 hidden sm:block" />, l: "Boshqaruv paneli" },
              { v: "sms", icon: <MessageSquare className="w-3.5 h-3.5 mr-1 hidden sm:block" />, l: "SMS Tahlil" },
              { v: "transactions", icon: <Clock className="w-3.5 h-3.5 mr-1 hidden sm:block" />, l: "Tarix" },
              { v: "settings", icon: <Settings2 className="w-3.5 h-3.5 mr-1 hidden sm:block" />, l: "Sozlamalar" },
            ].map((t) => (
              <TabsTrigger key={t.v} value={t.v}
                className="text-xs sm:text-sm rounded-lg data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-md">
                {t.icon}{t.l}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* ====== Dashboard Tab ====== */}
          <TabsContent value="dashboard" className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard title="Oylik tushum" value={formatMoney(report?.month.totalIncome ?? 0)} icon={<TrendingUp className="w-5 h-5" />} color="emerald" subtitle={`${report?.month.transactionCount ?? 0} ta operatsiya`} />
              <StatCard title="Ehtiyojlar" value={formatMoney(report?.month.totalNeeds ?? 0)} icon={<ShoppingCart className="w-5 h-5" />} color="amber" subtitle={`${settings?.needsPercent ?? 50}%`} />
              <StatCard title="Xohish-istaklar" value={formatMoney(report?.month.totalWants ?? 0)} icon={<Wallet className="w-5 h-5" />} color="violet" subtitle={`${settings?.wantsPercent ?? 30}%`} />
              <StatCard title="Tejash" value={formatMoney(report?.month.totalSavings ?? 0)} icon={<PiggyBank className="w-5 h-5" />} color="green" subtitle={`O'tkazilgan: ${formatMoney(report?.month.transferredSavings ?? 0)}`} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              <Card className="lg:col-span-2 border-0 shadow-lg bg-white dark:bg-gray-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold text-gray-900 dark:text-white">50/30/20 Qoidasi</CardTitle>
                  <CardDescription className="dark:text-gray-400">Oylik byudjet taqsimoti</CardDescription>
                </CardHeader>
                <CardContent>
                  {pieData.length > 0 ? (
                    <div className="relative">
                      <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                          <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value" strokeWidth={0} animationBegin={0} animationDuration={800}>
                            {pieData.map((entry, i) => (<Cell key={i} fill={entry.color} />))}
                          </Pie>
                          <Tooltip formatter={(value: number) => formatMoney(value)} contentStyle={{ borderRadius: "12px", border: "1px solid #e5e7eb", boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1)" }} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
                        <span className="text-xs text-gray-500 dark:text-gray-400">Jami</span>
                        <span className="text-sm font-bold text-gray-900 dark:text-white">{formatMoney(report?.month.totalIncome ?? 0)}</span>
                      </div>
                    </div>
                  ) : (<div className="h-[220px] flex items-center justify-center text-gray-400 text-sm">Hali ma&apos;lumot yo&apos;q</div>)}
                  <div className="flex justify-center gap-4 mt-2">
                    <LegendDot color={NEEDS_COLOR} label="Ehtiyojlar" />
                    <LegendDot color={WANTS_COLOR} label="Xohish-istaklar" />
                    <LegendDot color={SAVINGS_COLOR} label="Tejash" />
                  </div>
                </CardContent>
              </Card>

              <Card className="lg:col-span-3 border-0 shadow-lg bg-white dark:bg-gray-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold text-gray-900 dark:text-white">Kunlik tushumlar</CardTitle>
                  <CardDescription className="dark:text-gray-400">So&apos;nggi 14 kun</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={report?.dailyStats ?? []} barCategoryGap="20%">
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false}
                        tickFormatter={(v: number) => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)} />
                      <Tooltip formatter={(value: number) => formatMoney(value)} contentStyle={{ borderRadius: "12px", border: "1px solid #e5e7eb", boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1)" }} />
                      <Bar dataKey="income" fill="#10b981" radius={[6, 6, 0, 0]} name="Tushum" animationDuration={600} />
                      <Bar dataKey="savings" fill="#f59e0b" radius={[6, 6, 0, 0]} name="Tejash" animationDuration={600} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="border-0 shadow-lg bg-white dark:bg-gray-800">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold flex items-center gap-2 text-gray-900 dark:text-white">
                    <BarChart3 className="w-4 h-4 text-emerald-600" /> Haftalik hisobot
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <WeeklyRow label="Jami tushum" value={report?.week.totalIncome ?? 0} color="emerald" />
                  <WeeklyRow label="Ehtiyojlar" value={report?.week.totalNeeds ?? 0} color="amber" />
                  <WeeklyRow label="Xohish-istaklar" value={report?.week.totalWants ?? 0} color="violet" />
                  <WeeklyRow label="Tejash" value={report?.week.totalSavings ?? 0} color="green" />
                  <Separator className="dark:bg-gray-700" />
                  <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                    <span>Operatsiyalar soni</span>
                    <span className="font-medium text-gray-900 dark:text-white">{report?.week.transactionCount ?? 0} ta</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg bg-white dark:bg-gray-800">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold flex items-center gap-2 text-gray-900 dark:text-white">
                    <Building2 className="w-4 h-4 text-emerald-600" /> Banklar bo&apos;yicha
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {report && Object.keys(report.bankStats).length > 0 ? (
                    <div className="space-y-3">
                      {Object.entries(report.bankStats).sort((a, b) => b[1].total - a[1].total).map(([bank, stats]) => (
                        <div key={bank} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                              <Building2 className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900 dark:text-white">{bank}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{stats.count} ta operatsiya</p>
                            </div>
                          </div>
                          <span className="text-sm font-semibold text-gray-900 dark:text-white">{formatMoney(stats.total)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (<div className="text-center text-gray-400 text-sm py-8">Hali ma&apos;lumot yo&apos;q</div>)}
                </CardContent>
              </Card>
            </div>

            {/* Bot Status Card */}
            <Card className="border-0 shadow-lg bg-gradient-to-r from-emerald-500 to-teal-600 text-white">
              <CardContent className="py-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
                      <Bot className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">Telegram Bot</h3>
                      <p className="text-emerald-100 text-sm mt-0.5">
                        {botStatus?.connected ? `@${botStatus.username} — ulangan` : botStatus?.message || "Sozlamalarni kiriting"}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Badge variant="secondary" className={`${botStatus?.connected ? "bg-emerald-400/30" : "bg-red-400/30"} text-white border-0`}>
                      {botStatus?.connected ? <Wifi className="w-3 h-3 mr-1" /> : <WifiOff className="w-3 h-3 mr-1" />}
                      {botStatus?.connected ? "Faol" : "Faol emas"}
                    </Badge>
                    {apiKey && (
                      <Badge variant="secondary" className="bg-white/20 text-white border-0">
                        <ShieldCheck className="w-3 h-3 mr-1" /> API kalit
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="mt-4 p-3 bg-white/10 rounded-xl backdrop-blur-sm text-sm text-emerald-50">
                  <strong>Ishlash tartibi:</strong> Bank SMS → MacroDroid o&apos;qiydi → API&apos;ga yuboradi → 50/30/20 hisoblaydi → Dashboard yangilanadi → Telegram&apos;ga xabar
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ====== SMS Tab ====== */}
          <TabsContent value="sms" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="border-0 shadow-lg bg-white dark:bg-gray-800">
                <CardHeader>
                  <CardTitle className="text-base font-semibold flex items-center gap-2 text-gray-900 dark:text-white">
                    <MessageSquare className="w-4 h-4 text-emerald-600" /> SMS Tahlil qilish
                  </CardTitle>
                  <CardDescription className="dark:text-gray-400">Bank SMS matnini joylashtiring</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea placeholder="Masalan: Uzum Bank. Karta: 1234. Balans: 550,000 so'm. Kartaingizga 50,000 so'm o'tkazildi."
                    value={smsInput} onChange={(e) => setSmsInput(e.target.value)} className="min-h-[120px] resize-none text-sm bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                  <Button onClick={handleParseSMS} disabled={parsing || !smsInput.trim()} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
                    {parsing ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                    Tahlil qilish
                  </Button>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Namuna SMS:</p>
                    <div className="flex flex-wrap gap-2">
                      {["Uzum Bank. Karta: 1234. Balans: 550,000 so'm. Kartaingizga 50,000 so'm o'tkazildi.",
                        "Kapitalbank: Kartangizga 1,250,000 so'm tushdi. Karta ****4567. Balans: 3,200,000 so'm.",
                        "TBC Bank: Hisobingizga 320,000 so'm o'tkazildi. Karta ****8901.",
                        "Anorbank: Kartaingizga 750,000 so'm tushdi. Balans: 2,100,000 so'm.",
                      ].map((sms, i) => (
                        <button key={i} onClick={() => setSmsInput(sms)}
                          className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors text-gray-600 dark:text-gray-300 max-w-full truncate">
                          Namuna {i + 1}
                        </button>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg bg-white dark:bg-gray-800">
                <CardHeader>
                  <CardTitle className="text-base font-semibold text-gray-900 dark:text-white">Natija</CardTitle>
                </CardHeader>
                <CardContent>
                  {parsedResult ? (parsedResult.parsed ? (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                      <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-700">
                        <div className="flex items-center gap-2 mb-3">
                          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                          <span className="font-semibold text-emerald-800 dark:text-emerald-300">{formatMoney(parsedResult.transaction.amount)} tushdi</span>
                        </div>
                        <p className="text-sm text-emerald-700 dark:text-emerald-400">Bank: {parsedResult.transaction.bankName}
                          {parsedResult.transaction.cardLast4 && <span className="ml-2">Karta: ****{parsedResult.transaction.cardLast4}</span>}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Hisob-kitob:</h4>
                        <BreakdownRow label="Ehtiyojlar" pct={parsedResult.breakdown.needs.percent} amount={parsedResult.breakdown.needs.amount} color={NEEDS_COLOR} />
                        <BreakdownRow label="Xohish-istaklar" pct={parsedResult.breakdown.wants.percent} amount={parsedResult.breakdown.wants.amount} color={WANTS_COLOR} />
                        <BreakdownRow label="Tejash" pct={parsedResult.breakdown.savings.percent} amount={parsedResult.breakdown.savings.amount} color={SAVINGS_COLOR} />
                      </div>
                      {parsedResult.transaction.paymentLink && (
                        <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600">
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">To&apos;lov havolasi:</p>
                          <div className="flex items-center gap-2">
                            <code className="text-xs flex-1 text-emerald-700 dark:text-emerald-400 bg-white dark:bg-gray-600 p-2 rounded-lg border truncate">{parsedResult.transaction.paymentLink}</code>
                            <Button size="sm" variant="outline" onClick={() => handleCopy(parsedResult.transaction.paymentLink)}><Copy className="w-3.5 h-3.5" /></Button>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  ) : (
                    <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700">
                      <div className="flex items-center gap-2"><XCircle className="w-5 h-5 text-red-500" /><span className="text-red-700 dark:text-red-300">{parsedResult.error}</span></div>
                    </div>
                  )) : (
                    <div className="text-center py-12 text-gray-400">
                      <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p className="text-sm">SMS matnini kiriting</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ====== Transactions Tab ====== */}
          <TabsContent value="transactions" className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Operatsiyalar tarixi</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">Jami {transactions.length} ta operatsiya</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => window.open("/api/export/excel", "_blank")} className="text-xs">
                  <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5" /> Excel
                </Button>
                <Button variant="outline" size="sm" onClick={() => window.open("/api/export/pdf", "_blank")} className="text-xs">
                  <FileDown className="w-3.5 h-3.5 mr-1.5" /> Hisobot
                </Button>
                <Button variant="outline" size="sm" onClick={fetchData}><RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Yangilash</Button>
              </div>
            </div>
            {transactions.length > 0 ? (
              <div className="space-y-3">
                <AnimatePresence>{transactions.map((tx) => (
                  <motion.div key={tx.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                    <TransactionCard tx={tx} onConfirm={() => setConfirmTx(tx)} onCopyLink={() => handleCopyLink(tx.paymentLink)} onDelete={() => handleDeleteTx(tx.id)} />
                  </motion.div>
                ))}</AnimatePresence>
              </div>
            ) : (
              <Card className="border-0 shadow-lg bg-white dark:bg-gray-800">
                <CardContent className="py-16 text-center text-gray-400">
                  <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Hali operatsiya yo&apos;q</p>
                  <p className="text-xs mt-1">SMS tahlil qiling yoki &quot;Qo&apos;shish&quot; tugmasini bosing</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ====== Settings Tab ====== */}
          <TabsContent value="settings" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Budget Settings */}
              <Card className="border-0 shadow-lg bg-white dark:bg-gray-800">
                <CardHeader>
                  <CardTitle className="text-base font-semibold flex items-center gap-2 text-gray-900 dark:text-white">
                    <Settings2 className="w-4 h-4 text-emerald-600" /> Byudjet foizlari
                  </CardTitle>
                  <CardDescription className="dark:text-gray-400">50/30/20 qoidasini o&apos;zgartiring. Yig&apos;indisi 100 bo&apos;lishi kerak.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {[
                    { key: "needsPercent" as const, label: "Ehtiyojlar", color: NEEDS_COLOR },
                    { key: "wantsPercent" as const, label: "Xohish-istaklar", color: WANTS_COLOR },
                    { key: "savingsPercent" as const, label: "Tejash", color: SAVINGS_COLOR },
                  ].map((item) => (
                    <div key={item.key} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                          {item.label}
                        </Label>
                        <span className="text-sm font-bold" style={{ color: item.color }}>{editSettings[item.key]}%</span>
                      </div>
                      <Slider value={[editSettings[item.key]]} max={100} min={0} step={1}
                        onValueChange={([v]) => {
                          if (item.key === "needsPercent") setEditSettings((p) => ({ ...p, needsPercent: v, savingsPercent: 100 - v - p.wantsPercent }));
                          else if (item.key === "wantsPercent") setEditSettings((p) => ({ ...p, wantsPercent: v, savingsPercent: 100 - p.needsPercent - v }));
                          else setEditSettings((p) => ({ ...p, savingsPercent: v, wantsPercent: 100 - p.needsPercent - v }));
                        }} />
                    </div>
                  ))}
                  <div className="h-3 rounded-full overflow-hidden flex bg-gray-100 dark:bg-gray-700">
                    <div className="h-full transition-all duration-300" style={{ width: `${editSettings.needsPercent}%`, backgroundColor: NEEDS_COLOR }} />
                    <div className="h-full transition-all duration-300" style={{ width: `${editSettings.wantsPercent}%`, backgroundColor: WANTS_COLOR }} />
                    <div className="h-full transition-all duration-300" style={{ width: `${editSettings.savingsPercent}%`, backgroundColor: SAVINGS_COLOR }} />
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>Jami: {editSettings.needsPercent + editSettings.wantsPercent + editSettings.savingsPercent}%</span>
                    {editSettings.needsPercent + editSettings.wantsPercent + editSettings.savingsPercent !== 100 && (
                      <span className="text-red-500 font-medium">Foizlar 100 bo&apos;lishi kerak!</span>
                    )}
                  </div>
                  <Button onClick={handleSaveSettings}
                    disabled={savingSettings || editSettings.needsPercent + editSettings.wantsPercent + editSettings.savingsPercent !== 100}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
                    {savingSettings && <RefreshCw className="w-4 h-4 mr-2 animate-spin" />} Saqlash
                  </Button>
                </CardContent>
              </Card>

              {/* Payment Settings */}
              <Card className="border-0 shadow-lg bg-white dark:bg-gray-800">
                <CardHeader>
                  <CardTitle className="text-base font-semibold flex items-center gap-2 text-gray-900 dark:text-white">
                    <Send className="w-4 h-4 text-emerald-600" /> To&apos;lov sozlamalari
                  </CardTitle>
                  <CardDescription className="dark:text-gray-400">Tejash kartasi ma&apos;lumotlarini kiriting</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-gray-700 dark:text-gray-300">Tejash karta raqami</Label>
                    <Input placeholder="8600 1234 5678 9012" value={editSettings.savingsCardNumber}
                      onChange={(e) => setEditSettings((p) => ({ ...p, savingsCardNumber: e.target.value }))}
                      className="text-sm bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-gray-700 dark:text-gray-300">To&apos;lov xizmati</Label>
                    <Select value={editSettings.paymentService} onValueChange={(v) => setEditSettings((p) => ({ ...p, paymentService: v }))}>
                      <SelectTrigger className="bg-white dark:bg-gray-700 dark:border-gray-600"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="payme">Payme</SelectItem>
                        <SelectItem value="click">Click</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={handleSaveSettings} disabled={savingSettings} variant="outline" className="w-full">
                    {savingSettings && <RefreshCw className="w-4 h-4 mr-2 animate-spin" />} To&apos;lov sozlamalarini saqlash
                  </Button>
                </CardContent>
              </Card>

              {/* API Key */}
              <Card className="border-0 shadow-lg bg-white dark:bg-gray-800">
                <CardHeader>
                  <CardTitle className="text-base font-semibold flex items-center gap-2 text-gray-900 dark:text-white">
                    <Key className="w-4 h-4 text-emerald-600" /> API Kalit (MacroDroid)
                  </CardTitle>
                  <CardDescription className="dark:text-gray-400">MacroDroid orqali SMS yuborish uchun kerak</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {apiKey ? (
                    <div className="space-y-3">
                      <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600">
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">API Kalit:</p>
                        <code className="text-xs font-mono text-emerald-700 dark:text-emerald-400 break-all">{apiKey}</code>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleCopy(apiKey)} className="flex-1 text-xs"><Copy className="w-3 h-3 mr-1.5" /> Nusxalash</Button>
                        <Button variant="outline" size="sm" onClick={handleGenerateApiKey} disabled={generatingKey} className="flex-1 text-xs">
                          {generatingKey ? <RefreshCw className="w-3 h-3 mr-1.5 animate-spin" /> : <RefreshCw className="w-3 h-3 mr-1.5" />} Yangilash
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button onClick={handleGenerateApiKey} disabled={generatingKey} variant="outline" className="w-full">
                      {generatingKey ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Key className="w-4 h-4 mr-2" />}
                      API Kalit generatsiya qilish
                    </Button>
                  )}

                  <Separator className="dark:bg-gray-700" />

                  <div className="space-y-2">
                    <Label className="text-gray-700 dark:text-gray-300 flex items-center gap-1.5"><Smartphone className="w-3.5 h-3.5" /> MacroDroid sozlamasi</Label>
                    <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 text-xs text-amber-800 dark:text-amber-300 space-y-2">
                      <p><strong>1.</strong> MacroDroid → Yangi Makro</p>
                      <p><strong>2.</strong> Trigger: <code className="bg-amber-100 dark:bg-amber-800/50 px-1 rounded">SMS kelganda</code> (Bank raqamidan)</p>
                      <p><strong>3.</strong> Action: <code className="bg-amber-100 dark:bg-amber-800/50 px-1 rounded">HTTP Request</code></p>
                      <p className="font-mono bg-white dark:bg-gray-800 p-2 rounded-lg border border-amber-200 dark:border-amber-600 mt-1 break-all">
                        POST {macroDroidUrl}
                      </p>
                      <p className="font-mono bg-white dark:bg-gray-800 p-2 rounded-lg border border-amber-200 dark:border-amber-600 break-all">
                        {`{"sms": "[sms_text]", "apiKey": "${apiKey}"}`}
                      </p>
                      <p><strong>4.</strong> Content-Type: <code className="bg-amber-100 dark:bg-amber-800/50 px-1 rounded">application/json</code></p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Telegram Bot Settings */}
              <Card className="border-0 shadow-lg bg-white dark:bg-gray-800">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold flex items-center gap-2 text-gray-900 dark:text-white">
                      <Bot className="w-4 h-4 text-emerald-600" /> Telegram Bot
                    </CardTitle>
                    <Badge variant={botStatus?.connected ? "default" : "secondary"}
                      className={botStatus?.connected ? "bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]" : "bg-gray-100 text-gray-500 border-gray-200 text-[10px] dark:bg-gray-700 dark:text-gray-400 dark:border-gray-600"}>
                      {botStatus?.connected ? <Wifi className="w-3 h-3 mr-1" /> : <WifiOff className="w-3 h-3 mr-1" />}
                      {botStatus?.connected ? "Ulangan" : "Ulanmagan"}
                    </Badge>
                  </div>
                  <CardDescription className="dark:text-gray-400">Bot orqali SMS yuborish va haftalik hisobot olish</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-gray-700 dark:text-gray-300">Bot Token</Label>
                    <Input type="password" placeholder="123456:ABC-DEF..." value={editBotToken}
                      onChange={(e) => setEditBotToken(e.target.value)}
                      className="text-sm bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-gray-700 dark:text-gray-300">Chat ID</Label>
                    <Input placeholder="123456789" value={editChatId}
                      onChange={(e) => setEditChatId(e.target.value)}
                      className="text-sm bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                    <p className="text-[11px] text-gray-400">@userinfobot ga xabar yuboring, Chat ID ni oling</p>
                  </div>

                  <Separator className="dark:bg-gray-700" />

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-gray-700 dark:text-gray-300">Hisobot kuni</Label>
                      <Select value={String(editReportDay)} onValueChange={(v) => setEditReportDay(Number(v))}>
                        <SelectTrigger className="bg-white dark:bg-gray-700 dark:border-gray-600"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {DAYS_UZ.filter(Boolean).map((d, i) => (<SelectItem key={i + 1} value={String(i + 1)}>{d}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-gray-700 dark:text-gray-300">Soat</Label>
                      <Select value={String(editReportHour)} onValueChange={(v) => setEditReportHour(Number(v))}>
                        <SelectTrigger className="bg-white dark:bg-gray-700 dark:border-gray-600"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 24 }, (_, i) => (<SelectItem key={i} value={String(i)}>{String(i).padStart(2, "0")}:00</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={handleSaveBotSettings} disabled={savingBot} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs">
                      {savingBot && <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />} Saqlash
                    </Button>
                    <Button onClick={handleTestBot} disabled={testingBot} variant="outline" className="text-xs">
                      <Radio className="w-3.5 h-3.5 mr-1.5" /> Tekshirish
                    </Button>
                    <Button onClick={handleSendTestMessage} disabled={testingBot} variant="outline" className="text-xs">
                      <Send className="w-3.5 h-3.5 mr-1.5" /> Test
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Export & Deploy */}
              <Card className="lg:col-span-2 border-0 shadow-lg bg-white dark:bg-gray-800">
                <CardHeader>
                  <CardTitle className="text-base font-semibold flex items-center gap-2 text-gray-900 dark:text-white">
                    <FileDown className="w-4 h-4 text-emerald-600" /> Export va Deploy
                  </CardTitle>
                  <CardDescription className="dark:text-gray-400">Ma&apos;lumotlarni export qilish va serverga joylashtirish</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Button variant="outline" onClick={() => window.open("/api/export/excel", "_blank")} className="h-auto py-4 flex-col gap-2">
                      <FileSpreadsheet className="w-6 h-6 text-emerald-600" />
                      <div className="text-left">
                        <p className="font-medium text-sm text-gray-900 dark:text-white">Excel Export</p>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400">Tranzaksiyalar + Hisobot</p>
                      </div>
                    </Button>
                    <Button variant="outline" onClick={() => window.open("/api/export/pdf", "_blank")} className="h-auto py-4 flex-col gap-2">
                      <FileDown className="w-6 h-6 text-violet-600" />
                      <div className="text-left">
                        <p className="font-medium text-sm text-gray-900 dark:text-white">PDF Hisobot</p>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400">Chop etish uchun tayyor</p>
                      </div>
                    </Button>
                    <Button variant="outline" onClick={() => handleCopy(macroDroidUrl)} className="h-auto py-4 flex-col gap-2">
                      <Link2 className="w-6 h-6 text-amber-600" />
                      <div className="text-left">
                        <p className="font-medium text-sm text-gray-900 dark:text-white">API URL</p>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 break-all">{macroDroidUrl}</p>
                      </div>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-gray-200/60 dark:border-gray-700/60 bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
          <p>Smart Finance Bot &copy; {new Date().getFullYear()} — Shaxsiy moliyaviy avtomatlashtirish</p>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1"><ShieldCheck className="w-3 h-3 text-emerald-500" /> Ma&apos;lumotlar mahalliy saqlanadi</span>
          </div>
        </div>
      </footer>

      {/* Confirm Transfer Dialog */}
      <Dialog open={!!confirmTx} onOpenChange={() => setConfirmTx(null)}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-gray-800">
          <DialogHeader>
            <DialogTitle className="dark:text-white">O&apos;tkazmani tasdiqlash</DialogTitle>
            <DialogDescription className="dark:text-gray-400">
              Tejash kartasiga <strong>{confirmTx ? formatMoney(confirmTx.savingsAmount) : ""}</strong> o&apos;tkazishni tasdiqlaysizmi?
            </DialogDescription>
          </DialogHeader>
          <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Tushum:</span><span className="font-medium text-gray-900 dark:text-white">{confirmTx ? formatMoney(confirmTx.amount) : ""}</span></div>
            <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Tejash miqdori:</span><span className="font-medium text-emerald-600">{confirmTx ? formatMoney(confirmTx.savingsAmount) : ""}</span></div>
            <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Bank:</span><span className="font-medium text-gray-900 dark:text-white">{confirmTx?.bankName}</span></div>
          </div>
          {confirmTx?.paymentLink && (
            <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 rounded-xl p-3">
              <p className="text-xs text-emerald-700 dark:text-emerald-400 mb-2">To&apos;lov havolasi:</p>
              <div className="flex items-center gap-2">
                <code className="text-xs flex-1 bg-white dark:bg-gray-700 p-2 rounded-lg border truncate text-emerald-700 dark:text-emerald-400">{confirmTx.paymentLink}</code>
                <Button size="sm" variant="outline" onClick={() => handleCopy(confirmTx.paymentLink)}><Copy className="w-3.5 h-3.5" /></Button>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmTx(null)}><XCircle className="w-4 h-4 mr-1.5" /> Bekor qilish</Button>
            <Button onClick={() => confirmTx && handleConfirmTransfer(confirmTx.id)} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <CheckCircle2 className="w-4 h-4 mr-1.5" /> Tasdiqlash
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Manual Transaction Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-gray-800">
          <DialogHeader>
            <DialogTitle className="dark:text-white">Operatsiya qo&apos;shish</DialogTitle>
            <DialogDescription className="dark:text-gray-400">Qo&apos;lda tushum operatsiyasini kiriting</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-gray-700 dark:text-gray-300">Miqdor (so&apos;m)</Label>
              <Input type="number" placeholder="500000" value={manualAmount} onChange={(e) => setManualAmount(e.target.value)} className="bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
            </div>
            <div className="space-y-2">
              <Label className="text-gray-700 dark:text-gray-300">Bank nomi (ixtiyoriy)</Label>
              <Input placeholder="Uzum Bank" value={manualBank} onChange={(e) => setManualBank(e.target.value)} className="bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Bekor qilish</Button>
            <Button onClick={handleManualAdd} disabled={addingManual || !manualAmount} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {addingManual ? <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" /> : <Plus className="w-4 h-4 mr-1.5" />} Qo&apos;shish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================
// Sub Components
// ============================================================
function StatCard({ title, value, icon, color, subtitle }: {
  title: string; value: string; icon: React.ReactNode;
  color: "emerald" | "amber" | "violet" | "green"; subtitle: string;
}) {
  const cm: Record<string, string> = {
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/30 dark:border-emerald-800",
    amber: "bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-900/30 dark:border-amber-800",
    violet: "bg-violet-50 text-violet-600 border-violet-100 dark:bg-violet-900/30 dark:border-violet-800",
    green: "bg-green-50 text-green-600 border-green-100 dark:bg-green-900/30 dark:border-green-800",
  };
  const ib: Record<string, string> = {
    emerald: "bg-emerald-100 text-emerald-600 dark:bg-emerald-800 dark:text-emerald-400",
    amber: "bg-amber-100 text-amber-600 dark:bg-amber-800 dark:text-amber-400",
    violet: "bg-violet-100 text-violet-600 dark:bg-violet-800 dark:text-violet-400",
    green: "bg-green-100 text-green-600 dark:bg-green-800 dark:text-green-400",
  };
  return (
    <Card className="border-0 shadow-lg bg-white dark:bg-gray-800 overflow-hidden relative">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between mb-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${ib[color]}`}>{icon}</div>
          <Badge variant="secondary" className={`text-[10px] px-2 py-0.5 border ${cm[color]}`}>{subtitle}</Badge>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{title}</p>
        <p className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white tracking-tight">{value}</p>
      </CardContent>
    </Card>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (<div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} /><span className="text-xs text-gray-600 dark:text-gray-400">{label}</span></div>);
}

function WeeklyRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} /><span className="text-sm text-gray-600 dark:text-gray-400">{label}</span></div>
      <span className="text-sm font-semibold text-gray-900 dark:text-white">{formatMoney(value)}</span>
    </div>
  );
}

function BreakdownRow({ label, pct, amount, color }: { label: string; pct: number; amount: number; color: string }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-700 border border-gray-100 dark:border-gray-600">
      <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} /><span className="text-sm text-gray-700 dark:text-gray-300">{label}</span></div>
      <div className="text-right"><div className="text-sm font-semibold text-gray-900 dark:text-white">{formatMoney(amount)}</div><div className="text-xs text-gray-400">{pct}%</div></div>
    </div>
  );
}

function TransactionCard({ tx, onConfirm, onCopyLink, onDelete }: {
  tx: Transaction; onConfirm: () => void; onCopyLink: () => void; onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <Card className="border-0 shadow-md bg-white dark:bg-gray-800 hover:shadow-lg transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-bold text-gray-900 dark:text-white">{formatMoney(tx.amount)}</span>
              <Badge variant={tx.savingsTransferred ? "default" : "secondary"}
                className={tx.savingsTransferred ? "bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px] dark:bg-emerald-900/30 dark:border-emerald-700" : "bg-amber-100 text-amber-700 border-amber-200 text-[10px] dark:bg-amber-900/30 dark:border-amber-700"}>
                {tx.savingsTransferred ? "Tasdiqlangan" : "Kutilmoqda"}
              </Badge>
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
              <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{tx.bankName}</span>
              {tx.cardLast4 && <span>****{tx.cardLast4}</span>}
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(tx.createdAt).toLocaleDateString("uz-UZ", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {!tx.savingsTransferred && (
              <Button size="sm" variant="outline" className="h-8 text-xs bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:border-emerald-700" onClick={onConfirm}>
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Tasdiqlash
              </Button>
            )}
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={onDelete}><Trash2 className="w-3.5 h-3.5 text-gray-400" /></Button>
          </div>
        </div>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div className="text-center p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20"><p className="text-[10px] text-amber-600 mb-0.5">Ehtiyojlar</p><p className="text-sm font-semibold text-amber-700 dark:text-amber-400">{formatMoney(tx.needsAmount)}</p></div>
              <div className="text-center p-2 rounded-lg bg-violet-50 dark:bg-violet-900/20"><p className="text-[10px] text-violet-600 mb-0.5">Xohish-istaklar</p><p className="text-sm font-semibold text-violet-700 dark:text-violet-400">{formatMoney(tx.wantsAmount)}</p></div>
              <div className="text-center p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20"><p className="text-[10px] text-emerald-600 mb-0.5">Tejash</p><p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">{formatMoney(tx.savingsAmount)}</p></div>
            </div>
            {tx.paymentLink && (
              <div className="flex items-center gap-2">
                <code className="text-xs flex-1 text-emerald-700 dark:text-emerald-400 bg-gray-50 dark:bg-gray-700 p-2 rounded-lg border truncate">{tx.paymentLink}</code>
                <Button size="sm" variant="outline" onClick={onCopyLink}><Copy className="w-3 h-3 mr-1" /><span className="text-xs">Nusxa</span></Button>
                <a href={tx.paymentLink} target="_blank" rel="noopener noreferrer"><Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white"><ExternalLink className="w-3 h-3" /></Button></a>
              </div>
            )}
            <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-700 rounded-lg text-xs text-gray-500 dark:text-gray-400 max-h-20 overflow-y-auto">{tx.smsText}</div>
          </motion.div>
        )}
        <button onClick={() => setExpanded(!expanded)} className="mt-2 flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
          <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? "rotate-180" : ""}`} /> Batafsil
        </button>
      </CardContent>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-950 dark:to-gray-900">
      <header className="h-16 bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg border-b border-gray-200/60 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center"><Skeleton className="w-9 h-9 rounded-xl" /><div className="ml-3 space-y-1"><Skeleton className="w-32 h-5" /><Skeleton className="w-48 h-3 hidden sm:block" /></div></div>
      </header>
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{[1,2,3,4].map((i) => (<Card key={i} className="border-0 shadow-lg"><CardContent className="p-5"><Skeleton className="w-10 h-10 rounded-xl mb-3" /><Skeleton className="w-24 h-3 mb-2" /><Skeleton className="w-full h-6" /></CardContent></Card>))}</div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">{[1,2].map((i) => (<Card key={i} className="border-0 shadow-lg"><CardContent className="p-6"><Skeleton className="w-40 h-5 mb-4" /><Skeleton className="w-full h-[260px] rounded-xl" /></CardContent></Card>))}</div>
      </main>
    </div>
  );
}