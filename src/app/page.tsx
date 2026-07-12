"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wallet,
  TrendingUp,
  PiggyBank,
  ShoppingCart,
  Send,
  Trash2,
  CheckCircle2,
  XCircle,
  Settings2,
  BarChart3,
  MessageSquare,
  RefreshCw,
  Plus,
  ExternalLink,
  Clock,
  Building2,
  Bot,
  ChevronDown,
  Copy,
  Zap,
  ShieldCheck,
  ArrowRight,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Toaster, toast } from "sonner";

// Types
interface Transaction {
  id: string;
  amount: number;
  needsAmount: number;
  wantsAmount: number;
  savingsAmount: number;
  savingsTransferred: boolean;
  smsText: string;
  bankName: string;
  cardLast4: string;
  paymentLink: string;
  confirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Settings {
  id: string;
  needsPercent: number;
  wantsPercent: number;
  savingsPercent: number;
  savingsCardNumber: string;
  savingsCardBank: string;
  paymentService: string;
  telegramBotToken: string;
  telegramChatId: string;
  reportDayOfWeek: number;
  reportHour: number;
}

interface ReportData {
  month: {
    totalIncome: number;
    totalNeeds: number;
    totalWants: number;
    totalSavings: number;
    transferredSavings: number;
    pendingSavings: number;
    transactionCount: number;
  };
  week: {
    totalIncome: number;
    totalNeeds: number;
    totalWants: number;
    totalSavings: number;
    transactionCount: number;
  };
  dailyStats: { date: string; income: number; savings: number }[];
  bankStats: Record<string, { count: number; total: number }>;
}

// Helpers
function formatMoney(n: number): string {
  return n.toLocaleString("uz-UZ") + " so'm";
}

const NEEDS_COLOR = "#f59e0b";
const WANTS_COLOR = "#8b5cf6";
const SAVINGS_COLOR = "#10b981";

// ============================================================
// Main Page
// ============================================================
export default function SmartFinanceDashboard() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("dashboard");

  // Settings form state
  const [editSettings, setEditSettings] = useState({
    needsPercent: 50,
    wantsPercent: 30,
    savingsPercent: 20,
    savingsCardNumber: "",
    paymentService: "payme",
  });
  const [savingSettings, setSavingSettings] = useState(false);

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

  const fetchData = useCallback(async () => {
    try {
      const [txRes, setRes, repRes] = await Promise.all([
        fetch("/api/transactions"),
        fetch("/api/settings"),
        fetch("/api/report"),
      ]);
      const txData = await txRes.json();
      const setData = await setRes.json();
      const repData = await repRes.json();

      setTransactions(Array.isArray(txData) ? txData : []);
      setSettings(setData);
      setReport(repData);

      if (setData) {
        setEditSettings({
          needsPercent: setData.needsPercent,
          wantsPercent: setData.wantsPercent,
          savingsPercent: setData.savingsPercent,
          savingsCardNumber: setData.savingsCardNumber,
          paymentService: setData.paymentService,
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleParseSMS = async () => {
    if (!smsInput.trim()) return;
    setParsing(true);
    setParsedResult(null);
    try {
      const res = await fetch("/api/parse-sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sms: smsInput }),
      });
      const data = await res.json();
      setParsedResult(data);
      if (data.parsed) {
        toast.success("SMS muvaffaqiyatli tahlil qilindi!");
        fetchData();
      } else {
        toast.error(data.error || "Tahlil qilinmadi");
      }
    } catch {
      toast.error("Xatolik yuz berdi");
    } finally {
      setParsing(false);
    }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editSettings),
      });
      if (res.ok) {
        toast.success("Sozlamalar saqlandi!");
        fetchData();
      } else {
        const data = await res.json();
        toast.error(data.error || "Xatolik");
      }
    } catch {
      toast.error("Xatolik yuz berdi");
    } finally {
      setSavingSettings(false);
    }
  };

  const handleConfirmTransfer = async (txId: string) => {
    try {
      await fetch(`/api/transactions/${txId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ savingsTransferred: true }),
      });
      toast.success("O'tkazma tasdiqlandi!");
      setConfirmTx(null);
      fetchData();
    } catch {
      toast.error("Xatolik");
    }
  };

  const handleDeleteTx = async (txId: string) => {
    try {
      await fetch(`/api/transactions/${txId}`, { method: "DELETE" });
      toast.success("O'chirildi");
      fetchData();
    } catch {
      toast.error("Xatolik");
    }
  };

  const handleManualAdd = async () => {
    if (!manualAmount) return;
    setAddingManual(true);
    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseInt(manualAmount.replace(/\s/g, ""), 10),
          bankName: manualBank || "Qo'lda kiritilgan",
        }),
      });
      if (res.ok) {
        toast.success("Operatsiya qo'shildi!");
        setShowAddDialog(false);
        setManualAmount("");
        setManualBank("");
        fetchData();
      }
    } catch {
      toast.error("Xatolik");
    } finally {
      setAddingManual(false);
    }
  };

  const handleSeed = async () => {
    try {
      const res = await fetch("/api/seed", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        fetchData();
      } else {
        toast.error(data.details || data.error || "Xatolik yuz berdi");
      }
    } catch (err) {
      toast.error("Tarmoq xatosi — server bilan aloqa yo'q");
    }
  };

  const handleCopyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    toast.success("Havola nusxalandi!");
  };

  if (loading) {
    return <DashboardSkeleton />;
  }

  const pieData = report
    ? [
        { name: "Ehtiyojlar", value: report.month.totalNeeds, color: NEEDS_COLOR },
        { name: "Xohish-istaklar", value: report.month.totalWants, color: WANTS_COLOR },
        { name: "Tejash", value: report.month.totalSavings, color: SAVINGS_COLOR },
      ].filter((d) => d.value > 0)
    : [];

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-gray-50 to-gray-100">
      <Toaster position="top-right" richColors />

      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-gray-200/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/25">
              <Wallet className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900 leading-tight">Smart Finance</h1>
              <p className="text-xs text-gray-500 hidden sm:block">Moliyaviy avtomatlashtirish</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSeed}
              className="text-xs hidden sm:flex"
            >
              <Zap className="w-3.5 h-3.5 mr-1.5" />
              Namuna ma'lumotlar
            </Button>
            <Button
              size="sm"
              onClick={() => setShowAddDialog(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/25"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              <span className="hidden sm:inline">Qo'shish</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-6 bg-white border border-gray-200/60 p-1 rounded-xl shadow-sm">
            <TabsTrigger value="dashboard" className="text-xs sm:text-sm rounded-lg data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-md">
              <BarChart3 className="w-3.5 h-3.5 mr-1 hidden sm:block" />
              Boshqaruv paneli
            </TabsTrigger>
            <TabsTrigger value="sms" className="text-xs sm:text-sm rounded-lg data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-md">
              <MessageSquare className="w-3.5 h-3.5 mr-1 hidden sm:block" />
              SMS Tahlil
            </TabsTrigger>
            <TabsTrigger value="transactions" className="text-xs sm:text-sm rounded-lg data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-md">
              <Clock className="w-3.5 h-3.5 mr-1 hidden sm:block" />
              Tarix
            </TabsTrigger>
            <TabsTrigger value="settings" className="text-xs sm:text-sm rounded-lg data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-md">
              <Settings2 className="w-3.5 h-3.5 mr-1 hidden sm:block" />
              Sozlamalar
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                title="Oylik tushum"
                value={formatMoney(report?.month.totalIncome ?? 0)}
                icon={<TrendingUp className="w-5 h-5" />}
                color="emerald"
                subtitle={`${report?.month.transactionCount ?? 0} ta operatsiya`}
              />
              <StatCard
                title="Ehtiyojlar"
                value={formatMoney(report?.month.totalNeeds ?? 0)}
                icon={<ShoppingCart className="w-5 h-5" />}
                color="amber"
                subtitle={`${settings?.needsPercent ?? 50}%`}
              />
              <StatCard
                title="Xohish-istaklar"
                value={formatMoney(report?.month.totalWants ?? 0)}
                icon={<Wallet className="w-5 h-5" />}
                color="violet"
                subtitle={`${settings?.wantsPercent ?? 30}%`}
              />
              <StatCard
                title="Tejash"
                value={formatMoney(report?.month.totalSavings ?? 0)}
                icon={<PiggyBank className="w-5 h-5" />}
                color="green"
                subtitle={`O'tkazilgan: ${formatMoney(report?.month.transferredSavings ?? 0)}`}
              />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              {/* Pie Chart */}
              <Card className="lg:col-span-2 border-0 shadow-lg bg-white">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold">50/30/20 Qoidasi</CardTitle>
                  <CardDescription>Oylik byudjet taqsimoti</CardDescription>
                </CardHeader>
                <CardContent>
                  {pieData.length > 0 ? (
                    <div className="relative">
                      <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                          <Pie
                            data={pieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={90}
                            paddingAngle={3}
                            dataKey="value"
                            strokeWidth={0}
                          >
                            {pieData.map((entry, i) => (
                              <Cell key={i} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value: number) => formatMoney(value)}
                            contentStyle={{
                              borderRadius: "12px",
                              border: "1px solid #e5e7eb",
                              boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1)",
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
                        <span className="text-xs text-gray-500">Jami</span>
                        <span className="text-sm font-bold text-gray-900">
                          {formatMoney(report?.month.totalIncome ?? 0)}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="h-[220px] flex items-center justify-center text-gray-400 text-sm">
                      Hali ma&apos;lumot yo&apos;q
                    </div>
                  )}
                  <div className="flex justify-center gap-4 mt-2">
                    <LegendDot color={NEEDS_COLOR} label="Ehtiyojlar" />
                    <LegendDot color={WANTS_COLOR} label="Xohish-istaklar" />
                    <LegendDot color={SAVINGS_COLOR} label="Tejash" />
                  </div>
                </CardContent>
              </Card>

              {/* Bar Chart */}
              <Card className="lg:col-span-3 border-0 shadow-lg bg-white">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base font-semibold">Kunlik tushumlar</CardTitle>
                      <CardDescription>So&apos;nggi 14 kun</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={report?.dailyStats ?? []} barCategoryGap="20%">
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 11, fill: "#94a3b8" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: "#94a3b8" }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v: number) => {
                          if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
                          if (v >= 1000) return `${(v / 1000).toFixed(0)}K`;
                          return String(v);
                        }}
                      />
                      <Tooltip
                        formatter={(value: number) => formatMoney(value)}
                        contentStyle={{
                          borderRadius: "12px",
                          border: "1px solid #e5e7eb",
                          boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1)",
                        }}
                      />
                      <Bar dataKey="income" fill="#10b981" radius={[6, 6, 0, 0]} name="Tushum" />
                      <Bar dataKey="savings" fill="#f59e0b" radius={[6, 6, 0, 0]} name="Tejash" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Weekly Summary + Bank Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Weekly Summary */}
              <Card className="border-0 shadow-lg bg-white">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-emerald-600" />
                    Haftalik hisobot
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <WeeklyRow label="Jami tushum" value={report?.week.totalIncome ?? 0} color="emerald" />
                  <WeeklyRow label="Ehtiyojlar" value={report?.week.totalNeeds ?? 0} color="amber" />
                  <WeeklyRow label="Xohish-istaklar" value={report?.week.totalWants ?? 0} color="violet" />
                  <WeeklyRow label="Tejash" value={report?.week.totalSavings ?? 0} color="green" />
                  <Separator />
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <span>Operatsiyalar soni</span>
                    <span className="font-medium text-gray-900">
                      {report?.week.transactionCount ?? 0} ta
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Bank Breakdown */}
              <Card className="border-0 shadow-lg bg-white">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-emerald-600" />
                    Banklar bo&apos;yicha
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {report && Object.keys(report.bankStats).length > 0 ? (
                    <div className="space-y-3">
                      {Object.entries(report.bankStats)
                        .sort((a, b) => b[1].total - a[1].total)
                        .map(([bank, stats]) => (
                          <div key={bank} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                                <Building2 className="w-4 h-4 text-gray-600" />
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-900">{bank}</p>
                                <p className="text-xs text-gray-500">{stats.count} ta operatsiya</p>
                              </div>
                            </div>
                            <span className="text-sm font-semibold text-gray-900">
                              {formatMoney(stats.total)}
                            </span>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className="text-center text-gray-400 text-sm py-8">
                      Hali ma&apos;lumot yo&apos;q
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Telegram Bot Info */}
            <Card className="border-0 shadow-lg bg-gradient-to-r from-emerald-500 to-teal-600 text-white">
              <CardContent className="py-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
                      <Bot className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">Telegram Bot Integration</h3>
                      <p className="text-emerald-100 text-sm mt-0.5">
                        MacroDroid orqali SMS avtomatik tahlil qilinadi va hisobot yuboriladi
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="secondary" className="bg-white/20 text-white border-0">
                      <ShieldCheck className="w-3 h-3 mr-1" />
                      Faol
                    </Badge>
                    <Badge variant="secondary" className="bg-white/20 text-white border-0">
                      <Clock className="w-3 h-3 mr-1" />
                      Har Yakshanba 20:00
                    </Badge>
                  </div>
                </div>
                <div className="mt-4 p-3 bg-white/10 rounded-xl backdrop-blur-sm">
                  <p className="text-sm text-emerald-50">
                    <strong>Ishlash tartibi:</strong> Bank SMS → MacroDroid o&apos;qiydi → Bot API&apos;ga yuboradi → 50/30/20 hisoblaydi → Telegram&apos;ga xabar + Tasdiqlash tugmalari → To&apos;lov havolasi generatsiya qilinadi
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* SMS Parser Tab */}
          <TabsContent value="sms" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="border-0 shadow-lg bg-white">
                <CardHeader>
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-emerald-600" />
                    SMS Tahlil qilish
                  </CardTitle>
                  <CardDescription>
                    Bank SMS matnini joylashtiring, bot avtomatik pul miqdorini aniqlaydi va 50/30/20 bo&apos;linadi
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea
                    placeholder="Masalan: Uzum Bank. Karta: 1234. Balans: 550,000 so'm. Kartaingizga 50,000 so'm o'tkazildi."
                    value={smsInput}
                    onChange={(e) => setSmsInput(e.target.value)}
                    className="min-h-[120px] resize-none text-sm"
                  />
                  <div className="flex gap-2">
                    <Button
                      onClick={handleParseSMS}
                      disabled={parsing || !smsInput.trim()}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      {parsing ? (
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4 mr-2" />
                      )}
                      Tahlil qilish
                    </Button>
                  </div>

                  {/* Sample SMS buttons */}
                  <div>
                    <p className="text-xs text-gray-500 mb-2">Namuna SMS:</p>
                    <div className="flex flex-wrap gap-2">
                      {[
                        "Uzum Bank. Karta: 1234. Balans: 550,000 so'm. Kartaingizga 50,000 so'm o'tkazildi.",
                        "Kapitalbank: Kartangizga 1,250,000 so'm tushdi. Karta ****4567. Balans: 3,200,000 so'm.",
                        "TBC Bank: Hisobingizga 320,000 so'm o'tkazildi. Karta ****8901.",
                      ].map((sms, i) => (
                        <button
                          key={i}
                          onClick={() => setSmsInput(sms)}
                          className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-emerald-50 hover:text-emerald-700 transition-colors text-gray-600 max-w-full truncate"
                        >
                          Namuna {i + 1}
                        </button>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Parsed Result */}
              <Card className="border-0 shadow-lg bg-white">
                <CardHeader>
                  <CardTitle className="text-base font-semibold">Natija</CardTitle>
                </CardHeader>
                <CardContent>
                  {parsedResult ? (
                    parsedResult.parsed ? (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-4"
                      >
                        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                          <div className="flex items-center gap-2 mb-3">
                            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                            <span className="font-semibold text-emerald-800">
                              {formatMoney(parsedResult.transaction.amount)} tushdi
                            </span>
                          </div>
                          <p className="text-sm text-emerald-700">
                            Bank: {parsedResult.transaction.bankName}
                            {parsedResult.transaction.cardLast4 && (
                              <span className="ml-2">
                                Karta: ****{parsedResult.transaction.cardLast4}
                              </span>
                            )}
                          </p>
                        </div>

                        <div className="space-y-2">
                          <h4 className="text-sm font-medium text-gray-700">Hisob-kitob:</h4>
                          <BreakdownRow
                            label="Ehtiyojlar"
                            pct={parsedResult.breakdown.needs.percent}
                            amount={parsedResult.breakdown.needs.amount}
                            color={NEEDS_COLOR}
                          />
                          <BreakdownRow
                            label="Xohish-istaklar"
                            pct={parsedResult.breakdown.wants.percent}
                            amount={parsedResult.breakdown.wants.amount}
                            color={WANTS_COLOR}
                          />
                          <BreakdownRow
                            label="Tejash"
                            pct={parsedResult.breakdown.savings.percent}
                            amount={parsedResult.breakdown.savings.amount}
                            color={SAVINGS_COLOR}
                          />
                        </div>

                        {parsedResult.transaction.paymentLink && (
                          <div className="p-3 rounded-xl bg-gray-50 border border-gray-200">
                            <p className="text-xs text-gray-500 mb-2">To&apos;lov havolasi:</p>
                            <div className="flex items-center gap-2">
                              <code className="text-xs flex-1 text-emerald-700 bg-white p-2 rounded-lg border truncate">
                                {parsedResult.transaction.paymentLink}
                              </code>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  handleCopyLink(parsedResult.transaction.paymentLink)
                                }
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    ) : (
                      <div className="p-4 rounded-xl bg-red-50 border border-red-200">
                        <div className="flex items-center gap-2">
                          <XCircle className="w-5 h-5 text-red-500" />
                          <span className="text-red-700">{parsedResult.error}</span>
                        </div>
                      </div>
                    )
                  ) : (
                    <div className="text-center py-12 text-gray-400">
                      <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p className="text-sm">SMS matnini kiriting va &quot;Tahlil qilish&quot; tugmasini bosing</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Transactions Tab */}
          <TabsContent value="transactions" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Operatsiyalar tarixi</h2>
                <p className="text-sm text-gray-500">
                  Jami {transactions.length} ta operatsiya
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchData}
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                Yangilash
              </Button>
            </div>

            {transactions.length > 0 ? (
              <div className="space-y-3">
                <AnimatePresence>
                  {transactions.map((tx) => (
                    <motion.div
                      key={tx.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                    >
                      <TransactionCard
                        tx={tx}
                        onConfirm={() => setConfirmTx(tx)}
                        onCopyLink={() => handleCopyLink(tx.paymentLink)}
                        onDelete={() => handleDeleteTx(tx.id)}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            ) : (
              <Card className="border-0 shadow-lg bg-white">
                <CardContent className="py-16 text-center text-gray-400">
                  <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Hali operatsiya yo&apos;q</p>
                  <p className="text-xs mt-1">
                    SMS tahlil qiling yoki &quot;Qo&apos;shish&quot; tugmasini bosing
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Budget Settings */}
              <Card className="border-0 shadow-lg bg-white">
                <CardHeader>
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Settings2 className="w-4 h-4 text-emerald-600" />
                    Byudjet foizlari
                  </CardTitle>
                  <CardDescription>
                    50/30/20 qoidasini o&apos;zgartiring. Foizlar yig&apos;indisi 100 bo&apos;lishi kerak.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Needs */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: NEEDS_COLOR }} />
                        Ehtiyojlar
                      </Label>
                      <span className="text-sm font-bold" style={{ color: NEEDS_COLOR }}>
                        {editSettings.needsPercent}%
                      </span>
                    </div>
                    <Slider
                      value={[editSettings.needsPercent]}
                      onValueChange={([v]) =>
                        setEditSettings((p) => ({
                          ...p,
                          needsPercent: v,
                          savingsPercent: 100 - v - p.wantsPercent,
                        }))
                      }
                      max={100}
                      min={0}
                      step={1}
                      className="[&_[role=slider]]:bg-amber-500"
                    />
                  </div>

                  {/* Wants */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: WANTS_COLOR }} />
                        Xohish-istaklar
                      </Label>
                      <span className="text-sm font-bold" style={{ color: WANTS_COLOR }}>
                        {editSettings.wantsPercent}%
                      </span>
                    </div>
                    <Slider
                      value={[editSettings.wantsPercent]}
                      onValueChange={([v]) =>
                        setEditSettings((p) => ({
                          ...p,
                          wantsPercent: v,
                          savingsPercent: 100 - p.needsPercent - v,
                        }))
                      }
                      max={100}
                      min={0}
                      step={1}
                      className="[&_[role=slider]]:bg-violet-500"
                    />
                  </div>

                  {/* Savings */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: SAVINGS_COLOR }} />
                        Tejash
                      </Label>
                      <span className="text-sm font-bold" style={{ color: SAVINGS_COLOR }}>
                        {editSettings.savingsPercent}%
                      </span>
                    </div>
                    <Slider
                      value={[editSettings.savingsPercent]}
                      onValueChange={([v]) =>
                        setEditSettings((p) => ({
                          ...p,
                          savingsPercent: v,
                          wantsPercent: 100 - p.needsPercent - v,
                        }))
                      }
                      max={100}
                      min={0}
                      step={1}
                      className="[&_[role=slider]]:bg-emerald-500"
                    />
                  </div>

                  {/* Percentage bar */}
                  <div className="h-3 rounded-full overflow-hidden flex bg-gray-100">
                    <div
                      className="h-full transition-all duration-300"
                      style={{
                        width: `${editSettings.needsPercent}%`,
                        backgroundColor: NEEDS_COLOR,
                      }}
                    />
                    <div
                      className="h-full transition-all duration-300"
                      style={{
                        width: `${editSettings.wantsPercent}%`,
                        backgroundColor: WANTS_COLOR,
                      }}
                    />
                    <div
                      className="h-full transition-all duration-300"
                      style={{
                        width: `${editSettings.savingsPercent}%`,
                        backgroundColor: SAVINGS_COLOR,
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>
                      Jami: {editSettings.needsPercent + editSettings.wantsPercent + editSettings.savingsPercent}%
                    </span>
                    {editSettings.needsPercent + editSettings.wantsPercent + editSettings.savingsPercent !== 100 && (
                      <span className="text-red-500 font-medium">
                        Foizlar 100 bo&apos;lishi kerak!
                      </span>
                    )}
                  </div>

                  <Button
                    onClick={handleSaveSettings}
                    disabled={
                      savingSettings ||
                      editSettings.needsPercent +
                        editSettings.wantsPercent +
                        editSettings.savingsPercent !==
                        100
                    }
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    {savingSettings ? (
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : null}
                    Saqlash
                  </Button>
                </CardContent>
              </Card>

              {/* Payment Settings */}
              <Card className="border-0 shadow-lg bg-white">
                <CardHeader>
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Send className="w-4 h-4 text-emerald-600" />
                    To&apos;lov sozlamalari
                  </CardTitle>
                  <CardDescription>
                    Tejash kartasi ma&apos;lumotlarini kiriting, to&apos;lov havolasi avtomatik generatsiya bo&apos;lsin
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Tejash karta raqami</Label>
                    <Input
                      placeholder="8600 1234 5678 9012"
                      value={editSettings.savingsCardNumber}
                      onChange={(e) =>
                        setEditSettings((p) => ({
                          ...p,
                          savingsCardNumber: e.target.value,
                        }))
                      }
                      className="text-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>To&apos;lov xizmati</Label>
                    <Select
                      value={editSettings.paymentService}
                      onValueChange={(v) =>
                        setEditSettings((p) => ({ ...p, paymentService: v }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="payme">Payme</SelectItem>
                        <SelectItem value="click">Click</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    onClick={handleSaveSettings}
                    disabled={savingSettings}
                    variant="outline"
                    className="w-full"
                  >
                    {savingSettings ? (
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : null}
                    To&apos;lov sozlamalarini saqlash
                  </Button>

                  <Separator />

                  {/* Telegram Bot Info */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium flex items-center gap-2">
                      <Bot className="w-4 h-4 text-emerald-600" />
                      Telegram Bot sozlamalari
                    </h4>
                    <div className="p-3 rounded-xl bg-gray-50 border text-xs text-gray-600 space-y-2">
                      <p>
                        <strong>1.</strong> BotFather orqali Telegram bot yarating va token oling
                      </p>
                      <p>
                        <strong>2.</strong> Token va Chat ID ni &quot;Sozlamalar&quot; sahifasiga kiriting
                      </p>
                      <p>
                        <strong>3.</strong> MacroDroid ilovasida quyidagi makro yarating:
                      </p>
                      <div className="bg-white p-2 rounded-lg border font-mono text-[11px] space-y-1">
                        <p className="text-amber-600">Trigger: SMS kelganda (Bank raqamidan)</p>
                        <p className="text-emerald-600">Action: HTTP Request → POST /api/parse-sms</p>
                        <p className="text-violet-600">Body: {"{ \"sms\": \"[sms_text]\" }"}</p>
                      </div>
                      <p>
                        <strong>4.</strong> Bot har Yakshanba kuni soat 20:00 da haftalik hisobot yuboradi
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-gray-200/60 bg-white/80 backdrop-blur-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-500">
          <p>Smart Finance Bot &copy; {new Date().getFullYear()} — Shaxsiy moliyaviy avtomatlashtirish</p>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-500" />
              Ma&apos;lumotlar mahalliy saqlanadi
            </span>
          </div>
        </div>
      </footer>

      {/* Confirm Transfer Dialog */}
      <Dialog open={!!confirmTx} onOpenChange={() => setConfirmTx(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>O&apos;tkazmani tasdiqlash</DialogTitle>
            <DialogDescription>
              Tejash kartasiga{" "}
              <strong>{confirmTx ? formatMoney(confirmTx.savingsAmount) : ""}</strong> o&apos;tkazishni tasdiqlaysizmi?
            </DialogDescription>
          </DialogHeader>
          <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Tushum:</span>
              <span className="font-medium">{confirmTx ? formatMoney(confirmTx.amount) : ""}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Tejash miqdori:</span>
              <span className="font-medium text-emerald-600">
                {confirmTx ? formatMoney(confirmTx.savingsAmount) : ""}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Bank:</span>
              <span className="font-medium">{confirmTx?.bankName}</span>
            </div>
          </div>
          {confirmTx?.paymentLink && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
              <p className="text-xs text-emerald-700 mb-2">To&apos;lov havolasi:</p>
              <div className="flex items-center gap-2">
                <code className="text-xs flex-1 bg-white p-2 rounded-lg border truncate text-emerald-700">
                  {confirmTx.paymentLink}
                </code>
                <Button size="sm" variant="outline" onClick={() => handleCopyLink(confirmTx.paymentLink)}>
                  <Copy className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmTx(null)}>
              <XCircle className="w-4 h-4 mr-1.5" />
              Bekor qilish
            </Button>
            <Button
              onClick={() => confirmTx && handleConfirmTransfer(confirmTx.id)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <CheckCircle2 className="w-4 h-4 mr-1.5" />
              Tasdiqlash
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Manual Transaction Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Operatsiya qo&apos;shish</DialogTitle>
            <DialogDescription>Qo&apos;lda tushum operatsiyasini kiriting</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Miqdor (so&apos;m)</Label>
              <Input
                type="number"
                placeholder="500000"
                value={manualAmount}
                onChange={(e) => setManualAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Bank nomi (ixtiyoriy)</Label>
              <Input
                placeholder="Uzum Bank"
                value={manualBank}
                onChange={(e) => setManualBank(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Bekor qilish
            </Button>
            <Button
              onClick={handleManualAdd}
              disabled={addingManual || !manualAmount}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {addingManual ? (
                <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" />
              ) : (
                <Plus className="w-4 h-4 mr-1.5" />
              )}
              Qo&apos;shish
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

function StatCard({
  title,
  value,
  icon,
  color,
  subtitle,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  color: "emerald" | "amber" | "violet" | "green";
  subtitle: string;
}) {
  const colorMap = {
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
    amber: "bg-amber-50 text-amber-600 border-amber-100",
    violet: "bg-violet-50 text-violet-600 border-violet-100",
    green: "bg-green-50 text-green-600 border-green-100",
  };
  const iconBgMap = {
    emerald: "bg-emerald-100 text-emerald-600",
    amber: "bg-amber-100 text-amber-600",
    violet: "bg-violet-100 text-violet-600",
    green: "bg-green-100 text-green-600",
  };

  return (
    <Card className="border-0 shadow-lg bg-white overflow-hidden relative">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between mb-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconBgMap[color]}`}>
            {icon}
          </div>
          <Badge variant="secondary" className={`text-[10px] px-2 py-0.5 border ${colorMap[color]}`}>
            {subtitle}
          </Badge>
        </div>
        <p className="text-xs text-gray-500 mb-1">{title}</p>
        <p className="text-lg sm:text-xl font-bold text-gray-900 tracking-tight">{value}</p>
      </CardContent>
    </Card>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-xs text-gray-600">{label}</span>
    </div>
  );
}

function WeeklyRow({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-sm text-gray-600">{label}</span>
      </div>
      <span className="text-sm font-semibold text-gray-900">{formatMoney(value)}</span>
    </div>
  );
}

function BreakdownRow({
  label,
  pct,
  amount,
  color,
}: {
  label: string;
  pct: number;
  amount: number;
  color: string;
}) {
  return (
    <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-sm text-gray-700">{label}</span>
      </div>
      <div className="text-right">
        <div className="text-sm font-semibold text-gray-900">{formatMoney(amount)}</div>
        <div className="text-xs text-gray-400">{pct}%</div>
      </div>
    </div>
  );
}

function TransactionCard({
  tx,
  onConfirm,
  onCopyLink,
  onDelete,
}: {
  tx: Transaction;
  onConfirm: () => void;
  onCopyLink: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="border-0 shadow-md bg-white hover:shadow-lg transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-bold text-gray-900">{formatMoney(tx.amount)}</span>
              <Badge
                variant={tx.savingsTransferred ? "default" : "secondary"}
                className={
                  tx.savingsTransferred
                    ? "bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]"
                    : "bg-amber-100 text-amber-700 border-amber-200 text-[10px]"
                }
              >
                {tx.savingsTransferred ? "Tasdiqlangan" : "Kutilmoqda"}
              </Badge>
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <Building2 className="w-3 h-3" />
                {tx.bankName}
              </span>
              {tx.cardLast4 && <span>****{tx.cardLast4}</span>}
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {new Date(tx.createdAt).toLocaleDateString("uz-UZ", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {!tx.savingsTransferred && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                onClick={onConfirm}
              >
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                Tasdiqlash
              </Button>
            )}
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={onDelete}>
              <Trash2 className="w-3.5 h-3.5 text-gray-400" />
            </Button>
          </div>
        </div>

        {/* Expandable breakdown */}
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            className="mt-3 pt-3 border-t border-gray-100"
          >
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div className="text-center p-2 rounded-lg bg-amber-50">
                <p className="text-[10px] text-amber-600 mb-0.5">Ehtiyojlar</p>
                <p className="text-sm font-semibold text-amber-700">
                  {formatMoney(tx.needsAmount)}
                </p>
              </div>
              <div className="text-center p-2 rounded-lg bg-violet-50">
                <p className="text-[10px] text-violet-600 mb-0.5">Xohish-istaklar</p>
                <p className="text-sm font-semibold text-violet-700">
                  {formatMoney(tx.wantsAmount)}
                </p>
              </div>
              <div className="text-center p-2 rounded-lg bg-emerald-50">
                <p className="text-[10px] text-emerald-600 mb-0.5">Tejash</p>
                <p className="text-sm font-semibold text-emerald-700">
                  {formatMoney(tx.savingsAmount)}
                </p>
              </div>
            </div>

            {tx.paymentLink && (
              <div className="flex items-center gap-2">
                <code className="text-xs flex-1 text-emerald-700 bg-gray-50 p-2 rounded-lg border truncate">
                  {tx.paymentLink}
                </code>
                <Button size="sm" variant="outline" onClick={onCopyLink}>
                  <Copy className="w-3 h-3 mr-1" />
                  <span className="text-xs">Nusxa</span>
                </Button>
                <a href={tx.paymentLink} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white">
                    <ExternalLink className="w-3 h-3" />
                  </Button>
                </a>
              </div>
            )}

            <div className="mt-2 p-2 bg-gray-50 rounded-lg text-xs text-gray-500 max-h-20 overflow-y-auto">
              {tx.smsText}
            </div>
          </motion.div>
        )}

        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-2 flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          <ChevronDown
            className={`w-3 h-3 transition-transform ${expanded ? "rotate-180" : ""}`}
          />
          Batafsil
        </button>
      </CardContent>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-gray-50 to-gray-100">
      <header className="h-16 bg-white/80 backdrop-blur-lg border-b border-gray-200/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center">
          <Skeleton className="w-9 h-9 rounded-xl" />
          <div className="ml-3 space-y-1">
            <Skeleton className="w-32 h-5" />
            <Skeleton className="w-48 h-3 hidden sm:block" />
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="border-0 shadow-lg">
              <CardContent className="p-5">
                <Skeleton className="w-10 h-10 rounded-xl mb-3" />
                <Skeleton className="w-24 h-3 mb-2" />
                <Skeleton className="w-full h-6" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-0 shadow-lg">
            <CardContent className="p-6">
              <Skeleton className="w-40 h-5 mb-4" />
              <Skeleton className="w-full h-[260px] rounded-xl" />
            </CardContent>
          </Card>
          <Card className="border-0 shadow-lg">
            <CardContent className="p-6">
              <Skeleton className="w-40 h-5 mb-4" />
              <Skeleton className="w-full h-[260px] rounded-xl" />
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}