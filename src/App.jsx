import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Home, TrendingUp, Wallet, BarChart3, Settings as SettingsIcon,
  Plus, Check, AlertTriangle, Download, Upload, Car, Flag, Target,
  PiggyBank, Receipt, Trash2, X, ChevronRight, Zap, Shield, Gauge,
  Search, ArrowUpDown, Lightbulb, Pencil, Save, CalendarCheck, Flame, Landmark,
  Timer, Bell, Share2, Fuel, CalendarDays, Trophy, Repeat, ClipboardList, FileSpreadsheet, Image, FileText
} from "lucide-react";
import { jsPDF } from "jspdf";
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine
} from "recharts";
import { cloudEnabled, loadAppState, saveAppState, subscribeAppState, getSession, onAuthChange, signIn, signOut, emptyAppState } from "./cloudStore.js";
import { appliedPayment, milestoneCrossings } from "./milestones.js";

/* ------------------------------------------------------------------ */
/*  Palette — "cockpit at night". Custom hexes via inline styles       */
/*  (artifact Tailwind has no JIT, so arbitrary values won't compile). */
/* ------------------------------------------------------------------ */
const C = {
  asphalt: "#070B10",
  surface: "#121820",
  surface2: "#1A222C",
  line: "#2A3542",
  lineSoft: "#1E2732",
  text: "#F2F5F8",
  muted: "#8A97A6",
  faint: "#5B6875",
  green: "#3DDC97",
  greenDim: "#164A38",
  red: "#FF6B6B",
  redDim: "#4A1F1F",
  amber: "#F5C451",
  amberDim: "#4A3A12",
  lane: "#FFE566",
  blue: "#6BB0FF",
};

const FONT_MONO = "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace";
const FONT_DISP = "'Space Grotesk', ui-sans-serif, system-ui, sans-serif";
const FONT_BODY = "'Inter', ui-sans-serif, system-ui, sans-serif";

/* ------------------------------------------------------------------ */
/*  Seed data (from spec)                                              */
/* ------------------------------------------------------------------ */
const INITIAL_TOTAL = 10611.5;
const AS_OF = "2026-07-05";

const seedDebts = () => [
  { id: 1, name: "Credit Card 01", balance: 508.26, min: null, deadline: null, type: "Interest-bearing", group: "card", apr: 24.99 },
  { id: 2, name: "Credit Card 02", balance: 400.0, min: null, deadline: null, type: "Interest-bearing", group: "card", apr: 22.99 },
  { id: 3, name: "Credit Card 03", balance: 500.0, min: null, deadline: null, type: "Interest-bearing", group: "card", apr: 26.99 },
  { id: 4, name: "Credit Card 04", balance: 280.0, min: null, deadline: null, type: "Interest-bearing", group: "card", apr: 19.99 },
  { id: 5, name: "Lender Loan 01", balance: 2173.24, min: 168, deadline: null, type: "Fixed installment", group: "loan", apr: 9.99 },
  { id: 6, name: "Lender Loan 02", balance: 750.0, min: 90, deadline: "2026-07-17", type: "Fixed installment", group: "loan", apr: 11.99 },
  { id: 7, name: "Anusha (personal)", balance: 2200.0, min: null, deadline: "2026-08-15", type: "Personal, no interest", group: "personal", apr: 0 },
  { id: 8, name: "Mom (personal)", balance: 800.0, min: null, deadline: null, type: "Personal, no interest", group: "personal", apr: 0 },
  { id: 9, name: "Sister (personal)", balance: 1500.0, min: null, deadline: null, type: "Personal, no interest", group: "personal", apr: 0 },
  { id: 10, name: "Dad (personal)", balance: 1500.0, min: null, deadline: null, type: "Personal, no interest", group: "personal", apr: 0 },
].map((d) => ({ ...d, originalBalance: d.balance, paid: false, payments: [] }));

/* Plan month targets keyed YYYY-MM: {target, daily} */
const PLANS = {
  A: {
    label: "Aggressive",
    freeDate: "2026-10-31",
    months: {
      "2026-07": { target: 4918, daily: 205 },
      "2026-08": { target: 6468, daily: 249 },
      "2026-09": { target: 7225, daily: 278 },
      "2026-10": { target: 7200, daily: 277 },
    },
  },
  B: {
    label: "Realistic",
    freeDate: "2026-12-31",
    months: {
      "2026-07": { target: 4918, daily: 205 },
      "2026-08": { target: 6468, daily: 249 },
      "2026-09": { target: 5506, daily: 212 },
      "2026-10": { target: 5506, daily: 212 },
      "2026-11": { target: 5506, daily: 212 },
      "2026-12": { target: 5506, daily: 212 },
    },
  },
};

const DEFAULT_SETTINGS = {
  monthlyBaseline: 3800,
  activePlan: "A",
  taxRate: 0.15,
  bufferGoal: 500,
  payoffMethod: "avalanche", // "avalanche" | "snowball"
  dailyGasBudget: 40, // planned gas spend per day (Uber)
  softReminders: true,
  customDailyTarget: null, // override plan daily when set by What-If
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
const usd = (n) =>
  (n < 0 ? "-$" : "$") +
  Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const usd0 = (n) =>
  (n < 0 ? "-$" : "$") + Math.abs(Math.round(n)).toLocaleString("en-US");

const todayISO = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
const asMoney = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
};
const monthKey = (iso) => iso.slice(0, 7);
const parseISO = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const daysInMonthOf = (iso) => {
  const d = parseISO(iso);
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
};
const monthLabel = (iso) =>
  parseISO(iso + (iso.length === 7 ? "-01" : "")).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
const daysBetween = (aISO, bISO) =>
  Math.ceil((parseISO(bISO) - parseISO(aISO)) / 86400000);
const uid = () => Date.now() + Math.floor(Math.random() * 1000);
const addDaysISO = (iso, n) => {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
const weekdayShort = (iso) =>
  parseISO(iso).toLocaleDateString("en-US", { weekday: "short" });
const weekdayLong = (iso) =>
  parseISO(iso).toLocaleDateString("en-US", { weekday: "long" });
const nextFridayISO = (fromISO) => {
  const d = parseISO(fromISO);
  const day = d.getDay(); // 0 Sun … 5 Fri
  const add = day <= 5 ? 5 - day : 6; // Sat → next Fri
  return addDaysISO(fromISO, add === 0 ? 0 : add);
};
const debtApr = (d) => {
  if (d.apr != null && d.apr !== "" && Number.isFinite(Number(d.apr))) return Math.max(0, Number(d.apr));
  const m = String(d.type || "").match(/(\d+(?:\.\d+)?)\s*%/);
  if (m) return Number(m[1]);
  if (d.group === "card") return 22.99;
  if (d.group === "loan") return 9.99;
  return 0;
};
const monthlyInterestOf = (d) => (asMoney(d.balance) * debtApr(d)) / 100 / 12;
/** Rough payoff sim: mins + extra each month; returns months + interest paid. */
const simulatePayoff = (debts, method, monthlyExtra) => {
  const items = debts
    .filter((d) => !d.paid && asMoney(d.balance) > 0.005)
    .map((d) => ({
      id: d.id,
      balance: asMoney(d.balance),
      min: asMoney(d.min) || Math.max(25, asMoney(d.balance) * 0.02),
      apr: debtApr(d),
    }));
  if (!items.length) return { months: 0, interest: 0 };
  let interest = 0;
  let months = 0;
  const extra = Math.max(0, monthlyExtra || 0);
  while (items.some((x) => x.balance > 0.005) && months < 120) {
    months += 1;
    for (const x of items) {
      if (x.balance <= 0.005) continue;
      const accrued = (x.balance * x.apr) / 100 / 12;
      x.balance += accrued;
      interest += accrued;
    }
    let pool = items.reduce((s, x) => s + (x.balance > 0.005 ? x.min : 0), 0) + extra;
    const order = [...items]
      .filter((x) => x.balance > 0.005)
      .sort((a, b) =>
        method === "snowball"
          ? a.balance - b.balance || b.apr - a.apr
          : b.apr - a.apr || a.balance - b.balance
      );
    for (const x of order) {
      if (pool <= 0.005) break;
      const pay = Math.min(x.balance, pool);
      x.balance = Math.max(0, x.balance - pay);
      pool -= pay;
    }
  }
  return { months, interest };
};
const weekWindow = (today) => {
  const dow = parseISO(today).getDay(); // 0=Sun
  const daysFromMon = dow === 0 ? 6 : dow - 1;
  const start = addDaysISO(today, -daysFromMon);
  const end = addDaysISO(start, 6);
  return { start, end, isSunday: dow === 0 };
};

const incomeOfEntry = (e) => (Number(e.gross) || 0) + (Number(e.other) || 0);

async function shareOrDownloadBlob(blob, filename, title, flash) {
  const file = new File([blob], filename, { type: blob.type });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title, text: title });
      flash?.("Shared");
      return;
    }
  } catch (err) {
    if (err?.name === "AbortError") return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  flash?.("Downloaded — share the file");
}

function drawCloseOutImage({
  monthTitle,
  earned,
  monthTarget,
  spent,
  debtPaid,
  taxWallet,
  plan,
}) {
  const W = 720;
  const H = 520;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  const rr = (x, y, w, h, r) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };

  // background
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#0A1018");
  bg.addColorStop(1, "#070B10");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // card
  ctx.fillStyle = "#121820";
  rr(28, 28, W - 56, H - 56, 24);
  ctx.fill();
  ctx.strokeStyle = "#2A3542";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "#5B6875";
  ctx.font = "600 18px 'JetBrains Mono', monospace";
  ctx.fillText("MONTH CLOSE-OUT", 56, 78);
  ctx.textAlign = "right";
  ctx.fillText(monthTitle, W - 56, 78);
  ctx.textAlign = "left";

  ctx.fillStyle = "#F2F5F8";
  ctx.font = "700 28px 'Space Grotesk', sans-serif";
  ctx.fillText("Debt Destroyer", 56, 120);

  const cells = [
    { label: "EARNED", value: usd0(earned), color: "#3DDC97", x: 56, y: 150 },
    { label: `PLAN ${plan} TARGET`, value: usd0(monthTarget || 0), color: "#F2F5F8", x: 366, y: 150 },
    { label: "SPENT", value: usd0(spent), color: "#F5C451", x: 56, y: 280 },
    { label: "DEBT PAID", value: usd0(debtPaid || 0), color: "#F2F5F8", x: 366, y: 280 },
  ];
  cells.forEach((c) => {
    ctx.fillStyle = "#1A222C";
    rr(c.x, c.y, 278, 106, 14);
    ctx.fill();
    ctx.fillStyle = "#5B6875";
    ctx.font = "600 14px 'JetBrains Mono', monospace";
    ctx.fillText(c.label, c.x + 18, c.y + 32);
    ctx.fillStyle = c.color;
    ctx.font = "700 36px 'JetBrains Mono', monospace";
    ctx.fillText(c.value, c.x + 18, c.y + 78);
  });

  ctx.fillStyle = "#8A97A6";
  ctx.font = "500 16px 'JetBrains Mono', monospace";
  ctx.fillText(`Tax wallet ${usd0(taxWallet || 0)} · accountability snapshot`, 56, 440);
  ctx.fillStyle = "#5B6875";
  ctx.font = "500 13px 'JetBrains Mono', monospace";
  ctx.fillText("debtkiller.vercel.app", 56, 468);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/png");
  });
}

function buildDetailedCloseOutPdf(data) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;
  let y = margin;
  const line = (h = 16) => {
    y += h;
    if (y > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  };
  const write = (text, opts = {}) => {
    const size = opts.size || 11;
    const color = opts.color || [30, 40, 50];
    const style = opts.style || "normal";
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const maxW = pageW - margin * 2;
    const rows = doc.splitTextToSize(String(text ?? ""), maxW);
    rows.forEach((row) => {
      if (y > pageH - margin) {
        doc.addPage();
        y = margin;
      }
      doc.text(row, opts.x || margin, y);
      line(opts.leading || size + 5);
    });
  };
  const section = (title) => {
    line(10);
    write(title, { size: 13, style: "bold", color: [20, 90, 70] });
    doc.setDrawColor(200, 210, 220);
    doc.line(margin, y - 10, pageW - margin, y - 10);
    line(6);
  };

  write("Debt Destroyer — Month Close-Out", { size: 18, style: "bold", color: [10, 20, 30] });
  write(data.monthTitle, { size: 12, color: [90, 100, 110] });
  write(`Generated ${data.generatedAt}`, { size: 10, color: [120, 130, 140] });
  line(6);

  section("Snapshot");
  write(`Earned: ${usd(data.earned)}   ·   Plan ${data.plan} target: ${usd(data.monthTarget || 0)}`);
  write(`Spent: ${usd(data.spent)}   ·   Debt paid this month: ${usd(data.debtPaid || 0)}`);
  write(`Tax wallet: ${usd(data.taxWallet || 0)} (expected set-aside ${usd(data.taxReserve || 0)} at ${(data.taxRate * 100).toFixed(0)}%)`);
  write(`Gas: ${usd(data.gasMonth || 0)} actual vs ${usd(data.gasMonthBudget || 0)} budget (${usd0(data.dailyGasBudget || 0)}/day)`);
  write(`Buffer: ${usd(data.buffer || 0)} / ${usd(data.bufferGoal || 0)}`);
  write(`Debt remaining: ${usd(data.remainingDebt || 0)} · ${Number(data.pctPaid || 0).toFixed(1)}% paid overall`);
  write(`Daily aim: ${usd0(data.baseDaily || 0)}${data.customDaily != null ? ` (custom override; plan base ${usd0(data.planDaily || 0)})` : ""}`);
  write(`Pace: debt-free in ~${data.daysToFree} days (${data.weeksToFree} weeks) · streak ${data.streak} day(s)`);
  if (data.effectiveHourly != null) write(`Effective hourly this month: ${usd(data.effectiveHourly)}/hr`);

  section("Earnings this month (income logged)");
  if (!data.monthEarnings.length) {
    write("No earnings logged this month.");
  } else {
    data.monthEarnings.forEach((e) => {
      const amt = incomeOfEntry(e);
      const bits = [
        e.date,
        usd(amt),
        asMoney(e.gross) ? `Uber ${usd(e.gross)}` : null,
        asMoney(e.other) ? `other ${usd(e.other)}` : null,
        e.hours ? `${e.hours}h` : null,
        e.note || null,
      ].filter(Boolean);
      write(`• ${bits.join(" · ")}`);
    });
    write(`Total earnings: ${usd(data.earned)}`, { style: "bold" });
  }

  section("Expenses this month");
  if (!data.monthExpenses.length) {
    write("No expenses logged this month.");
  } else {
    const byCat = {};
    data.monthExpenses.forEach((e) => {
      const cat = e.category || "Other";
      byCat[cat] = (byCat[cat] || 0) + asMoney(e.amount);
    });
    write("By category:");
    Object.entries(byCat)
      .sort((a, b) => b[1] - a[1])
      .forEach(([cat, amt]) => write(`  ${cat}: ${usd(amt)}`));
    line(4);
    write("Line items:");
    data.monthExpenses.forEach((e) => {
      write(`• ${e.date} · ${e.category || "Other"} · ${usd(e.amount)}${e.note ? ` · ${e.note}` : ""}`);
    });
    write(`Total spent: ${usd(data.spent)}`, { style: "bold" });
  }

  section("Debt payments this month");
  if (!data.monthPayments.length) {
    write("No debt payments marked this month.");
  } else {
    data.monthPayments.forEach((p) => {
      write(`• ${p.date} · ${p.debtName} · ${usd(p.amount)}${p.note ? ` · ${p.note}` : ""}`);
    });
    write(`Total debt paid: ${usd(data.debtPaid || 0)}`, { style: "bold" });
  }

  section("Active debts snapshot");
  if (!data.activeDebts.length) {
    write("No active debts — you're clear.");
  } else {
    data.activeDebts.forEach((d) => {
      write(
        `• ${d.name}: ${usd(d.balance)} left` +
          (d.min ? ` · min ${usd(d.min)}/mo` : "") +
          (d.deadline ? ` · due ${d.deadline}` : "") +
          (d.note ? ` · ${d.note}` : "")
      );
    });
  }

  section("How to read this");
  write("Earned = Uber gross + other income logged in the Money tab.");
  write("Plan target = monthly income goal from Plan A (aggressive) or Plan B (realistic).");
  write("Spent = all expenses logged (Gas, Rent, Food, Car, Phone, Other).");
  write("Debt paid = amounts applied to balances when you Mark paid / Log payment.");
  write("Tax wallet = money auto-parked from income for taxes — don't spend it on living costs.");
  write("Gas budget = daily gas allowance × days so far this month.");

  line(18);
  write("Built with Debt Destroyer · debtkiller.vercel.app", { size: 9, color: [140, 150, 160] });
  return doc.output("blob");
}

/** Consecutive days (ending yesterday or today) that hit daily target. */
function computeStreak(earnings, today, baseDaily, incomeOf) {
  if (!baseDaily || baseDaily <= 0) return 0;
  const byDay = {};
  earnings.forEach((e) => {
    byDay[e.date] = (byDay[e.date] || 0) + incomeOf(e);
  });
  let streak = 0;
  let cursor = today;
  // If today not yet hit, start from yesterday
  if ((byDay[today] || 0) + 0.5 < baseDaily) {
    cursor = addDaysISO(today, -1);
  }
  for (let i = 0; i < 120; i++) {
    if ((byDay[cursor] || 0) + 0.5 >= baseDaily) {
      streak += 1;
      cursor = addDaysISO(cursor, -1);
    } else break;
  }
  return streak;
}

function bestDaysOfWeek(earnings, incomeOf) {
  const buckets = { Sun: [], Mon: [], Tue: [], Wed: [], Thu: [], Fri: [], Sat: [] };
  const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  earnings.forEach((e) => {
    const d = parseISO(e.date).getDay();
    buckets[labels[d]].push(incomeOf(e));
  });
  return labels
    .map((name) => {
      const vals = buckets[name];
      const total = vals.reduce((s, n) => s + n, 0);
      const avg = vals.length ? total / vals.length : 0;
      return { name, avg, total, count: vals.length };
    })
    .filter((x) => x.count > 0)
    .sort((a, b) => b.avg - a.avg);
}

function whatIfFreeDate(remainingDebt, overallDailyAvg, taxRate, expenseDailyAvg, extraPerDay) {
  const dailyNet = Math.max(0, (overallDailyAvg + extraPerDay) * (1 - taxRate) - expenseDailyAvg);
  if (remainingDebt <= 0.005) return todayISO();
  if (dailyNet < 1) return null;
  const days = Math.ceil(remainingDebt / dailyNet);
  return addDaysISO(todayISO(), days);
}

/* ------------------------------------------------------------------ */
/*  Persistence is handled by cloudStore.js. It always keeps a local  */
/*  backup and syncs to Supabase when cloud environment variables exist. */
/* ------------------------------------------------------------------ */

/* ================================================================== */
/*  APP                                                                */
/* ================================================================== */
export default function App() {
  const [authReady, setAuthReady] = useState(false);
  const [session, setSession] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState("home");
  const [debts, setDebts] = useState([]);
  const [earnings, setEarnings] = useState([]); // {id,date,gross,other,hours?,note}
  const [expenses, setExpenses] = useState([]); // {id,date,amount,category,note}
  const [recurring, setRecurring] = useState([]); // {id,amount,category,note,cadence,lastLogged?}
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [buffer, setBuffer] = useState(0);
  const [taxWallet, setTaxWallet] = useState(0);
  const [milestonesSeen, setMilestonesSeen] = useState([]);
  const [whatIfExtra, setWhatIfExtra] = useState(50);
  const [celebrate, setCelebrate] = useState(null);
  const [toast, setToast] = useState(null);
  const [nudgeDismissed, setNudgeDismissed] = useState(false);
  const [syncStatus, setSyncStatus] = useState(cloudEnabled ? "connecting" : "local");
  const toastTimer = useRef(null);
  const saveTimer = useRef(null);
  const applyingRemote = useRef(false);
  const importInputRef = useRef(null);

  const applyState = (s) => {
    if (!s || typeof s !== "object") return;
    if (Array.isArray(s.debts)) {
      setDebts(
        s.debts.map((d) => ({
          ...d,
          balance: asMoney(d.balance),
          originalBalance: asMoney(d.originalBalance ?? d.balance),
          apr: d.apr == null || d.apr === "" ? null : Number(d.apr),
          payments: Array.isArray(d.payments) ? d.payments : [],
          note: d.note || "",
          paid: Boolean(d.paid) || asMoney(d.balance) <= 0.005,
        }))
      );
    }
    if (Array.isArray(s.earnings)) setEarnings(s.earnings);
    if (Array.isArray(s.expenses)) setExpenses(s.expenses);
    if (Array.isArray(s.recurring)) setRecurring(s.recurring);
    if (s.settings) setSettings({ ...DEFAULT_SETTINGS, ...s.settings });
    if (typeof s.buffer === "number") setBuffer(s.buffer);
    if (typeof s.taxWallet === "number") setTaxWallet(Math.max(0, s.taxWallet));
    else if (Array.isArray(s.earnings) && s.settings) {
      const rate = Number(s.settings.taxRate ?? DEFAULT_SETTINGS.taxRate) || 0.15;
      const gross = s.earnings.reduce((sum, e) => sum + (Number(e.gross) || 0) + (Number(e.other) || 0), 0);
      setTaxWallet(+(gross * rate).toFixed(2));
    }
    if (Array.isArray(s.milestonesSeen)) setMilestonesSeen(s.milestonesSeen);
  };

  /* ---- inject fonts + motion once ---- */
  useEffect(() => {
    const id = "dd-fonts";
    if (!document.getElementById(id)) {
      const l = document.createElement("link");
      l.id = id;
      l.rel = "stylesheet";
      l.href =
        "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap";
      document.head.appendChild(l);
    }
    const motionId = "dd-motion";
    if (!document.getElementById(motionId)) {
      const s = document.createElement("style");
      s.id = motionId;
      s.textContent = `
        @keyframes ddRise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes ddLane{0%{background-position:0 0}100%{background-position:36px 0}}
      `;
      document.head.appendChild(s);
    }
  }, []);

  /* ---- auth bootstrap ---- */
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        if (!cloudEnabled) {
          if (active) {
            setSession({ local: true });
            setAuthReady(true);
          }
          return;
        }
        const current = await getSession();
        if (active) {
          setSession(current);
          setAuthReady(true);
        }
      } catch (error) {
        console.error(error);
        if (active) {
          setSession(null);
          setAuthReady(true);
        }
      }
    })();
    const unsub = onAuthChange((next) => {
      setSession(next);
      if (!next) {
        setLoaded(false);
        setSyncStatus("connecting");
      }
    });
    return () => {
      active = false;
      unsub();
    };
  }, []);

  /* ---- load once after login / account switch ---- */
  useEffect(() => {
    if (!authReady || !session) return undefined;
    let active = true;
    setLoaded(false);
    applyingRemote.current = true;
    applyState(emptyAppState());
    (async () => {
      try {
        const { state: s, source } = await loadAppState();
        if (!active) return;
        applyingRemote.current = true;
        applyState(s || emptyAppState());
        setSyncStatus(source === "cloud" ? "synced" : cloudEnabled ? "ready" : "local");
      } catch (error) {
        console.error(error);
        if (active) setSyncStatus("error");
      } finally {
        if (active) setLoaded(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [authReady, session?.user?.id || session?.local]);

  /* ---- live cloud updates (other devices / tabs) ---- */
  useEffect(() => {
    if (!loaded || !cloudEnabled || !session?.user) return undefined;
    return subscribeAppState((remote) => {
      applyingRemote.current = true;
      applyState(remote);
      setSyncStatus("synced");
    });
  }, [loaded, session?.user?.id]);

  /* ---- autosave (debounced) whole snapshot into one key ---- */
  useEffect(() => {
    if (!loaded || !session) return;
    if (applyingRemote.current) {
      applyingRemote.current = false;
      return;
    }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSyncStatus(cloudEnabled ? "saving" : "local");
    saveTimer.current = setTimeout(async () => {
      const result = await saveAppState({ debts, earnings, expenses, recurring, settings, buffer, taxWallet, milestonesSeen });
      setSyncStatus(result.cloud ? "synced" : cloudEnabled ? "error" : "local");
    }, 700);
    return () => saveTimer.current && clearTimeout(saveTimer.current);
  }, [debts, earnings, expenses, recurring, settings, buffer, taxWallet, milestonesSeen, loaded, session?.user?.id || session?.local]);

  const flash = (msg) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      setSession(null);
      setLoaded(false);
      applyState(emptyAppState());
      flash("Signed out");
    } catch (error) {
      flash(error.message || "Could not sign out");
    }
  };

  /* ---------------- derived numbers ---------------- */
  const activeDebts = debts.filter((d) => !d.paid && d.balance > 0.005);
  const originalTotal = debts.reduce((s, d) => s + asMoney(d.originalBalance ?? d.balance), 0) || INITIAL_TOTAL;
  const remainingDebt = debts.reduce((s, d) => s + asMoney(d.balance), 0);
  const pctPaid = Math.min(100, Math.max(0, ((originalTotal - remainingDebt) / originalTotal) * 100));

  const today = todayISO();
  const curMonth = monthKey(today);
  const plan = PLANS[settings.activePlan] || PLANS.A;
  const planMonth = plan.months[curMonth] || null;

  const incomeOf = (e) => incomeOfEntry(e);
  const totalIncome = earnings.reduce((s, e) => s + incomeOf(e), 0);
  const taxReserve = totalIncome * settings.taxRate;
  const totalExpenses = expenses.reduce((s, e) => s + asMoney(e.amount), 0);
  const availableAfterTaxAndExpenses = Math.max(0, totalIncome - taxReserve - totalExpenses);

  const earnedThisMonth = earnings
    .filter((e) => monthKey(e.date) === curMonth)
    .reduce((s, e) => s + incomeOf(e), 0);
  const spentThisMonth = expenses
    .filter((e) => monthKey(e.date) === curMonth)
    .reduce((s, e) => s + (Number(e.amount) || 0), 0);

  const dim = daysInMonthOf(today);
  const dayNow = parseISO(today).getDate();
  const daysElapsed = dayNow;
  const daysRemainingIncl = dim - dayNow + 1;

  /* today's logged income */
  const earnedToday = earnings
    .filter((e) => e.date === today)
    .reduce((s, e) => s + incomeOf(e), 0);

  const monthTarget = planMonth ? planMonth.target : 0;
  const planDaily = planMonth ? planMonth.daily : 0;
  const customDaily = settings.customDailyTarget != null ? asMoney(settings.customDailyTarget) : null;
  const baseDaily = customDaily != null && customDaily > 0 ? customDaily : planDaily;
  const remainingMonthTarget = Math.max(0, monthTarget - earnedThisMonth);
  // Missed earlier days → leftover target is split evenly across remaining days (incl. today)
  const adjustedDaily = planMonth
    ? (customDaily != null && customDaily > 0
        ? customDaily
        : remainingMonthTarget / daysRemainingIncl)
    : 0;
  const pastDays = Math.max(0, dayNow - 1);
  const earnedBeforeToday = Math.max(0, earnedThisMonth - earnedToday);
  const expectedBeforeToday = baseDaily * pastDays;
  const pastShortfall = Math.max(0, expectedBeforeToday - earnedBeforeToday);
  const dailyCatchUpBump = daysRemainingIncl > 0 ? pastShortfall / daysRemainingIncl : 0;
  const runningSurplus = earnedThisMonth - baseDaily * daysElapsed;
  const dailyAvgMonth = daysElapsed > 0 ? earnedThisMonth / daysElapsed : 0;
  const projectedMonthEnd = dailyAvgMonth * dim;

  /* overall pace for debt-free projection */
  const loggedDays = new Set(earnings.map((e) => e.date)).size;
  const overallDailyAvg = loggedDays > 0 ? totalIncome / loggedDays : baseDaily;
  const expenseDailyAvg = loggedDays > 0 ? totalExpenses / loggedDays : settings.monthlyBaseline / 30.44;
  const monthlyCapacity = Math.max(0, (overallDailyAvg * (1 - settings.taxRate) - expenseDailyAvg) * 30.44);

  const debtPaidThisMonth = debts.reduce(
    (sum, d) =>
      sum +
      (d.payments || [])
        .filter((p) => monthKey(p.date) === curMonth)
        .reduce((s, p) => s + asMoney(p.amount), 0),
    0
  );
  const monthlyMins = activeDebts.reduce((sum, d) => sum + asMoney(d.min), 0);
  const projectedGrossMonth = Math.max(projectedMonthEnd, earnedThisMonth + adjustedDaily * Math.max(0, daysRemainingIncl - 1));
  const projectedTaxMonth = projectedGrossMonth * settings.taxRate;
  const projectedSpendMonth = Math.max(spentThisMonth, (spentThisMonth / Math.max(1, daysElapsed)) * dim);
  const projectedAfterExpenses = Math.max(0, projectedGrossMonth - projectedTaxMonth - projectedSpendMonth);
  const projectedAfterLoans = Math.max(0, projectedAfterExpenses - monthlyMins);
  const leftoverForExtraDebt = Math.max(0, projectedAfterLoans - Math.max(0, settings.bufferGoal - buffer));

  let projectedFreeISO = plan.freeDate;
  let paceDelta = null; // days ahead(+)/behind(-) vs plan
  if (remainingDebt <= 0.005) {
    projectedFreeISO = today;
  } else if (monthlyCapacity > 50 && loggedDays > 0) {
    const monthsToClear = remainingDebt / monthlyCapacity;
    const proj = new Date();
    proj.setDate(proj.getDate() + Math.round(monthsToClear * 30.44));
    projectedFreeISO = proj.toISOString().slice(0, 10);
    paceDelta = daysBetween(projectedFreeISO, plan.freeDate);
  }

  const gasToday = expenses
    .filter((e) => e.date === today && String(e.category || "").toLowerCase() === "gas")
    .reduce((s, e) => s + asMoney(e.amount), 0);
  const gasThisMonth = expenses
    .filter((e) => monthKey(e.date) === curMonth && String(e.category || "").toLowerCase() === "gas")
    .reduce((s, e) => s + asMoney(e.amount), 0);
  const { start: weekStart } = weekWindow(today);
  const dailyGasBudget = asMoney(settings.dailyGasBudget);
  const gasThisWeek = expenses
    .filter((e) => e.date >= weekStart && e.date <= today && String(e.category || "").toLowerCase() === "gas")
    .reduce((s, e) => s + asMoney(e.amount), 0);
  const daysIntoWeek = Math.max(1, daysBetween(weekStart, today) + 1);
  const gasWeekBudget = dailyGasBudget * daysIntoWeek;
  const gasMonthBudget = dailyGasBudget * dayNow;
  const netAfterFuelToday = earnedToday - gasToday;
  const hoursLogged = earnings.reduce((s, e) => s + (Number(e.hours) || 0), 0);
  const hoursThisMonth = earnings
    .filter((e) => monthKey(e.date) === curMonth)
    .reduce((s, e) => s + (Number(e.hours) || 0), 0);
  const effectiveHourly =
    hoursThisMonth > 0 ? earnedThisMonth / hoursThisMonth : hoursLogged > 0 ? totalIncome / hoursLogged : null;
  const bestDays = useMemo(() => bestDaysOfWeek(earnings, incomeOfEntry), [earnings]);
  const totalDailyAim = (adjustedDaily || 0) + dailyGasBudget;
  const streak = computeStreak(earnings, today, totalDailyAim || baseDaily + dailyGasBudget, incomeOfEntry);
  const paidSoFar = Math.max(0, originalTotal - remainingDebt);
  const daysToFree = Math.max(0, daysBetween(today, projectedFreeISO));
  const weeksToFree = Math.max(0, Math.ceil(daysToFree / 7));
  const whatIfDate = whatIfFreeDate(
    remainingDebt,
    overallDailyAvg || baseDaily,
    settings.taxRate,
    expenseDailyAvg,
    whatIfExtra
  );
  const hourNow = new Date().getHours();
  const showEveningNudge =
    !!planMonth && hourNow >= 18 && earnedToday + 0.5 < totalDailyAim && !nudgeDismissed;

  const paymentHistory = useMemo(() => {
    const rows = [];
    for (const d of debts) {
      for (const p of d.payments || []) {
        rows.push({
          id: `${d.id}-${p.id}`,
          debtId: d.id,
          debtName: d.name,
          date: p.date,
          amount: asMoney(p.amount),
          note: p.note || "",
        });
      }
    }
    return rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }, [debts]);

  /* deadline + soft reminders */
  const deadlineAlerts = activeDebts
    .filter((d) => d.deadline)
    .map((d) => ({ kind: "deadline", d, days: daysBetween(today, d.deadline) }))
    .filter((x) => x.days <= 10)
    .sort((a, b) => a.days - b.days);
  const softAlerts = [];
  if (settings.softReminders !== false) {
    for (const d of activeDebts) {
      if (asMoney(d.min) > 0 && d.deadline) {
        const days = daysBetween(today, d.deadline);
        if (days <= 5) {
          softAlerts.push({
            kind: "min",
            d,
            days,
            message: `Min payment ~${usd0(d.min)} on ${d.name}`,
          });
        }
      }
    }
    if (buffer + 0.5 < asMoney(settings.bufferGoal)) {
      softAlerts.push({
        kind: "buffer",
        days: 99,
        message: `Buffer ${usd0(buffer)} below goal ${usd0(settings.bufferGoal)}`,
      });
    }
  }
  const alerts = [...deadlineAlerts, ...softAlerts];

  /* ---------------- actions ---------------- */
  const addEarning = ({ date, gross, other, note, hours }) => {
    const entry = {
      id: uid(),
      date: date || today,
      gross: asMoney(gross),
      other: asMoney(other),
      hours: Math.max(0, Number(hours) || 0) || null,
      note: (note || "").trim(),
    };
    const income = entry.gross + entry.other;
    if (income <= 0) return flash("Enter an income amount");
    const taxBite = +(income * settings.taxRate).toFixed(2);
    setEarnings((p) => [entry, ...p]);
    if (taxBite > 0) setTaxWallet((w) => +(w + taxBite).toFixed(2));
    flash(taxBite > 0 ? `Logged · ${usd0(taxBite)} parked in tax wallet` : "Earnings logged");
  };
  const updateEarning = (id, changes) => {
    const nextGross = asMoney(changes.gross);
    const nextOther = asMoney(changes.other);
    const nextIncome = nextGross + nextOther;
    if (nextIncome <= 0) return flash("Enter an income amount");
    const prev = earnings.find((e) => e.id === id);
    if (!prev) return flash("Earning not found");
    const prevIncome = asMoney(prev.gross) + asMoney(prev.other);
    const taxDelta = +((nextIncome - prevIncome) * settings.taxRate).toFixed(2);
    setEarnings((p) =>
      p.map((e) =>
        e.id === id
          ? {
              ...e,
              date: changes.date || e.date,
              gross: nextGross,
              other: nextOther,
              hours: Math.max(0, Number(changes.hours) || 0) || null,
              note: (changes.note || "").trim(),
            }
          : e
      )
    );
    if (taxDelta !== 0) setTaxWallet((w) => Math.max(0, +(w + taxDelta).toFixed(2)));
    flash(taxDelta !== 0 ? `Earning updated · tax wallet ${taxDelta > 0 ? "+" : ""}${usd0(taxDelta)}` : "Earning updated");
    return true;
  };
  const addExpense = ({ date, amount, category, note }) => {
    const value = asMoney(amount);
    if (value <= 0) return flash("Enter an expense amount");
    setExpenses((p) => [{ id: uid(), date: date || today, amount: value, category: category || "Other", note: (note || "").trim() }, ...p]);
    flash("Expense logged");
  };
  const updateExpense = (id, changes) => {
    const value = asMoney(changes.amount);
    if (value <= 0) return flash("Enter an expense amount");
    setExpenses((p) =>
      p.map((e) =>
        e.id === id
          ? {
              ...e,
              date: changes.date || e.date,
              amount: value,
              category: changes.category || e.category || "Other",
              note: (changes.note || "").trim(),
            }
          : e
      )
    );
    flash("Expense updated");
    return true;
  };
  const removeEntry = (kind, id) => {
    if (kind === "earn") {
      const prev = earnings.find((e) => e.id === id);
      if (prev) {
        const income = asMoney(prev.gross) + asMoney(prev.other);
        const taxBite = +(income * settings.taxRate).toFixed(2);
        if (taxBite > 0) setTaxWallet((w) => Math.max(0, +(w - taxBite).toFixed(2)));
      }
      setEarnings((p) => p.filter((e) => e.id !== id));
      flash("Earning removed");
    } else {
      setExpenses((p) => p.filter((e) => e.id !== id));
    }
  };

  const addRecurring = ({ amount, category, note, cadence }) => {
    const value = asMoney(amount);
    if (value <= 0) return flash("Enter an amount");
    setRecurring((p) => [
      {
        id: uid(),
        amount: value,
        category: category || "Other",
        note: (note || "").trim(),
        cadence: cadence === "weekly" ? "weekly" : "monthly",
        lastLogged: null,
      },
      ...p,
    ]);
    flash("Recurring expense saved");
    return true;
  };
  const removeRecurring = (id) => setRecurring((p) => p.filter((r) => r.id !== id));
  const logRecurringNow = (id) => {
    const r = recurring.find((x) => x.id === id);
    if (!r) return;
    addExpense({ date: today, amount: r.amount, category: r.category, note: r.note || `Recurring ${r.cadence}` });
    setRecurring((p) => p.map((x) => (x.id === id ? { ...x, lastLogged: today } : x)));
  };

  const addDebt = ({ name, balance, min, deadline, type, group, apr, note }) => {
    const cleanName = (name || "").trim();
    const cleanBalance = asMoney(balance);
    if (!cleanName) return flash("Enter a debt name");
    if (cleanBalance <= 0) return flash("Enter the current balance");
    const aprNum = apr === "" || apr == null ? null : Number(apr);
    const debt = {
      id: uid(),
      name: cleanName,
      balance: cleanBalance,
      originalBalance: cleanBalance,
      min: asMoney(min) || null,
      deadline: deadline || null,
      type: (type || "Interest-bearing").trim(),
      group: ["card", "loan", "personal"].includes(group) ? group : "card",
      apr: Number.isFinite(aprNum) ? Math.max(0, aprNum) : null,
      note: (note || "").trim(),
      paid: false,
      payments: [],
      createdAt: today,
    };
    setDebts((prev) => [debt, ...prev]);
    flash("Debt added");
    return true;
  };

  const updateDebt = (debtId, changes) => {
    const cleanName = (changes.name || "").trim();
    const cleanBalance = asMoney(changes.balance);
    if (!cleanName) return flash("Enter a debt name");
    if (cleanBalance < 0) return flash("Balance cannot be negative");
    const aprNum = changes.apr === "" || changes.apr == null ? null : Number(changes.apr);
    setDebts((prev) => prev.map((d) => {
      if (d.id !== debtId) return d;
      const alreadyPaid = Math.max(0, asMoney(d.originalBalance) - asMoney(d.balance));
      const originalBalance = Math.max(cleanBalance + alreadyPaid, cleanBalance);
      return {
        ...d,
        name: cleanName,
        balance: cleanBalance,
        originalBalance,
        min: asMoney(changes.min) || null,
        deadline: changes.deadline || null,
        type: (changes.type || "Interest-bearing").trim(),
        group: ["card", "loan", "personal"].includes(changes.group) ? changes.group : "card",
        apr: Number.isFinite(aprNum) ? Math.max(0, aprNum) : null,
        note: (changes.note || "").trim(),
        paid: cleanBalance <= 0.005,
      };
    }));
    flash("Debt updated");
    return true;
  };

  const deleteDebt = (debtId) => {
    setDebts((prev) => prev.filter((d) => d.id !== debtId));
    flash("Debt deleted");
  };

  const logPayment = (debtId, amount, note = "") => {
    const amt = +amount;
    if (!amt || amt <= 0) return;
    const debt = debts.find((d) => d.id === debtId);
    if (!debt) return;
    // Cap to remaining balance so overpays don't inflate milestones / paid totals.
    const applied = appliedPayment(debt.balance, amt);
    if (applied <= 0) return;

    const paidBefore = Math.max(0, originalTotal - remainingDebt);
    const paidAfter = paidBefore + applied;
    const nowPaid = asMoney(debt.balance) - applied <= 0.005;

    setDebts((prev) =>
      prev.map((d) => {
        if (d.id !== debtId) return d;
        const nb = Math.max(0, +(asMoney(d.balance) - applied).toFixed(2));
        return {
          ...d,
          balance: nb,
          paid: nb <= 0.005,
          payments: [
            { id: uid(), date: today, amount: applied, note: (note || "").trim() },
            ...(d.payments || []),
          ],
        };
      })
    );

    if (nowPaid && !debt.paid) {
      setCelebrate(`${debt.name} cleared`);
      setTimeout(() => setCelebrate(null), 3200);
    }

    const crossed = milestoneCrossings(paidBefore, paidAfter, milestonesSeen);
    if (crossed.length) {
      setMilestonesSeen((m) => [...m, ...crossed]);
      const top = crossed[crossed.length - 1];
      setCelebrate(`$${Math.round(top / 1000)}k paid off`);
      setTimeout(() => setCelebrate(null), 3200);
    }
    flash("Payment recorded");
  };

  const fundBuffer = (amt) => {
    const a = +amt;
    if (!a) return;
    setBuffer((b) => Math.max(0, b + a));
    flash(a > 0 ? "Buffer funded" : "Buffer adjusted");
  };

  const withdrawTax = (amt) => {
    const a = asMoney(amt);
    if (a <= 0) return flash("Enter an amount");
    setTaxWallet((w) => Math.max(0, +(w - a).toFixed(2)));
    flash(`Took ${usd0(a)} out of tax wallet`);
  };
  const syncTaxWalletToExpected = () => {
    const next = Math.max(0, +(taxReserve).toFixed(2));
    setTaxWallet(next);
    flash(`Tax wallet set to expected ${usd0(next)}`);
  };

  /* export / import */
  const exportJSON = () => {
    const blob = new Blob(
      [JSON.stringify({ debts, earnings, expenses, recurring, settings, buffer, taxWallet, milestonesSeen, exportedAt: new Date().toISOString() }, null, 2)],
      { type: "application/json" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `debt-destroyer-backup-${today}.json`;
    a.click();
    URL.revokeObjectURL(url);
    flash("Backup downloaded");
  };
  const exportCSV = () => {
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = ["type,date,amount,category_or_debt,note,gross,other,hours"];
    for (const e of earnings) {
      const amt = asMoney(e.gross) + asMoney(e.other);
      lines.push(["earning", e.date, amt, "Income", e.note || "", e.gross, e.other, e.hours ?? ""].map(esc).join(","));
    }
    for (const e of expenses) {
      lines.push(["expense", e.date, e.amount, e.category || "Other", e.note || "", "", "", ""].map(esc).join(","));
    }
    for (const row of paymentHistory) {
      lines.push(["payment", row.date, row.amount, row.debtName, row.note || "", "", "", ""].map(esc).join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `debt-destroyer-${today}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    flash("CSV downloaded");
  };
  const importJSON = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const s = JSON.parse(reader.result);
        if (!s || typeof s !== "object" || !Array.isArray(s.debts)) throw new Error("Invalid backup");
        applyState(s);
        flash("Backup restored");
      } catch (e) {
        flash("Couldn't read that file");
      }
    };
    reader.readAsText(file);
  };

  const resetAll = () => {
    setDebts(seedDebts());
    setEarnings([]);
    setExpenses([]);
    setRecurring([]);
    setSettings(DEFAULT_SETTINGS);
    setBuffer(0);
    setTaxWallet(0);
    setMilestonesSeen([]);
    flash("Reset to starting data");
  };

  const applyWhatIfAsTarget = () => {
    const daily = Math.round((overallDailyAvg || baseDaily) + whatIfExtra);
    setSettings((s) => ({ ...s, customDailyTarget: Math.max(0, daily) }));
    flash(`Daily target set to ${usd0(daily)}`);
  };
  const clearCustomDaily = () => {
    setSettings((s) => ({ ...s, customDailyTarget: null }));
    flash("Back to plan daily targets");
  };

  const closeOutPayload = () => {
    const monthEarnings = earnings
      .filter((e) => monthKey(e.date) === curMonth)
      .sort((a, b) => (a.date < b.date ? -1 : 1));
    const monthExpenses = expenses
      .filter((e) => monthKey(e.date) === curMonth)
      .sort((a, b) => (a.date < b.date ? -1 : 1));
    const monthPayments = paymentHistory.filter((p) => monthKey(p.date) === curMonth);
    return {
      monthTitle: monthLabel(curMonth + "-01"),
      generatedAt: new Date().toLocaleString("en-US"),
      earned: earnedThisMonth,
      spent: spentThisMonth,
      debtPaid: debtPaidThisMonth,
      taxWallet,
      taxReserve,
      taxRate: settings.taxRate,
      monthTarget,
      plan: settings.activePlan,
      gasMonth: gasThisMonth,
      gasMonthBudget,
      dailyGasBudget,
      buffer,
      bufferGoal: settings.bufferGoal,
      remainingDebt,
      pctPaid,
      baseDaily,
      planDaily,
      customDaily,
      daysToFree,
      weeksToFree,
      streak,
      effectiveHourly,
      monthEarnings,
      monthExpenses,
      monthPayments,
      activeDebts: activeDebts.map((d) => ({
        name: d.name,
        balance: d.balance,
        min: d.min,
        deadline: d.deadline,
        note: d.note,
      })),
    };
  };

  const shareCloseOutImage = async () => {
    try {
      const data = closeOutPayload();
      const blob = await drawCloseOutImage(data);
      if (!blob) return flash("Couldn't create image");
      await shareOrDownloadBlob(
        blob,
        `debt-destroyer-closeout-${curMonth}.png`,
        `Debt Destroyer · ${data.monthTitle}`,
        flash
      );
    } catch {
      flash("Couldn't share image");
    }
  };

  const shareCloseOutPdf = async () => {
    try {
      const data = closeOutPayload();
      const blob = buildDetailedCloseOutPdf(data);
      await shareOrDownloadBlob(
        blob,
        `debt-destroyer-closeout-${curMonth}.pdf`,
        `Debt Destroyer close-out · ${data.monthTitle}`,
        flash
      );
    } catch {
      flash("Couldn't share PDF");
    }
  };

  useEffect(() => {
    if (!showEveningNudge || typeof Notification === "undefined") return undefined;
    if (Notification.permission === "granted") {
      try {
        new Notification("Debt Destroyer", {
          body: `Still ${usd0(Math.max(0, adjustedDaily - earnedToday))} short of today's target.`,
        });
      } catch { /* ignore */ }
    }
    return undefined;
  }, [showEveningNudge]);

  /* ---------------- chart data ---------------- */
  const earningsChartData = useMemo(() => {
    const map = {};
    earnings
      .filter((e) => monthKey(e.date) === curMonth)
      .forEach((e) => {
        const day = parseISO(e.date).getDate();
        map[day] = (map[day] || 0) + incomeOf(e);
      });
    const rows = [];
    for (let d = 1; d <= dim; d++) {
      rows.push({
        day: d,
        earned: d <= dayNow ? +(map[d] || 0).toFixed(2) : null,
        target: baseDaily,
      });
    }
    return rows;
  }, [earnings, curMonth, dim, dayNow, baseDaily]);

  const debtChartData = useMemo(() => {
    const pays = [];
    debts.forEach((d) => (d.payments || []).forEach((p) => pays.push({ date: p.date, amount: p.amount })));
    pays.sort((a, b) => (a.date < b.date ? -1 : 1));
    const startTotal = debts.reduce((sum, d) => sum + asMoney(d.originalBalance ?? d.balance), 0) || INITIAL_TOTAL;
    const rows = [{ label: AS_OF.slice(5), total: startTotal }];
    let running = startTotal;
    pays.forEach((p) => {
      running = Math.max(0, +(running - p.amount).toFixed(2));
      rows.push({ label: p.date.slice(5), total: running });
    });
    if (pays.length === 0) rows.push({ label: today.slice(5), total: startTotal });
    return rows;
  }, [debts, today]);

  /* ---------------- render ---------------- */
  if (!authReady) {
    return (
      <div style={{ ...page, display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}>
        <div style={{ color: C.muted, fontFamily: FONT_MONO }}>Securing your vault…</div>
      </div>
    );
  }

  if (!session) {
    return <LoginScreen onSignedIn={setSession} />;
  }

  if (!loaded) {
    return (
      <div style={{ ...page, display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}>
        <div style={{ color: C.muted, fontFamily: FONT_MONO }}>Loading your dashboard…</div>
      </div>
    );
  }

  const TABS = [
    { id: "home", label: "Home", icon: Home },
    { id: "debts", label: "Debts", icon: Flag },
    { id: "money", label: "Money", icon: Wallet },
    { id: "charts", label: "Charts", icon: BarChart3 },
    { id: "settings", label: "Settings", icon: SettingsIcon },
  ];

  return (
    <div style={page}>
      {celebrate && <Confetti />}
      {celebrate && (
        <div style={celebrateBanner}>
          <Trophy size={18} /> {celebrate} 🎉
        </div>
      )}
      {toast && <div style={toastStyle}>{toast}</div>}

      <div style={{ maxWidth: 680, margin: "0 auto", padding: "0 16px 104px" }}>
        {/* Masthead */}
        <header style={{ paddingTop: 18, paddingBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <div style={badgeIcon}><Car size={16} color={C.asphalt} /></div>
            <div>
              <div style={{ fontFamily: FONT_DISP, fontWeight: 700, fontSize: 17, letterSpacing: -0.3, lineHeight: 1 }}>
                Debt Destroyer
              </div>
              <div style={{ fontFamily: FONT_MONO, fontSize: 10.5, color: C.faint, letterSpacing: 1, marginTop: 3 }}>
                ROAD TO DEBT-FREE
              </div>
            </div>
            <div style={{ marginLeft: "auto", textAlign: "right" }}>
              <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: C.faint }}>PLAN</div>
              <div style={{ fontFamily: FONT_DISP, fontWeight: 600, fontSize: 13, color: C.lane }}>
                {settings.activePlan} · {plan.label}
              </div>
              <div style={{ fontFamily: FONT_MONO, fontSize: 9.5, marginTop: 4, color: syncStatus === "synced" ? C.green : syncStatus === "error" ? C.red : C.faint }}>
                {syncStatus === "synced" ? "● CLOUD SAVED" : syncStatus === "saving" ? "● SAVING…" : syncStatus === "connecting" ? "● CONNECTING…" : syncStatus === "error" ? "● LOCAL BACKUP" : "● LOCAL ONLY"}
              </div>
            </div>
          </div>
        </header>

        {tab === "home" && (
          <>
            {showEveningNudge && (
              <EveningNudge
                shortfall={Math.max(0, totalDailyAim - earnedToday)}
                onDismiss={() => setNudgeDismissed(true)}
                onEnablePush={() => {
                  if (typeof Notification !== "undefined") Notification.requestPermission();
                }}
              />
            )}
            {alerts.length > 0 && <AlertsBanner alerts={alerts} />}
            <CountdownCard
              days={daysToFree}
              weeks={weeksToFree}
              freeISO={projectedFreeISO}
              remaining={remainingDebt}
              pctPaid={pctPaid}
            />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              <StreakCard streak={streak} target={totalDailyAim || baseDaily} />
              <GasNetCard earnedToday={earnedToday} gasToday={gasToday} gasMonth={gasThisMonth} net={netAfterFuelToday} />
            </div>
            <DailyTargetCard
              planMonth={planMonth}
              earnedToday={earnedToday}
              baseDaily={baseDaily}
              adjustedDaily={adjustedDaily}
              dailyGasBudget={dailyGasBudget}
              runningSurplus={runningSurplus}
              daysRemaining={daysRemainingIncl}
              pastShortfall={pastShortfall}
              dailyCatchUpBump={dailyCatchUpBump}
            />
            <ShiftStatsCard
              effectiveHourly={effectiveHourly}
              hoursThisMonth={hoursThisMonth}
              earnedThisMonth={earnedThisMonth}
              bestDays={bestDays}
            />
            <PaymentScheduleCard
              debts={debts}
              today={today}
              method={settings.payoffMethod}
              leftoverForExtraDebt={leftoverForExtraDebt}
              buffer={buffer}
              bufferGoal={settings.bufferGoal}
              available={availableAfterTaxAndExpenses}
              onMarkPaid={logPayment}
            />
            <PaymentHistoryCard rows={paymentHistory} />
            <GasBudgetCard
              gasWeek={gasThisWeek}
              weekBudget={gasWeekBudget}
              gasMonth={gasThisMonth}
              monthBudget={gasMonthBudget}
              dailyBudget={dailyGasBudget}
            />
            <WeeklyReviewCard
              today={today}
              earnings={earnings}
              baseDaily={baseDaily}
              adjustedDaily={adjustedDaily}
              planMonth={planMonth}
              incomeOf={incomeOf}
            />
            <Hero
              remaining={remainingDebt}
              originalTotal={originalTotal}
              pctPaid={pctPaid}
              debts={debts}
              projectedFreeISO={projectedFreeISO}
              planFreeISO={plan.freeDate}
              paceDelta={paceDelta}
            />
            <WhatIfCard
              extra={whatIfExtra}
              setExtra={setWhatIfExtra}
              whatIfDate={whatIfDate}
              remaining={remainingDebt}
              baselineDaily={overallDailyAvg || baseDaily}
              customDaily={customDaily}
              onApply={applyWhatIfAsTarget}
              onClear={clearCustomDaily}
            />
            <InterestDragCard debts={debts} />
            <SmartPayoffCard
              debts={debts}
              today={today}
              available={availableAfterTaxAndExpenses}
              buffer={buffer}
              bufferGoal={settings.bufferGoal}
              leftoverForExtraDebt={leftoverForExtraDebt}
              method={settings.payoffMethod}
              onMethodChange={(m) => setSettings((s) => ({ ...s, payoffMethod: m }))}
            />
            <NetProjectionCard
              projectedGross={projectedGrossMonth}
              projectedTax={projectedTaxMonth}
              projectedSpend={projectedSpendMonth}
              debtPaidThisMonth={debtPaidThisMonth}
              monthlyMins={monthlyMins}
              projectedAfterLoans={projectedAfterLoans}
              leftoverForExtraDebt={leftoverForExtraDebt}
            />
            <MonthlyDashboard
              curMonth={curMonth}
              monthTarget={monthTarget}
              earnedThisMonth={earnedThisMonth}
              projectedMonthEnd={projectedMonthEnd}
              daysRemaining={daysRemainingIncl}
              spentThisMonth={spentThisMonth}
              baseline={settings.monthlyBaseline}
              hasPlan={!!planMonth}
            />
            <MonthReportCard
              onShareImage={shareCloseOutImage}
              onSharePdf={shareCloseOutPdf}
              curMonth={curMonth}
              earned={earnedThisMonth}
              spent={spentThisMonth}
              debtPaid={debtPaidThisMonth}
              taxWallet={taxWallet}
              monthTarget={monthTarget}
              plan={settings.activePlan}
            />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <TaxWalletCard
                wallet={taxWallet}
                expected={taxReserve}
                rate={settings.taxRate}
                onWithdraw={withdrawTax}
                onSyncExpected={syncTaxWalletToExpected}
              />
              <BufferCard buffer={buffer} goal={settings.bufferGoal} onFund={fundBuffer} />
            </div>
            <QuickLog onEarn={addEarning} onExpense={addExpense} />
          </>
        )}

        {tab === "debts" && (
          <DebtsView debts={debts} today={today} onPay={logPayment} onAdd={addDebt} onUpdate={updateDebt} onDelete={deleteDebt} />
        )}

        {tab === "money" && (
          <MoneyView
            earnings={earnings}
            expenses={expenses}
            recurring={recurring}
            onEarn={addEarning}
            onExpense={addExpense}
            onUpdateExpense={updateExpense}
            onUpdateEarning={updateEarning}
            onRemove={removeEntry}
            onAddRecurring={addRecurring}
            onRemoveRecurring={removeRecurring}
            onLogRecurring={logRecurringNow}
          />
        )}

        {tab === "charts" && (
          <ChartsView earningsData={earningsChartData} debtData={debtChartData} curMonth={curMonth} baseDaily={baseDaily} />
        )}

        {tab === "settings" && (
          <SettingsView
            settings={settings}
            setSettings={setSettings}
            onExport={exportJSON}
            onExportCsv={exportCSV}
            onImportClick={() => importInputRef.current?.click()}
            onReset={resetAll}
            onSignOut={cloudEnabled ? handleSignOut : null}
            accountEmail={session?.user?.email || null}
          />
        )}
      </div>

      <input
        ref={importInputRef}
        type="file"
        accept="application/json"
        style={{ display: "none" }}
        onChange={(e) => e.target.files[0] && importJSON(e.target.files[0])}
      />

      {/* Bottom nav */}
      <nav style={bottomNav}>
        <div style={{ maxWidth: 680, margin: "0 auto", display: "flex" }}>
          {TABS.map((t) => {
            const Icon = t.icon;
            const on = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)} style={navBtn(on)}>
                <Icon size={19} />
                <span style={{ fontSize: 10, fontFamily: FONT_BODY, fontWeight: on ? 600 : 500 }}>{t.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

/* ================================================================== */
/*  Components                                                          */
/* ================================================================== */

function LoginScreen({ onSignedIn }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fails, setFails] = useState(0);

  const locked = fails >= 5;

  const submit = async (e) => {
    e?.preventDefault?.();
    if (busy || locked) return;
    setError("");
    setBusy(true);
    try {
      const session = await signIn(email, password);
      setFails(0);
      onSignedIn(session);
    } catch (err) {
      setFails((n) => n + 1);
      setError(err.message || "Sign in failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ ...page, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, minHeight: "100vh" }}>
      <form
        onSubmit={submit}
        style={{
          width: "100%",
          maxWidth: 400,
          background: `linear-gradient(165deg, ${C.surface2} 0%, ${C.surface} 70%)`,
          border: `1px solid ${C.line}`,
          borderRadius: 18,
          padding: "28px 22px 22px",
          boxShadow: "0 24px 60px rgba(0,0,0,.45)",
          animation: "ddRise .4s ease both",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <div style={badgeIcon}><Car size={16} color={C.asphalt} /></div>
          <div>
            <div style={{ fontFamily: FONT_DISP, fontWeight: 700, fontSize: 20, letterSpacing: -0.4 }}>Debt Destroyer</div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 10.5, color: C.faint, letterSpacing: 1.1, marginTop: 2 }}>OWNER ACCESS</div>
          </div>
        </div>
        <div style={{ fontFamily: FONT_BODY, fontSize: 13.5, color: C.muted, lineHeight: 1.5, margin: "14px 0 18px" }}>
          Private owner login only. New account signup is turned off.
        </div>

        <Field label="Email">
          <input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="debtkiller.owner@gmail.com"
            style={input}
            disabled={busy || locked}
          />
        </Field>
        <div style={{ height: 10 }} />
        <Field label="Password">
          <div style={{ position: "relative" }}>
            <input
              type={showPw ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{ ...input, paddingRight: 72 }}
              disabled={busy || locked}
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              style={{
                position: "absolute",
                right: 8,
                top: 7,
                ...btnSm,
                padding: "6px 8px",
                fontSize: 10.5,
              }}
            >
              {showPw ? "Hide" : "Show"}
            </button>
          </div>
        </Field>

        {error && (
          <div
            style={{
              marginTop: 12,
              background: C.redDim,
              border: `1px solid ${C.red}`,
              borderRadius: 10,
              padding: "10px 12px",
              fontFamily: FONT_MONO,
              fontSize: 11.5,
              color: C.text,
            }}
          >
            {locked ? "Too many failed attempts. Refresh and try again later." : error}
          </div>
        )}

        <button
          type="submit"
          disabled={busy || locked}
          style={{
            ...btnPrimary,
            width: "100%",
            marginTop: 16,
            opacity: busy || locked ? 0.65 : 1,
          }}
        >
          <Shield size={15} /> {busy ? "Signing in…" : "Sign in"}
        </button>

        <div style={{ marginTop: 14, fontFamily: FONT_MONO, fontSize: 10, color: C.faint, lineHeight: 1.5, textAlign: "center" }}>
          Only debtkiller.owner@gmail.com can access this dashboard
        </div>
      </form>
    </div>
  );
}

function AlertsBanner({ alerts }) {
  return (
    <div style={{ marginBottom: 14 }}>
      {alerts.map((alert, idx) => {
        const { d, days, kind, message } = alert;
        const urgent = kind === "deadline" ? days <= 7 : kind === "buffer" ? false : days <= 2;
        const key = d?.id != null ? `${kind}-${d.id}` : `${kind}-${idx}`;
        const title =
          kind === "deadline"
            ? `${d.name} due ${days <= 0 ? "today" : `in ${days} day${days === 1 ? "" : "s"}`}`
            : kind === "min"
              ? message
              : message;
        const sub =
          kind === "deadline"
            ? `Pay in full · ${usd(d.balance)} · ${monthLabel(d.deadline)}`
            : kind === "min"
              ? `Due ${days <= 0 ? "today" : `in ${days} day${days === 1 ? "" : "s"}`}`
              : "Fund buffer before extra debt hits";
        return (
          <div
            key={key}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              background: urgent
                ? `linear-gradient(135deg, ${C.redDim} 0%, #2A1515 100%)`
                : `linear-gradient(135deg, ${C.amberDim} 0%, #2A2310 100%)`,
              border: `1px solid ${urgent ? C.red : C.amber}`,
              borderRadius: 14,
              padding: "13px 14px",
              marginBottom: 8,
              boxShadow: urgent ? "0 8px 24px rgba(255,107,107,.12)" : "0 8px 24px rgba(245,196,81,.08)",
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: urgent ? "rgba(255,107,107,.15)" : "rgba(245,196,81,.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {kind === "buffer" ? <Shield size={17} color={C.amber} /> : <AlertTriangle size={17} color={urgent ? C.red : C.amber} />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: FONT_DISP, fontWeight: 700, fontSize: 14, color: C.text }}>
                {title}
              </div>
              <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.muted, marginTop: 2 }}>
                {sub}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Hero({ remaining, originalTotal, pctPaid, debts, projectedFreeISO, planFreeISO, paceDelta }) {
  const total = originalTotal;
  const paidPortion = total - remaining;
  return (
    <section
      style={{
        ...card,
        padding: "16px 15px 14px",
        position: "relative",
        overflow: "hidden",
        background: `linear-gradient(165deg, ${C.surface2} 0%, ${C.surface} 70%)`,
      }}
    >
      <div style={{ fontFamily: FONT_MONO, fontSize: 10.5, letterSpacing: 1.5, color: C.faint }}>
        DISTANCE REMAINING
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 10, marginTop: 4 }}>
        <div style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 36, letterSpacing: -1.5, color: C.text, lineHeight: 0.95 }}>
          {usd0(remaining)}
        </div>
        <div style={{ marginBottom: 5 }}>
          <span style={{ fontFamily: FONT_DISP, fontWeight: 700, fontSize: 14, color: C.green }}>
            {pctPaid.toFixed(1)}%
          </span>
          <span style={{ fontFamily: FONT_MONO, fontSize: 10.5, color: C.faint, marginLeft: 5 }}>paid</span>
        </div>
      </div>

      <Road pct={pctPaid} />

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <div style={miniStat}>
          <div style={miniLabel}>PAID SO FAR</div>
          <div style={{ ...miniVal, color: C.green }}>{usd0(paidPortion)}</div>
        </div>
        <div style={miniStat}>
          <div style={miniLabel}>PROJECTED FREE</div>
          <div style={{ ...miniVal, color: C.text }}>
            {parseISO(projectedFreeISO).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </div>
        </div>
        <div style={miniStat}>
          <div style={miniLabel}>VS PLAN</div>
          <div
            style={{
              ...miniVal,
              color: paceDelta == null ? C.muted : paceDelta >= 0 ? C.green : C.red,
            }}
          >
            {paceDelta == null ? "—" : `${paceDelta >= 0 ? "+" : ""}${paceDelta}d`}
          </div>
        </div>
      </div>
    </section>
  );
}

function Road({ pct }) {
  const p = Math.max(0, Math.min(100, pct));
  return (
    <div style={{ position: "relative", height: 34, marginTop: 14 }}>
      {/* road bed */}
      <div
        style={{
          position: "absolute",
          top: 11,
          left: 0,
          right: 0,
          height: 12,
          background: C.surface2,
          borderRadius: 7,
          border: `1px solid ${C.line}`,
          overflow: "hidden",
        }}
      >
        {/* progress fill */}
        <div
          style={{
            height: "100%",
            width: `${p}%`,
            background: `linear-gradient(90deg, ${C.greenDim}, ${C.green})`,
            transition: "width .5s ease",
          }}
        />
        {/* dashed lane marking */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: 6,
            right: 6,
            height: 2,
            transform: "translateY(-50%)",
            backgroundImage: `repeating-linear-gradient(90deg, ${C.lane} 0 9px, transparent 9px 18px)`,
            backgroundSize: "36px 2px",
            opacity: 0.55,
            animation: "ddLane 1.1s linear infinite",
          }}
        />
      </div>
      {/* car marker */}
      <div
        style={{
          position: "absolute",
          top: 2,
          left: `calc(${p}% - 11px)`,
          transition: "left .5s ease",
        }}
      >
        <div style={badgeIconSm}><Car size={13} color={C.asphalt} /></div>
      </div>
      {/* finish flag */}
      <div style={{ position: "absolute", top: 4, right: -2 }}>
        <Flag size={15} color={p >= 99.5 ? C.green : C.faint} />
      </div>
    </div>
  );
}


function rankDebtsToKill(debts, todayISODate, method = "avalanche") {
  const active = debts.filter((d) => !d.paid && asMoney(d.balance) > 0.005);
  return active
    .map((d) => {
      const reasons = [];
      let score = 0;
      const bal = asMoney(d.balance);
      const apr = debtApr(d);
      const drag = monthlyInterestOf(d);

      if (d.deadline) {
        const days = daysBetween(todayISODate, d.deadline);
        if (days <= 0) {
          score += 10000;
          reasons.push("Due today — pay first");
        } else if (days <= 7) {
          score += 8000 - days * 40;
          reasons.push(`Hard deadline in ${days} day${days === 1 ? "" : "s"}`);
        } else if (days <= 21) {
          score += 2000 - days * 10;
          reasons.push(`Deadline in ${days} days`);
        }
      }

      if (method === "snowball") {
        // Smaller balances first (invert balance into score)
        score += Math.max(0, 5000 - bal);
        reasons.push(bal <= 400 ? "Smallest balance — snowball win" : "Snowball: knock out smaller balances");
      } else {
        // Avalanche: highest APR / monthly drag first
        score += apr * 80 + drag * 12;
        if (apr > 0) reasons.push(`${apr.toFixed(apr % 1 ? 2 : 0)}% APR · ~${usd0(drag)}/mo interest`);
        else reasons.push("No interest — lower avalanche priority");
      }

      if (d.group === "card" && method === "avalanche") {
        score += 40;
      }
      if (!reasons.length) reasons.push("Next in payoff queue");
      return { d, score, reasons: reasons.slice(0, 2), apr, drag };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (method === "snowball") return a.d.balance - b.d.balance;
      return debtApr(b.d) - debtApr(a.d) || a.d.balance - b.d.balance;
    });
}

function InterestDragCard({ debts }) {
  const active = debts.filter((d) => !d.paid && asMoney(d.balance) > 0.005);
  const rows = active
    .map((d) => ({ d, drag: monthlyInterestOf(d), apr: debtApr(d) }))
    .filter((r) => r.drag > 0.05)
    .sort((a, b) => b.drag - a.drag);
  const total = rows.reduce((s, r) => s + r.drag, 0);
  if (!rows.length) return null;
  return (
    <section style={{ ...card, borderColor: C.amberDim }}>
      <div style={rowBetween}>
        <SectionLabel icon={Flame}>INTEREST DRAG</SectionLabel>
        <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: C.amber }}>THIS MONTH</span>
      </div>
      <div style={{ fontFamily: FONT_DISP, fontWeight: 700, fontSize: 26, color: C.amber, letterSpacing: -0.8, marginTop: 8 }}>
        ~{usd0(total)}
      </div>
      <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.muted, marginTop: 2 }}>
        Rough interest leaking every month if balances stay put
      </div>
      <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 7 }}>
        {rows.slice(0, 4).map(({ d, drag, apr }) => (
          <div key={d.id} style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
            <span style={{ fontFamily: FONT_DISP, fontSize: 12.5, color: C.text }}>
              {d.name}
              <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: C.faint, marginLeft: 6 }}>{apr}% APR</span>
            </span>
            <span style={{ fontFamily: FONT_MONO, fontSize: 12, color: C.amber }}>~{usd(drag)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function PaymentScheduleCard({
  debts,
  today,
  method,
  leftoverForExtraDebt,
  buffer,
  bufferGoal,
  available,
  onMarkPaid,
}) {
  const ranked = rankDebtsToKill(debts, today, method);
  const next = ranked[0]?.d || null;
  const bufferGap = Math.max(0, asMoney(bufferGoal) - asMoney(buffer));
  const safeToPay = Math.max(0, available - bufferGap);
  let amount = 0;
  let dueISO = today;
  if (next) {
    amount = Math.min(
      asMoney(next.balance),
      Math.max(
        asMoney(next.min) || 0,
        Math.max(safeToPay, leftoverForExtraDebt || 0, 50)
      )
    );
    if (amount < 1) amount = Math.min(asMoney(next.balance), asMoney(next.min) || Math.min(100, asMoney(next.balance)));
    dueISO = nextFridayISO(today);
    if (next.deadline) {
      const days = daysBetween(today, next.deadline);
      if (days >= 0 && days <= 7) dueISO = next.deadline;
    }
  }
  const alreadyPaidToward = !!(
    next &&
    (next.payments || []).some((p) => p.date >= today && p.date <= dueISO && asMoney(p.amount) >= amount * 0.9)
  );
  const [done, setDone] = useState(alreadyPaidToward);
  useEffect(() => {
    setDone(alreadyPaidToward);
  }, [alreadyPaidToward, next?.id, dueISO, amount]);

  if (!next) return null;

  const dueLabel = dueISO === today ? "today" : `by ${weekdayLong(dueISO)}`;

  if (done) {
    return (
      <section style={{ ...card, borderColor: C.greenDim }}>
        <SectionLabel icon={CalendarCheck}>PAYMENT SCHEDULE</SectionLabel>
        <div style={{ marginTop: 10, fontFamily: FONT_DISP, fontWeight: 600, fontSize: 15, color: C.green }}>
          Marked paid — nice hit on {next.name}
        </div>
        <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.muted, marginTop: 4 }}>
          Next target refreshes after balances update.
        </div>
      </section>
    );
  }

  return (
    <section
      style={{
        ...card,
        borderColor: C.lane,
        background: `radial-gradient(120% 90% at 0% 0%, rgba(255,229,102,.12) 0%, ${C.surface} 55%)`,
      }}
    >
      <SectionLabel icon={CalendarCheck}>PAYMENT SCHEDULE</SectionLabel>
      <div style={{ marginTop: 10, fontFamily: FONT_DISP, fontWeight: 700, fontSize: 17, color: C.text, letterSpacing: -0.3, lineHeight: 1.35 }}>
        Pay {usd0(amount)} on {next.name} {dueLabel}
      </div>
      <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.muted, marginTop: 6, lineHeight: 1.45 }}>
        {method === "snowball" ? "Snowball pick" : "Avalanche pick"}
        {debtApr(next) > 0 ? ` · ${debtApr(next)}% APR` : ""} · {usd(next.balance)} left
      </div>
      <button
        type="button"
        onClick={() => {
          onMarkPaid(next.id, amount);
          setDone(true);
        }}
        style={{ ...btnPrimary, width: "100%", marginTop: 14 }}
      >
        <Check size={15} /> Mark paid
      </button>
    </section>
  );
}

function WeeklyReviewCard({ today, earnings, baseDaily, adjustedDaily, planMonth, incomeOf }) {
  const { start, end, isSunday } = weekWindow(today);
  const days = [];
  for (let i = 0; i < 7; i++) {
    const date = addDaysISO(start, i);
    if (date > today) break;
    const earned = earnings.filter((e) => e.date === date).reduce((s, e) => s + incomeOf(e), 0);
    const target = baseDaily || 0;
    days.push({ date, earned, target, slipped: target > 0 && earned + 0.5 < target });
  }
  const weekEarned = days.reduce((s, d) => s + d.earned, 0);
  const weekTarget = days.reduce((s, d) => s + d.target, 0);
  const slipped = days.filter((d) => d.slipped);
  const nextWeekDaily = planMonth ? adjustedDaily : baseDaily;
  if (!planMonth && weekEarned <= 0) return null;

  return (
    <section
      style={{
        ...card,
        borderColor: isSunday ? C.blue : C.line,
        background: isSunday
          ? `linear-gradient(145deg, ${C.surface2}, ${C.surface})`
          : C.surface,
      }}
    >
      <div style={rowBetween}>
        <SectionLabel icon={BarChart3}>{isSunday ? "SUNDAY REVIEW" : "WEEKLY PACE"}</SectionLabel>
        <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: C.faint }}>
          {weekdayShort(start)}–{weekdayShort(end)}
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
        <div>
          <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: C.faint }}>EARNED</div>
          <div style={{ fontFamily: FONT_DISP, fontWeight: 700, fontSize: 20, color: weekEarned >= weekTarget ? C.green : C.text }}>
            {usd0(weekEarned)}
          </div>
        </div>
        <div>
          <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: C.faint }}>TARGET</div>
          <div style={{ fontFamily: FONT_DISP, fontWeight: 700, fontSize: 20, color: C.muted }}>
            {usd0(weekTarget)}
          </div>
        </div>
      </div>
      <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.muted, marginTop: 10, lineHeight: 1.5 }}>
        {slipped.length === 0
          ? "No slipped days this week — keep the streak."
          : `Slipped ${slipped.length} day${slipped.length === 1 ? "" : "s"}: ${slipped.map((d) => weekdayShort(d.date)).join(", ")}.`}
      </div>
      <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${C.lineSoft}` }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: C.faint, letterSpacing: 1 }}>NEXT WEEK'S NUMBER</div>
        <div style={{ fontFamily: FONT_DISP, fontWeight: 700, fontSize: 18, color: C.lane, marginTop: 4 }}>
          {usd0(nextWeekDaily)}
          <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.muted, fontWeight: 500 }}> / day</span>
        </div>
      </div>
    </section>
  );
}

function SmartPayoffCard({ debts, today, available, buffer, bufferGoal, leftoverForExtraDebt, method, onMethodChange }) {
  const ranked = rankDebtsToKill(debts, today, method);
  if (!ranked.length) return null;
  const top = ranked[0];
  const next = top.d;
  const bufferGap = Math.max(0, asMoney(bufferGoal) - asMoney(buffer));
  const safeToPay = Math.max(0, available - bufferGap);
  const suggested = Math.min(asMoney(next.balance), Math.max(safeToPay, leftoverForExtraDebt || 0));
  const runners = ranked.slice(1, 3);
  const monthlyExtra = Math.max(suggested, leftoverForExtraDebt || 0, 200);
  const avalanche = simulatePayoff(debts, "avalanche", monthlyExtra);
  const snowball = simulatePayoff(debts, "snowball", monthlyExtra);
  const interestSaved = Math.max(0, snowball.interest - avalanche.interest);
  const activeMethod = method === "snowball" ? snowball : avalanche;
  const otherMethod = method === "snowball" ? avalanche : snowball;
  const vsOther = otherMethod.interest - activeMethod.interest;

  return (
    <section style={{ ...card, borderColor: C.blue, background: `linear-gradient(145deg, ${C.surface}, ${C.surface2})` }}>
      <div style={rowBetween}>
        <SectionLabel icon={Lightbulb}>KILL THIS FIRST</SectionLabel>
        <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: C.blue }}>
          {method === "snowball" ? "SNOWBALL" : "AVALANCHE"}
        </span>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <TogglePill on={method === "avalanche"} onClick={() => onMethodChange("avalanche")}>Avalanche</TogglePill>
        <TogglePill on={method === "snowball"} onClick={() => onMethodChange("snowball")}>Snowball</TogglePill>
      </div>
      <div style={{ marginTop: 12, fontFamily: FONT_DISP, fontWeight: 700, fontSize: 17, color: C.text }}>
        {next.name}
      </div>
      <div style={{ fontFamily: FONT_MONO, fontSize: 12, color: C.lane, marginTop: 3 }}>
        {usd(next.balance)} left
        {debtApr(next) > 0 ? ` · ${debtApr(next)}% APR · ~${usd0(monthlyInterestOf(next))}/mo` : ""}
      </div>
      <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 5 }}>
        {top.reasons.map((r) => (
          <div key={r} style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.muted, lineHeight: 1.4 }}>
            → {r}
          </div>
        ))}
      </div>
      <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.text, lineHeight: 1.55, marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.lineSoft}` }}>
        {bufferGap > 0
          ? `First fund ${usd0(bufferGap)} into your car buffer, then attack this debt.`
          : suggested > 0
            ? `Safe strike amount now: about ${usd0(suggested)} after tax, expenses, and buffer.`
            : "Log more income (or cut spend) to unlock a safe payment amount."}
      </div>
      <div style={{ marginTop: 10, padding: "10px 11px", borderRadius: 10, background: C.asphalt, border: `1px solid ${C.lineSoft}` }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: C.faint, letterSpacing: 1 }}>INTEREST SAVED</div>
        <div style={{ fontFamily: FONT_DISP, fontWeight: 700, fontSize: 15, color: interestSaved > 1 ? C.green : C.muted, marginTop: 4 }}>
          Avalanche saves ~{usd0(interestSaved)} vs snowball
        </div>
        <div style={{ fontFamily: FONT_MONO, fontSize: 10.5, color: C.faint, marginTop: 4, lineHeight: 1.4 }}>
          Rough sim at ~{usd0(monthlyExtra)}/mo extra
          {vsOther > 1 && method === "snowball"
            ? ` · switching to avalanche cuts ~${usd0(vsOther)} interest`
            : method === "avalanche" && interestSaved > 1
              ? " · highest-APR first bleeds less over time"
              : ""}
        </div>
      </div>
      {runners.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: 10, letterSpacing: 1, color: C.faint, marginBottom: 6 }}>NEXT UP</div>
          {runners.map(({ d, reasons }) => (
            <div key={d.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 4 }}>
              <span style={{ fontFamily: FONT_DISP, fontSize: 12.5, color: C.muted }}>{d.name}</span>
              <span style={{ fontFamily: FONT_MONO, fontSize: 10.5, color: C.faint, textAlign: "right" }}>{reasons[0]}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function NetProjectionCard({
  projectedGross,
  projectedTax,
  projectedSpend,
  debtPaidThisMonth,
  monthlyMins,
  projectedAfterLoans,
  leftoverForExtraDebt,
}) {
  return (
    <section style={card}>
      <SectionLabel icon={Target}>MONTH-END PROJECTION</SectionLabel>
      <div style={{ fontFamily: FONT_DISP, fontWeight: 700, fontSize: 15, color: C.text, marginTop: 8 }}>
        Leftover after expenses & loans
      </div>
      <div style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 28, color: C.green, letterSpacing: -1, marginTop: 4 }}>
        {usd0(leftoverForExtraDebt)}
      </div>
      <div style={{ fontFamily: FONT_MONO, fontSize: 10.5, color: C.faint, marginTop: 3 }}>
        Available to kill extra debt (after tax, spend, mins, buffer)
      </div>
      <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
        <ProjRow label="Projected gross" value={usd0(projectedGross)} />
        <ProjRow label="Tax set-aside" value={`−${usd0(projectedTax)}`} tone={C.amber} />
        <ProjRow label="Projected expenses" value={`−${usd0(projectedSpend)}`} tone={C.amber} />
        <ProjRow label="Loan mins (active)" value={`−${usd0(monthlyMins)}`} tone={C.amber} />
        <ProjRow label="Already paid to debts" value={`−${usd0(debtPaidThisMonth)}`} tone={C.muted} />
        <div style={{ height: 1, background: C.lineSoft, margin: "4px 0" }} />
        <ProjRow label="After expenses & mins" value={usd0(projectedAfterLoans)} tone={C.green} bold />
      </div>
    </section>
  );
}

function ProjRow({ label, value, tone = C.text, bold }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
      <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.muted }}>{label}</span>
      <span style={{ fontFamily: FONT_MONO, fontSize: 11.5, color: tone, fontWeight: bold ? 700 : 500 }}>{value}</span>
    </div>
  );
}

function DailyTargetCard({
  planMonth,
  earnedToday,
  baseDaily,
  adjustedDaily,
  dailyGasBudget = 0,
  runningSurplus,
  daysRemaining,
  pastShortfall,
  dailyCatchUpBump,
}) {
  if (!planMonth) {
    return (
      <section style={card}>
        <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.muted }}>
          No plan target for this month — you're outside the payoff window. Keep logging; the debt list is still live.
        </div>
      </section>
    );
  }
  const gas = asMoney(dailyGasBudget);
  const debtAim = adjustedDaily || 0;
  const totalAim = debtAim + gas;
  const hit = earnedToday >= totalAim && totalAim > 0;
  const ahead = runningSurplus >= 0;
  const pct = totalAim > 0 ? Math.min(100, (earnedToday / totalAim) * 100) : 0;
  const remaining = Math.max(0, totalAim - earnedToday);
  const redistributing = pastShortfall > 0.5;
  return (
    <section
      style={{
        ...card,
        padding: "18px 16px 16px",
        borderColor: hit ? C.green : C.lane,
        background: hit
          ? `radial-gradient(120% 90% at 100% 0%, ${C.greenDim} 0%, ${C.surface} 55%)`
          : `radial-gradient(120% 90% at 100% 0%, rgba(255,229,102,.14) 0%, ${C.surface} 55%)`,
        boxShadow: hit
          ? "0 12px 36px rgba(61,220,151,.12)"
          : "0 12px 36px rgba(255,229,102,.10)",
        animation: "ddRise .45s ease both",
      }}
    >
      <div style={rowBetween}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: hit ? C.green : C.lane,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Gauge size={14} color={C.asphalt} />
          </div>
          <div>
            <div style={{ fontFamily: FONT_DISP, fontWeight: 700, fontSize: 15, color: C.text, letterSpacing: -0.2 }}>
              Today's target
            </div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: C.faint, marginTop: 1 }}>
              {daysRemaining} days left · debt base {usd0(baseDaily)}
            </div>
          </div>
        </div>
        <div
          style={{
            fontFamily: FONT_MONO,
            fontWeight: 700,
            fontSize: 10,
            letterSpacing: 0.6,
            color: hit ? C.green : ahead ? C.lane : C.red,
            background: hit ? C.greenDim : ahead ? C.amberDim : C.redDim,
            border: `1px solid ${hit ? C.green : ahead ? C.lane : C.red}`,
            borderRadius: 999,
            padding: "5px 9px",
          }}
        >
          {hit ? "HIT" : ahead ? "ON PACE" : "CATCH UP"}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, marginTop: 14 }}>
        <div>
          <div style={{ fontFamily: FONT_MONO, fontSize: 10, letterSpacing: 1.2, color: C.faint }}>TOTAL TO EARN</div>
          <div
            style={{
              fontFamily: FONT_MONO,
              fontWeight: 700,
              fontSize: 42,
              letterSpacing: -1.8,
              color: hit ? C.green : C.text,
              lineHeight: 0.95,
              marginTop: 4,
            }}
          >
            {usd0(totalAim)}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: 10, letterSpacing: 1.2, color: C.faint }}>EARNED</div>
          <div
            style={{
              fontFamily: FONT_MONO,
              fontWeight: 700,
              fontSize: 26,
              letterSpacing: -1,
              color: hit ? C.green : C.lane,
              marginTop: 4,
            }}
          >
            {usd0(earnedToday)}
          </div>
          <div style={{ fontFamily: FONT_MONO, fontSize: 10.5, color: C.muted, marginTop: 3 }}>
            {hit ? "Target cleared" : `${usd0(remaining)} to go`}
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: 14,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 8,
          padding: "10px 11px",
          borderRadius: 10,
          background: C.asphalt,
          border: `1px solid ${C.lineSoft}`,
        }}
      >
        <div>
          <div style={{ fontFamily: FONT_MONO, fontSize: 9.5, letterSpacing: 1, color: C.faint }}>DEBT TARGET</div>
          <div style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 16, color: C.text, marginTop: 3 }}>{usd0(debtAim)}</div>
        </div>
        <div>
          <div style={{ fontFamily: FONT_MONO, fontSize: 9.5, letterSpacing: 1, color: C.amber }}>GAS MONEY</div>
          <div style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 16, color: C.amber, marginTop: 3 }}>{usd0(gas)}</div>
        </div>
      </div>
      <div style={{ fontFamily: FONT_MONO, fontSize: 10.5, color: C.muted, marginTop: 8, lineHeight: 1.45 }}>
        {usd0(debtAim)} debt + {usd0(gas)} gas = {usd0(totalAim)} total. Change gas in Settings anytime.
      </div>

      {redistributing && (
        <div
          style={{
            marginTop: 12,
            background: C.amberDim,
            border: `1px solid ${C.amber}`,
            borderRadius: 10,
            padding: "9px 11px",
            fontFamily: FONT_MONO,
            fontSize: 11,
            color: C.text,
            lineHeight: 1.45,
          }}
        >
          Missed earlier days · +{usd0(dailyCatchUpBump)}/day catch-up built into debt target
        </div>
      )}

      <div style={{ ...progTrack, height: 8, marginTop: 14 }}>
        <div style={{ ...progFill, width: `${pct}%`, background: hit ? C.green : C.lane }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 7 }}>
        <span style={{ fontFamily: FONT_MONO, fontSize: 10.5, color: C.faint }}>{pct.toFixed(0)}% of today</span>
        <span style={{ fontFamily: FONT_MONO, fontSize: 10.5, color: ahead ? C.green : C.red }}>
          {ahead ? "▲" : "▼"} {usd0(Math.abs(runningSurplus))} month pace
        </span>
      </div>
    </section>
  );
}

function MonthlyDashboard({ curMonth, monthTarget, earnedThisMonth, projectedMonthEnd, daysRemaining, spentThisMonth, baseline, hasPlan }) {
  const pct = monthTarget > 0 ? Math.min(100, (earnedThisMonth / monthTarget) * 100) : 0;
  const projPct = monthTarget > 0 ? Math.min(120, (projectedMonthEnd / monthTarget) * 100) : 0;
  const overBudget = spentThisMonth > baseline;
  return (
    <section style={card}>
      <div style={rowBetween}>
        <SectionLabel icon={Target}>{monthLabel(curMonth + "-01").toUpperCase()}</SectionLabel>
        <span style={{ fontFamily: FONT_MONO, fontSize: 10.5, color: C.faint }}>{daysRemaining} days left</span>
      </div>

      {hasPlan ? (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, marginBottom: 6 }}>
            <span style={{ fontFamily: FONT_MONO, fontSize: 13, color: C.text, fontWeight: 700 }}>{usd0(earnedThisMonth)}</span>
            <span style={{ fontFamily: FONT_MONO, fontSize: 12, color: C.muted }}>target {usd0(monthTarget)}</span>
          </div>
          <div style={progTrack}>
            <div style={{ ...progFill, width: `${pct}%`, background: C.green }} />
            {projPct > pct && (
              <div
                style={{
                  position: "absolute",
                  left: `${Math.min(100, projPct)}%`,
                  top: -3,
                  bottom: -3,
                  width: 2,
                  background: C.lane,
                }}
                title="projected month-end"
              />
            )}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
            <span style={{ fontFamily: FONT_MONO, fontSize: 10.5, color: C.faint }}>{pct.toFixed(0)}% of target</span>
            <span style={{ fontFamily: FONT_MONO, fontSize: 10.5, color: C.lane }}>
              projected {usd0(projectedMonthEnd)}
            </span>
          </div>
        </>
      ) : (
        <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.muted, marginTop: 8 }}>
          Earned this month: {usd0(earnedThisMonth)}
        </div>
      )}

      <div style={{ height: 1, background: C.lineSoft, margin: "13px 0 11px" }} />
      <div style={rowBetween}>
        <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.muted }}>Spending vs {usd0(baseline)} budget</span>
        <span style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 700, color: overBudget ? C.red : C.green }}>
          {usd0(spentThisMonth)}
        </span>
      </div>
    </section>
  );
}

function EveningNudge({ shortfall, onDismiss, onEnablePush }) {
  return (
    <section
      style={{
        ...card,
        borderColor: C.amber,
        background: `linear-gradient(135deg, ${C.amberDim}, ${C.surface})`,
        marginBottom: 12,
      }}
    >
      <div style={rowBetween}>
        <SectionLabel icon={Bell}>EVENING NUDGE</SectionLabel>
        <button type="button" onClick={onDismiss} style={{ ...btnSm, padding: 6 }} aria-label="Dismiss"><X size={13} /></button>
      </div>
      <div style={{ fontFamily: FONT_DISP, fontWeight: 700, fontSize: 16, color: C.text, marginTop: 8 }}>
        Still {usd0(shortfall)} short today
      </div>
      <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.muted, marginTop: 4, lineHeight: 1.45 }}>
        One more short shift keeps the streak alive.
      </div>
      {typeof Notification !== "undefined" && Notification.permission === "default" && (
        <button type="button" onClick={onEnablePush} style={{ ...btnGhost, marginTop: 10, width: "100%" }}>
          Enable reminders
        </button>
      )}
    </section>
  );
}

function CountdownCard({ days, weeks, freeISO, remaining, pctPaid }) {
  return (
    <section
      style={{
        ...card,
        borderColor: C.greenDim,
        background: `radial-gradient(120% 100% at 100% 0%, ${C.greenDim} 0%, ${C.surface} 55%)`,
        boxShadow: "0 14px 40px rgba(61,220,151,.10)",
      }}
    >
      <SectionLabel icon={CalendarDays}>DEBT-FREE COUNTDOWN</SectionLabel>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
        <div style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 40, letterSpacing: -1.5, color: C.green, lineHeight: 1 }}>
          {days}
        </div>
        <div>
          <div style={{ fontFamily: FONT_DISP, fontWeight: 700, fontSize: 16, color: C.text }}>days left</div>
          <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.muted, marginTop: 2 }}>
            ~{weeks} weeks · {parseISO(freeISO).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </div>
        </div>
      </div>
      <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.faint, marginTop: 10 }}>
        {usd0(remaining)} remaining · {pctPaid.toFixed(1)}% already killed
      </div>
    </section>
  );
}

function StreakCard({ streak, target }) {
  return (
    <div style={{ ...card, marginBottom: 0, borderColor: streak > 0 ? C.greenDim : C.line }}>
      <SectionLabel icon={Flame}>STREAK</SectionLabel>
      <div style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 28, color: streak > 0 ? C.green : C.muted, marginTop: 6 }}>
        {streak}
        <span style={{ fontSize: 12, color: C.faint, fontWeight: 500 }}> days</span>
      </div>
      <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: C.faint, marginTop: 4, lineHeight: 1.4 }}>
        Hitting {usd0(target)}/day
      </div>
    </div>
  );
}

function GasNetCard({ earnedToday, gasToday, gasMonth, net }) {
  return (
    <div style={{ ...card, marginBottom: 0 }}>
      <SectionLabel icon={Fuel}>AFTER FUEL</SectionLabel>
      <div style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 22, color: net >= 0 ? C.text : C.red, marginTop: 6 }}>
        {usd0(net)}
      </div>
      <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: C.faint, marginTop: 4, lineHeight: 1.4 }}>
        Today {usd0(earnedToday)} − gas {usd0(gasToday)}
      </div>
      <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: C.amber, marginTop: 6 }}>
        Gas this month {usd0(gasMonth)}
      </div>
    </div>
  );
}

function ShiftStatsCard({ effectiveHourly, hoursThisMonth, earnedThisMonth, bestDays }) {
  return (
    <section style={card}>
      <SectionLabel icon={Timer}>SHIFT STATS</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 12 }}>
        <div style={miniStat}>
          <div style={miniLabel}>$/HR</div>
          <div style={{ ...miniVal, color: C.lane }}>{effectiveHourly != null ? usd0(effectiveHourly) : "—"}</div>
        </div>
        <div style={miniStat}>
          <div style={miniLabel}>HOURS</div>
          <div style={miniVal}>{hoursThisMonth ? hoursThisMonth.toFixed(1) : "—"}</div>
        </div>
        <div style={miniStat}>
          <div style={miniLabel}>GROSS</div>
          <div style={{ ...miniVal, color: C.green }}>{usd0(earnedThisMonth)}</div>
        </div>
      </div>
      {bestDays.length > 0 && (
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${C.lineSoft}` }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: C.faint, letterSpacing: 1, marginBottom: 6 }}>BEST DAYS</div>
          {bestDays.slice(0, 3).map((d, i) => (
            <div key={d.name} style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
              <span style={{ fontFamily: FONT_DISP, fontSize: 13, color: i === 0 ? C.lane : C.muted }}>
                {i === 0 ? "★ " : ""}{d.name}
              </span>
              <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.text }}>
                ~{usd0(d.avg)} · {d.count}d
              </span>
            </div>
          ))}
        </div>
      )}
      {!bestDays.length && (
        <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.faint, marginTop: 10 }}>
          Log shifts with hours to unlock $/hr and best days.
        </div>
      )}
    </section>
  );
}

function PaymentHistoryCard({ rows }) {
  const recent = (rows || []).slice(0, 8);
  if (!recent.length) return null;
  return (
    <section style={card}>
      <SectionLabel icon={ClipboardList}>PAYMENT HISTORY</SectionLabel>
      <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 7 }}>
        {recent.map((r) => (
          <div key={r.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: FONT_DISP, fontWeight: 600, fontSize: 13, color: C.text }}>{r.debtName}</div>
              <div style={{ fontFamily: FONT_MONO, fontSize: 10.5, color: C.faint }}>
                {r.date}{r.note ? ` · ${r.note}` : ""}
              </div>
            </div>
            <div style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 13, color: C.green }}>−{usd0(r.amount)}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function GasBudgetCard({ gasWeek, weekBudget, gasMonth, monthBudget, dailyBudget }) {
  const weekPct = weekBudget > 0 ? Math.min(140, (gasWeek / weekBudget) * 100) : 0;
  const monthPct = monthBudget > 0 ? Math.min(140, (gasMonth / monthBudget) * 100) : 0;
  const weekOver = gasWeek > weekBudget + 0.5;
  const monthOver = gasMonth > monthBudget + 0.5;
  return (
    <section style={card}>
      <SectionLabel icon={Fuel}>GAS VS BUDGET</SectionLabel>
      <div style={{ fontFamily: FONT_MONO, fontSize: 10.5, color: C.faint, marginTop: 6 }}>
        {usd0(dailyBudget)}/day planned
      </div>
      <div style={{ marginTop: 12 }}>
        <div style={rowBetween}>
          <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.muted }}>This week</span>
          <span style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 700, color: weekOver ? C.red : C.text }}>
            {usd0(gasWeek)} / {usd0(weekBudget)}
          </span>
        </div>
        <div style={{ ...progTrack, height: 7, marginTop: 6 }}>
          <div style={{ ...progFill, width: `${Math.min(100, weekPct)}%`, background: weekOver ? C.red : C.amber }} />
        </div>
      </div>
      <div style={{ marginTop: 12 }}>
        <div style={rowBetween}>
          <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.muted }}>This month</span>
          <span style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 700, color: monthOver ? C.red : C.text }}>
            {usd0(gasMonth)} / {usd0(monthBudget)}
          </span>
        </div>
        <div style={{ ...progTrack, height: 7, marginTop: 6 }}>
          <div style={{ ...progFill, width: `${Math.min(100, monthPct)}%`, background: monthOver ? C.red : C.lane }} />
        </div>
      </div>
    </section>
  );
}

function WhatIfCard({ extra, setExtra, whatIfDate, remaining, baselineDaily, customDaily, onApply, onClear }) {
  return (
    <section style={{ ...card, borderColor: C.blue }}>
      <SectionLabel icon={Zap}>WHAT IF</SectionLabel>
      <div style={{ fontFamily: FONT_DISP, fontWeight: 700, fontSize: 16, color: C.text, marginTop: 8 }}>
        +{usd0(extra)} more per day
      </div>
      <input
        type="range"
        min={0}
        max={150}
        step={5}
        value={extra}
        onChange={(e) => setExtra(Number(e.target.value))}
        style={{ width: "100%", marginTop: 12, accentColor: C.lane }}
      />
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: FONT_MONO, fontSize: 10, color: C.faint }}>
        <span>$0</span><span>$150</span>
      </div>
      <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 10, background: C.asphalt, border: `1px solid ${C.lineSoft}` }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: C.faint }}>DEBT-FREE BY</div>
        <div style={{ fontFamily: FONT_DISP, fontWeight: 700, fontSize: 18, color: C.green, marginTop: 4 }}>
          {whatIfDate
            ? parseISO(whatIfDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
            : "Need more daily net"}
        </div>
        <div style={{ fontFamily: FONT_MONO, fontSize: 10.5, color: C.muted, marginTop: 4 }}>
          On ~{usd0(baselineDaily + extra)}/day gross vs {usd0(remaining)} left
        </div>
      </div>
      <button type="button" onClick={onApply} style={{ ...btnPrimary, width: "100%", marginTop: 12 }}>
        Use as my daily target ({usd0(Math.round(baselineDaily + extra))})
      </button>
      {customDaily != null && (
        <button type="button" onClick={onClear} style={{ ...btnGhost, width: "100%", marginTop: 8 }}>
          Clear override ({usd0(customDaily)}/day)
        </button>
      )}
    </section>
  );
}

function MonthReportCard({ onShareImage, onSharePdf, curMonth, earned, spent, debtPaid, taxWallet, monthTarget, plan }) {
  const [busy, setBusy] = useState(null);
  const run = async (kind, fn) => {
    if (busy) return;
    setBusy(kind);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };
  return (
    <section style={card}>
      <div style={rowBetween}>
        <SectionLabel icon={Share2}>MONTH CLOSE-OUT</SectionLabel>
        <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: C.faint }}>{monthLabel(curMonth + "-01")}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
        <div style={miniStat}>
          <div style={miniLabel}>EARNED</div>
          <div style={{ ...miniVal, color: C.green }}>{usd0(earned)}</div>
        </div>
        <div style={miniStat}>
          <div style={miniLabel}>PLAN {plan} TARGET</div>
          <div style={miniVal}>{usd0(monthTarget || 0)}</div>
        </div>
        <div style={miniStat}>
          <div style={miniLabel}>SPENT</div>
          <div style={{ ...miniVal, color: C.amber }}>{usd0(spent)}</div>
        </div>
        <div style={miniStat}>
          <div style={miniLabel}>DEBT PAID</div>
          <div style={miniVal}>{usd0(debtPaid || 0)}</div>
        </div>
      </div>
      <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.muted, marginTop: 10, lineHeight: 1.5 }}>
        Tax wallet {usd0(taxWallet || 0)}. Share just this card as an image, or a full PDF with every earning and expense listed.
      </div>
      <div style={{ display: "flex", gap: 9, marginTop: 12 }}>
        <button
          type="button"
          disabled={!!busy}
          onClick={() => run("image", onShareImage)}
          style={{ ...btnPrimary, flex: 1, opacity: busy && busy !== "image" ? 0.55 : 1 }}
        >
          <Image size={15} /> {busy === "image" ? "Sharing…" : "Share image"}
        </button>
        <button
          type="button"
          disabled={!!busy}
          onClick={() => run("pdf", onSharePdf)}
          style={{ ...btnGhost, flex: 1, opacity: busy && busy !== "pdf" ? 0.55 : 1 }}
        >
          <FileText size={15} /> {busy === "pdf" ? "Building…" : "Share PDF"}
        </button>
      </div>
    </section>
  );
}

function TaxWalletCard({ wallet, expected, rate, onWithdraw, onSyncExpected }) {
  const [open, setOpen] = useState(false);
  const [amt, setAmt] = useState("");
  const mismatch = Math.abs(asMoney(wallet) - asMoney(expected)) > 0.5;
  return (
    <div style={{ ...card, marginBottom: 0, borderColor: mismatch ? C.amber : C.amberDim }}>
      <SectionLabel icon={Receipt}>TAX WALLET</SectionLabel>
      <div style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 22, color: C.amber, marginTop: 6 }}>
        {usd0(wallet)}
      </div>
      <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: C.faint, marginTop: 3, lineHeight: 1.4 }}>
        Don't touch · {(rate * 100).toFixed(0)}% auto-parked
      </div>
      <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: C.muted, marginTop: 6 }}>
        Expected set-aside {usd0(expected)}
      </div>
      {mismatch && (
        <button type="button" onClick={onSyncExpected} style={{ ...btnSm, marginTop: 8, width: "100%", borderColor: C.amber, color: C.amber }}>
          Match expected
        </button>
      )}
      {open ? (
        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
          <input value={amt} onChange={(e) => setAmt(e.target.value)} placeholder="$ paid IRS" inputMode="decimal" style={{ ...input, padding: "6px 8px", fontSize: 12 }} />
          <button type="button" onClick={() => { onWithdraw(amt); setAmt(""); setOpen(false); }} style={{ ...btnSm, background: C.amber, color: C.asphalt, borderColor: C.amber }}><Check size={13} /></button>
          <button type="button" onClick={() => setOpen(false)} style={btnSm}><X size={13} /></button>
        </div>
      ) : (
        <button type="button" onClick={() => setOpen(true)} style={{ ...btnSm, marginTop: 8 }}>Paid tax</button>
      )}
    </div>
  );
}

function BufferCard({ buffer, goal, onFund }) {
  const [open, setOpen] = useState(false);
  const [amt, setAmt] = useState("");
  const pct = goal > 0 ? Math.min(100, (buffer / goal) * 100) : 100;
  const full = buffer >= goal;
  return (
    <div style={{ ...card, marginBottom: 0 }}>
      <SectionLabel icon={Shield}>CAR BUFFER</SectionLabel>
      <div style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 22, color: full ? C.green : C.text, marginTop: 6 }}>
        {usd0(buffer)}
        <span style={{ fontSize: 11, color: C.faint, fontWeight: 400 }}> / {usd0(goal)}</span>
      </div>
      <div style={{ ...progTrack, height: 6, marginTop: 8 }}>
        <div style={{ ...progFill, width: `${pct}%`, background: full ? C.green : C.blue }} />
      </div>
      {!full && (
        <div style={{ fontFamily: FONT_MONO, fontSize: 9.5, color: C.faint, marginTop: 6 }}>
          Fund this before extra debt payments
        </div>
      )}
      {open ? (
        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
          <input
            value={amt}
            onChange={(e) => setAmt(e.target.value)}
            placeholder="$"
            inputMode="decimal"
            style={{ ...input, padding: "6px 8px", fontSize: 12 }}
          />
          <button
            onClick={() => {
              onFund(amt);
              setAmt("");
              setOpen(false);
            }}
            style={{ ...btnSm, background: C.green, color: C.asphalt, borderColor: C.green }}
          >
            <Check size={13} />
          </button>
        </div>
      ) : (
        <button onClick={() => setOpen(true)} style={{ ...btnSm, marginTop: 8, width: "100%" }}>
          <Plus size={12} /> Add
        </button>
      )}
    </div>
  );
}

/* ---------- Quick log (home) ---------- */
function QuickLog({ onEarn, onExpense }) {
  const [mode, setMode] = useState("earn");
  return (
    <section style={card}>
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        <TogglePill on={mode === "earn"} onClick={() => setMode("earn")}>Log earnings</TogglePill>
        <TogglePill on={mode === "spend"} onClick={() => setMode("spend")}>Log expense</TogglePill>
      </div>
      {mode === "earn" ? <EarningForm onSubmit={onEarn} /> : <ExpenseForm onSubmit={onExpense} />}
    </section>
  );
}

function EarningForm({ onSubmit, earning, onCancel }) {
  const editing = Boolean(earning);
  const [date, setDate] = useState(earning?.date || todayISO());
  const [gross, setGross] = useState(earning?.gross ?? "");
  const [other, setOther] = useState(earning?.other ?? "");
  const [hours, setHours] = useState(earning?.hours ?? "");
  const [note, setNote] = useState(earning?.note || "");
  const submit = () => {
    if (!gross && !other) return;
    const ok = onSubmit({ date, gross, other, hours, note });
    if (editing) return;
    if (ok === false) return;
    setGross(""); setOther(""); setHours(""); setNote("");
  };
  const g = asMoney(gross) + asMoney(other);
  const h = Number(hours) || 0;
  const rate = h > 0 ? g / h : null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
      <Field label="Date">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={input} />
      </Field>
      <div style={{ display: "flex", gap: 9 }}>
        <Field label="Uber gross" flex>
          <input value={gross} onChange={(e) => setGross(e.target.value)} placeholder="$0.00" inputMode="decimal" style={input} />
        </Field>
        <Field label="Hours" flex>
          <input value={hours} onChange={(e) => setHours(e.target.value)} placeholder="e.g. 8.5" inputMode="decimal" style={input} />
        </Field>
      </div>
      <Field label="Other income">
        <input value={other} onChange={(e) => setOther(e.target.value)} placeholder="AI / tips / 1099" inputMode="decimal" style={input} />
      </Field>
      {rate != null && (
        <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.lane }}>
          Effective {usd(rate)}/hr this shift
        </div>
      )}
      <Field label="Note (optional)">
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Busy Friday night" style={input} />
      </Field>
      <div style={{ display: "flex", gap: 9 }}>
        <button onClick={submit} style={{ ...btnPrimary, flex: 1 }}>
          {editing ? <><Save size={15} /> Save changes</> : <><Plus size={15} /> Save shift</>}
        </button>
        {editing && onCancel && (
          <button onClick={onCancel} style={{ ...btnGhost, flex: 0.45 }}>Cancel</button>
        )}
      </div>
    </div>
  );
}

const EXP_CATS = ["Gas", "Rent", "Food", "Car", "Phone", "Other"];
function ExpenseForm({ onSubmit, expense, onCancel }) {
  const editing = Boolean(expense);
  const [date, setDate] = useState(expense?.date || todayISO());
  const [amount, setAmount] = useState(expense?.amount ?? "");
  const [category, setCategory] = useState(expense?.category || "Gas");
  const [note, setNote] = useState(expense?.note || "");
  const submit = () => {
    if (!amount) return;
    const ok = onSubmit({ date, amount, category, note });
    if (editing) return;
    if (ok === false) return;
    setAmount(""); setNote("");
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
      <div style={{ display: "flex", gap: 9 }}>
        <Field label="Date" flex>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={input} />
        </Field>
        <Field label="Amount" flex>
          <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="$0.00" inputMode="decimal" style={input} />
        </Field>
      </div>
      <Field label="Category">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {EXP_CATS.map((c) => (
            <button key={c} type="button" onClick={() => setCategory(c)} style={chip(category === c)}>{c}</button>
          ))}
        </div>
      </Field>
      <Field label="Note (optional)">
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Chevron fill-up" style={input} />
      </Field>
      <div style={{ display: "flex", gap: 9 }}>
        <button onClick={submit} style={{ ...btnPrimary, background: C.amber, borderColor: C.amber, flex: 1 }}>
          {editing ? <><Save size={15} /> Save changes</> : <><Plus size={15} /> Save expense</>}
        </button>
        {editing && onCancel && (
          <button onClick={onCancel} style={{ ...btnGhost, flex: 0.45 }}>Cancel</button>
        )}
      </div>
    </div>
  );
}

/* ---------- Debts view ---------- */
function DebtsView({ debts, today, onPay, onAdd, onUpdate, onDelete }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("active");
  const [sort, setSort] = useState("priority");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const order = { card: 0, loan: 1, personal: 2 };
  const shown = [...debts]
    .filter((d) => filter === "all" || (filter === "paid" ? d.paid : !d.paid))
    .filter((d) => d.name.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => {
      if (sort === "balance") return b.balance - a.balance;
      if (sort === "smallest") return a.balance - b.balance;
      if (sort === "deadline") return (a.deadline || "9999-12-31").localeCompare(b.deadline || "9999-12-31");
      if (a.paid !== b.paid) return a.paid ? 1 : -1;
      const ad = a.deadline ? daysBetween(today, a.deadline) : Infinity;
      const bd = b.deadline ? daysBetween(today, b.deadline) : Infinity;
      if (ad !== bd) return ad - bd;
      return order[a.group] - order[b.group] || a.balance - b.balance;
    });
  const active = debts.filter((d) => !d.paid);
  const activeTotal = active.reduce((sum, d) => sum + asMoney(d.balance), 0);
  return (
    <div>
      <section style={{ ...card, position: "sticky", top: 8, zIndex: 8, boxShadow: "0 10px 30px rgba(0,0,0,.22)" }}>
        <div style={rowBetween}>
          <div>
            <div style={{ fontFamily: FONT_DISP, fontWeight: 700, fontSize: 16 }}>Debt command center</div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 10.5, color: C.faint, marginTop: 2 }}>{usd0(activeTotal)} across {active.length} active debts</div>
          </div>
          <button onClick={() => { setEditing(null); setShowForm(true); }} style={{ ...btnPrimary, padding: "8px 11px", fontSize: 12 }}>
            <Plus size={14} /> Add debt
          </button>
        </div>
        <div style={{ position: "relative", marginTop: 11 }}>
          <Search size={14} color={C.faint} style={{ position: "absolute", left: 10, top: 11 }} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search debts" style={{ ...input, paddingLeft: 32 }} />
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 8, overflowX: "auto" }}>
          {["active", "all", "paid"].map((x) => <button key={x} onClick={() => setFilter(x)} style={chip(filter === x)}>{x[0].toUpperCase()+x.slice(1)}</button>)}
          <select value={sort} onChange={(e) => setSort(e.target.value)} style={{ ...input, width: "auto", marginLeft: "auto", padding: "6px 8px", fontSize: 11 }}>
            <option value="priority">Priority</option><option value="deadline">Deadline</option><option value="smallest">Smallest first</option><option value="balance">Largest first</option>
          </select>
        </div>
      </section>

      {showForm && (
        <DebtForm
          debt={editing}
          onCancel={() => { setShowForm(false); setEditing(null); }}
          onSubmit={(values) => {
            const ok = editing ? onUpdate(editing.id, values) : onAdd(values);
            if (ok) { setShowForm(false); setEditing(null); }
          }}
        />
      )}

      <SectionHeading>{shown.length} debt{shown.length === 1 ? "" : "s"}</SectionHeading>
      {shown.length ? shown.map((d) => (
        <DebtCard
          key={d.id}
          d={d}
          today={today}
          onPay={onPay}
          onEdit={() => { setEditing(d); setShowForm(true); window.scrollTo?.({ top: 0, behavior: "smooth" }); }}
          onDelete={() => onDelete(d.id)}
        />
      )) : (
        <div style={{ ...card, textAlign: "center", color: C.muted, fontFamily: FONT_MONO, fontSize: 12 }}>
          No debts match this view. Add a debt to start tracking it.
        </div>
      )}
    </div>
  );
}

function DebtForm({ debt, onSubmit, onCancel }) {
  const [name, setName] = useState(debt?.name || "");
  const [balance, setBalance] = useState(debt?.balance ?? "");
  const [min, setMin] = useState(debt?.min ?? "");
  const [deadline, setDeadline] = useState(debt?.deadline || "");
  const [group, setGroup] = useState(debt?.group || "card");
  const [type, setType] = useState(debt?.type || "Interest-bearing");
  const [apr, setApr] = useState(debt?.apr ?? (debt?.group === "card" ? "22.99" : debt?.group === "loan" ? "9.99" : "0"));
  const [note, setNote] = useState(debt?.note || "");
  const submit = () => onSubmit({ name, balance, min, deadline, group, type, apr, note });
  return (
    <section style={{ ...card, borderColor: C.greenDim, boxShadow: "0 14px 34px rgba(0,0,0,.24)" }}>
      <div style={rowBetween}>
        <div>
          <SectionLabel icon={debt ? Pencil : Plus}>{debt ? "EDIT DEBT" : "ADD A NEW DEBT"}</SectionLabel>
          <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: C.faint, marginTop: 4 }}>Track cards, loans, or money owed to people.</div>
        </div>
        <button onClick={onCancel} style={{ ...btnSm, padding: 7 }} aria-label="Close"><X size={14} /></button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9, marginTop: 12 }}>
        <div style={{ gridColumn: "1 / -1" }}><Field label="Debt name"><input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Chase Freedom" style={input} /></Field></div>
        <Field label="Current balance"><input value={balance} onChange={(e) => setBalance(e.target.value)} inputMode="decimal" placeholder="$0.00" style={input} /></Field>
        <Field label="Minimum / month"><input value={min} onChange={(e) => setMin(e.target.value)} inputMode="decimal" placeholder="Optional" style={input} /></Field>
        <Field label="Debt category">
          <select value={group} onChange={(e) => {
            const g = e.target.value;
            setGroup(g);
            if (!debt) setApr(g === "card" ? "22.99" : g === "loan" ? "9.99" : "0");
          }} style={input}>
            <option value="card">Credit card</option><option value="loan">Loan</option><option value="personal">Personal debt</option>
          </select>
        </Field>
        <Field label="APR %"><input value={apr} onChange={(e) => setApr(e.target.value)} inputMode="decimal" placeholder="0" style={input} /></Field>
        <Field label="Due date / payoff deadline"><input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} style={input} /></Field>
        <div style={{ gridColumn: "1 / -1" }}><Field label="Description"><input value={type} onChange={(e) => setType(e.target.value)} placeholder="Interest-bearing" style={input} /></Field></div>
        <div style={{ gridColumn: "1 / -1" }}><Field label="Note (optional)"><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Mom — Aug 15" style={input} /></Field></div>
      </div>
      <div style={{ display: "flex", gap: 9, marginTop: 12 }}>
        <button onClick={submit} style={{ ...btnPrimary, flex: 1 }}><Save size={15} /> {debt ? "Save changes" : "Add debt"}</button>
        <button onClick={onCancel} style={{ ...btnGhost, flex: 0.55 }}>Cancel</button>
      </div>
    </section>
  );
}

function DebtCard({ d, today, onPay, onEdit, onDelete }) {
  const [open, setOpen] = useState(false);
  const [amt, setAmt] = useState("");
  const [payNote, setPayNote] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const original = asMoney(d.originalBalance) || asMoney(d.balance) || 1;
  const pct = Math.min(100, Math.max(0, ((original - d.balance) / original) * 100));
  const days = d.deadline ? daysBetween(today, d.deadline) : null;
  const urgent = days != null && days <= 7 && !d.paid;
  const soon = days != null && days <= 10 && !d.paid;
  const apr = debtApr(d);
  const drag = monthlyInterestOf(d);
  return (
    <div style={{ ...card, opacity: d.paid ? 0.72 : 1, borderColor: d.paid ? C.greenDim : urgent ? C.red : C.line }}>
      <div style={rowBetween}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          {d.paid && <div style={paidBadge}><Check size={11} /> PAID</div>}
          <span style={{ fontFamily: FONT_DISP, fontWeight: 600, fontSize: 14.5, color: C.text, overflow: "hidden", textOverflow: "ellipsis" }}>{d.name}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          {days != null && !d.paid && <span style={{ ...deadlineBadge, background: soon ? (urgent ? C.redDim : C.amberDim) : C.surface2, borderColor: soon ? (urgent ? C.red : C.amber) : C.line, color: soon ? (urgent ? C.red : C.amber) : C.muted }}>{days <= 0 ? "DUE TODAY" : `${days}D LEFT`}</span>}
          <button onClick={onEdit} style={{ ...btnSm, padding: 6 }} title="Edit debt"><Pencil size={13} /></button>
        </div>
      </div>
      {d.note ? (
        <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.muted, marginTop: 6 }}>{d.note}</div>
      ) : null}
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 8 }}>
        <span style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 21, color: d.paid ? C.green : C.text }}>{usd(d.balance)}</span>
        <span style={{ fontFamily: FONT_MONO, fontSize: 10.5, color: C.faint }}>of {usd(original)}</span>
        {d.min && <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: C.faint, marginLeft: "auto" }}>min {usd0(d.min)}/mo</span>}
      </div>
      {!d.paid && drag > 0.05 && (
        <div style={{ fontFamily: FONT_MONO, fontSize: 10.5, color: C.amber, marginTop: 6 }}>
          {apr}% APR · ~{usd(drag)} interest / mo
        </div>
      )}
      <div style={{ ...progTrack, height: 7, marginTop: 9 }}><div style={{ ...progFill, width: `${pct}%`, background: d.paid ? C.green : d.group === "personal" ? C.blue : C.green }} /></div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 9 }}>
        <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: C.faint }}>{d.type}</span>
        {!d.paid && (open ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
            <div style={{ display: "flex", gap: 6 }}>
              <input value={amt} onChange={(e) => setAmt(e.target.value)} placeholder="$ amount" inputMode="decimal" style={{ ...input, width: 92, padding: "6px 8px", fontSize: 12 }} />
              <button
                type="button"
                title="Confirm payment"
                onClick={() => { onPay(d.id, amt, payNote); setAmt(""); setPayNote(""); setOpen(false); }}
                style={{ ...btnSm, background: C.green, color: C.asphalt, borderColor: C.green }}
              >
                <Check size={13} />
              </button>
              <button onClick={() => setOpen(false)} style={btnSm}><X size={13} /></button>
            </div>
            <input value={payNote} onChange={(e) => setPayNote(e.target.value)} placeholder="Note (optional)" style={{ ...input, width: 210, padding: "6px 8px", fontSize: 11 }} />
          </div>
        ) : <button onClick={() => setOpen(true)} style={btnSm}><Plus size={12} /> Log payment</button>)}
      </div>
      {(d.payments || []).length > 0 && <div style={{ marginTop: 9, borderTop: `1px solid ${C.lineSoft}`, paddingTop: 7 }}>{d.payments.slice(0, 3).map((p) => <div key={p.id} style={{ display: "flex", justifyContent: "space-between", fontFamily: FONT_MONO, fontSize: 10.5, color: C.muted, marginTop: 2 }}><span>{p.date}{p.note ? ` · ${p.note}` : ""}</span><span style={{ color: C.green }}>−{usd(p.amount)}</span></div>)}</div>}
      <div style={{ borderTop: `1px solid ${C.lineSoft}`, marginTop: 10, paddingTop: 8 }}>
        {confirmDelete ? <div style={{ display: "flex", alignItems: "center", gap: 7 }}><span style={{ flex: 1, fontFamily: FONT_MONO, fontSize: 10.5, color: C.red }}>Delete this debt and payment history?</span><button onClick={onDelete} style={{ ...btnSm, color: C.red, borderColor: C.redDim }}>Delete</button><button onClick={() => setConfirmDelete(false)} style={btnSm}>Cancel</button></div> : <button onClick={() => setConfirmDelete(true)} style={{ ...btnSm, border: "none", background: "transparent", color: C.faint, paddingLeft: 0 }}><Trash2 size={13} /> Delete debt</button>}
      </div>
    </div>
  );
}

/* ---------- Money view (history + logging) ---------- */
function MoneyView({
  earnings,
  expenses,
  recurring = [],
  onEarn,
  onExpense,
  onUpdateExpense,
  onUpdateEarning,
  onRemove,
  onAddRecurring,
  onRemoveRecurring,
  onLogRecurring,
}) {
  const [mode, setMode] = useState("earn");
  const [editingExpense, setEditingExpense] = useState(null);
  const [editingEarning, setEditingEarning] = useState(null);
  const [showRecurringForm, setShowRecurringForm] = useState(false);
  const [recAmt, setRecAmt] = useState("");
  const [recCat, setRecCat] = useState("Rent");
  const [recNote, setRecNote] = useState("");
  const [recCadence, setRecCadence] = useState("monthly");
  const feed = [
    ...earnings.map((e) => ({ ...e, kind: "earn", amt: (Number(e.gross) || 0) + (Number(e.other) || 0) })),
    ...expenses.map((e) => ({ ...e, kind: "spend", amt: Number(e.amount) || 0 })),
  ].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id));

  return (
    <div>
      <section style={card}>
        {editingEarning ? (
          <>
            <SectionLabel icon={Pencil}>EDIT EARNING</SectionLabel>
            <div style={{ marginTop: 10 }}>
              <EarningForm
                key={editingEarning.id}
                earning={editingEarning}
                onCancel={() => setEditingEarning(null)}
                onSubmit={(values) => {
                  const ok = onUpdateEarning(editingEarning.id, values);
                  if (ok) setEditingEarning(null);
                }}
              />
            </div>
          </>
        ) : editingExpense ? (
          <>
            <SectionLabel icon={Pencil}>EDIT EXPENSE</SectionLabel>
            <div style={{ marginTop: 10 }}>
              <ExpenseForm
                key={editingExpense.id}
                expense={editingExpense}
                onCancel={() => setEditingExpense(null)}
                onSubmit={(values) => {
                  const ok = onUpdateExpense(editingExpense.id, values);
                  if (ok) setEditingExpense(null);
                }}
              />
            </div>
          </>
        ) : (
          <>
            <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
              <TogglePill on={mode === "earn"} onClick={() => setMode("earn")}>Log earnings</TogglePill>
              <TogglePill on={mode === "spend"} onClick={() => setMode("spend")}>Log expense</TogglePill>
            </div>
            {mode === "earn" ? <EarningForm onSubmit={onEarn} /> : <ExpenseForm onSubmit={onExpense} />}
          </>
        )}
      </section>

      <SectionHeading>Recurring expenses</SectionHeading>
      <section style={card}>
        <SectionLabel icon={Repeat}>TEMPLATES</SectionLabel>
        <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.muted, marginTop: 6, lineHeight: 1.45 }}>
          Rent, insurance, phone — tap Log when due so Money stays accurate.
        </div>
        {(recurring || []).map((r) => (
          <div key={r.id} style={{ ...rowBetween, marginTop: 10, gap: 8 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: FONT_DISP, fontWeight: 600, fontSize: 13 }}>{r.category} · {usd0(r.amount)}</div>
              <div style={{ fontFamily: FONT_MONO, fontSize: 10.5, color: C.faint }}>
                {r.cadence}{r.note ? ` · ${r.note}` : ""}{r.lastLogged ? ` · last ${r.lastLogged}` : ""}
              </div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button type="button" onClick={() => onLogRecurring(r.id)} style={{ ...btnSm, background: C.amber, color: C.asphalt, borderColor: C.amber }}>Log</button>
              <button type="button" onClick={() => onRemoveRecurring(r.id)} style={{ ...btnSm, padding: 6 }}><Trash2 size={13} /></button>
            </div>
          </div>
        ))}
        {showRecurringForm ? (
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 9 }}>
            <div style={{ display: "flex", gap: 9 }}>
              <Field label="Amount" flex>
                <input value={recAmt} onChange={(e) => setRecAmt(e.target.value)} inputMode="decimal" placeholder="$0" style={input} />
              </Field>
              <Field label="Cadence" flex>
                <select value={recCadence} onChange={(e) => setRecCadence(e.target.value)} style={input}>
                  <option value="monthly">Monthly</option>
                  <option value="weekly">Weekly</option>
                </select>
              </Field>
            </div>
            <Field label="Category">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {EXP_CATS.map((c) => (
                  <button key={c} type="button" onClick={() => setRecCat(c)} style={chip(recCat === c)}>{c}</button>
                ))}
              </div>
            </Field>
            <Field label="Note">
              <input value={recNote} onChange={(e) => setRecNote(e.target.value)} placeholder="Rent — 1st of month" style={input} />
            </Field>
            <div style={{ display: "flex", gap: 9 }}>
              <button
                type="button"
                onClick={() => {
                  const ok = onAddRecurring({ amount: recAmt, category: recCat, note: recNote, cadence: recCadence });
                  if (ok) {
                    setRecAmt("");
                    setRecNote("");
                    setShowRecurringForm(false);
                  }
                }}
                style={{ ...btnPrimary, flex: 1 }}
              >
                <Plus size={14} /> Save template
              </button>
              <button type="button" onClick={() => setShowRecurringForm(false)} style={{ ...btnGhost, flex: 0.45 }}>Cancel</button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setShowRecurringForm(true)} style={{ ...btnGhost, width: "100%", marginTop: 12 }}>
            <Plus size={14} /> Add recurring
          </button>
        )}
      </section>

      <SectionHeading>History</SectionHeading>
      {feed.length === 0 && (
        <div style={{ ...card, textAlign: "center", color: C.muted, fontFamily: FONT_MONO, fontSize: 12 }}>
          Nothing logged yet. Your entries will show here.
        </div>
      )}
      {feed.map((f) => {
        const isEarn = f.kind === "earn";
        return (
          <div key={f.kind + f.id} style={{ ...card, padding: "11px 13px", display: "flex", alignItems: "center", gap: 11 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: isEarn ? C.greenDim : C.amberDim, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {isEarn ? <TrendingUp size={15} color={C.green} /> : <Receipt size={15} color={C.amber} />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: FONT_DISP, fontWeight: 600, fontSize: 13, color: C.text }}>
                {isEarn ? "Earnings" : f.category}
                {f.note ? <span style={{ color: C.faint, fontWeight: 400, fontSize: 11 }}> · {f.note}</span> : null}
              </div>
              <div style={{ fontFamily: FONT_MONO, fontSize: 10.5, color: C.faint }}>{f.date}</div>
            </div>
            <div style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 14, color: isEarn ? C.green : C.amber }}>
              {isEarn ? "+" : "−"}{usd0(f.amt)}
            </div>
            <button
              onClick={() => {
                if (isEarn) {
                  setEditingExpense(null);
                  setEditingEarning(f);
                } else {
                  setEditingEarning(null);
                  setEditingExpense(f);
                }
                window.scrollTo?.({ top: 0, behavior: "smooth" });
              }}
              style={{ ...btnSm, padding: 6, border: "none", background: "transparent" }}
              title={isEarn ? "Edit earning" : "Edit expense"}
            >
              <Pencil size={14} color={C.faint} />
            </button>
            <button onClick={() => onRemove(isEarn ? "earn" : "spend", f.id)} style={{ ...btnSm, padding: 6, border: "none", background: "transparent" }}>
              <Trash2 size={14} color={C.faint} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- Charts view ---------- */
function ChartsView({ earningsData, debtData, curMonth, baseDaily }) {
  return (
    <div>
      <SectionHeading>Earnings vs target · {monthLabel(curMonth + "-01")}</SectionHeading>
      <section style={card}>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={earningsData} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
            <CartesianGrid stroke={C.lineSoft} vertical={false} />
            <XAxis dataKey="day" tick={{ fill: C.faint, fontSize: 10, fontFamily: FONT_MONO }} interval={4} tickLine={false} axisLine={{ stroke: C.line }} />
            <YAxis tick={{ fill: C.faint, fontSize: 10, fontFamily: FONT_MONO }} tickLine={false} axisLine={false} width={44} tickFormatter={(v) => `$${v}`} />
            <Tooltip contentStyle={tooltip} labelStyle={{ color: C.muted, fontFamily: FONT_MONO }} formatter={(v) => (v == null ? "—" : usd0(v))} labelFormatter={(l) => `Day ${l}`} />
            <ReferenceLine y={baseDaily} stroke={C.lane} strokeDasharray="4 4" />
            <Line type="monotone" dataKey="earned" stroke={C.green} strokeWidth={2.5} dot={{ r: 2.5, fill: C.green }} connectNulls={false} />
          </LineChart>
        </ResponsiveContainer>
        <div style={{ display: "flex", gap: 16, marginTop: 6, paddingLeft: 6 }}>
          <Legend color={C.green} label="Daily earnings" />
          <Legend color={C.lane} label={`Target ${usd0(baseDaily)}/day`} dashed />
        </div>
      </section>

      <SectionHeading>Total debt over time</SectionHeading>
      <section style={card}>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={debtData} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
            <defs>
              <linearGradient id="debtGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={C.red} stopOpacity={0.45} />
                <stop offset="100%" stopColor={C.red} stopOpacity={0.03} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={C.lineSoft} vertical={false} />
            <XAxis dataKey="label" tick={{ fill: C.faint, fontSize: 9.5, fontFamily: FONT_MONO }} tickLine={false} axisLine={{ stroke: C.line }} />
            <YAxis tick={{ fill: C.faint, fontSize: 10, fontFamily: FONT_MONO }} tickLine={false} axisLine={false} width={52} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
            <Tooltip contentStyle={tooltip} labelStyle={{ color: C.muted, fontFamily: FONT_MONO }} formatter={(v) => usd0(v)} />
            <Area type="stepAfter" dataKey="total" stroke={C.red} strokeWidth={2.5} fill="url(#debtGrad)" />
          </AreaChart>
        </ResponsiveContainer>
        <div style={{ display: "flex", gap: 16, marginTop: 6, paddingLeft: 6 }}>
          <Legend color={C.red} label="Remaining debt balance" />
        </div>
      </section>
    </div>
  );
}

/* ---------- Settings ---------- */
function SettingsView({ settings, setSettings, onExport, onExportCsv, onImportClick, onReset, onSignOut, accountEmail }) {
  const [confirmReset, setConfirmReset] = useState(false);
  const set = (k, v) => setSettings((s) => ({ ...s, [k]: v }));
  return (
    <div>
      <SectionHeading>Bank connections</SectionHeading>
      <section style={{ ...card, opacity: 0.92, borderStyle: "dashed" }}>
        <div style={rowBetween}>
          <SectionLabel icon={Landmark}>PLAID LINK</SectionLabel>
          <span
            style={{
              fontFamily: FONT_MONO,
              fontSize: 10,
              letterSpacing: 1,
              color: C.lane,
              background: C.amberDim,
              border: `1px solid ${C.amber}`,
              borderRadius: 6,
              padding: "3px 7px",
            }}
          >
            COMING SOON
          </span>
        </div>
        <div style={{ fontFamily: FONT_DISP, fontWeight: 600, fontSize: 15, color: C.text, marginTop: 10 }}>
          Auto-import cards & loans
        </div>
        <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.muted, marginTop: 6, lineHeight: 1.5 }}>
          Secure bank linking via Plaid is on the roadmap. For now, add balances manually in Debts — personal IOUs stay manual either way.
        </div>
        <button
          type="button"
          disabled
          style={{ ...btnPrimary, width: "100%", marginTop: 14, opacity: 0.45, cursor: "not-allowed" }}
        >
          Connect with Plaid
        </button>
      </section>

      <SectionHeading>Plan</SectionHeading>
      <section style={card}>
        <SectionLabel>PAYOFF PLAN</SectionLabel>
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          {["A", "B"].map((p) => {
            const on = settings.activePlan === p;
            return (
              <button key={p} onClick={() => set("activePlan", p)} style={planBtn(on)}>
                <div style={{ fontFamily: FONT_DISP, fontWeight: 700, fontSize: 14 }}>
                  Plan {p} · {PLANS[p].label}
                </div>
                <div style={{ fontFamily: FONT_MONO, fontSize: 10.5, color: on ? C.asphalt : C.faint, marginTop: 3 }}>
                  Debt-free {parseISO(PLANS[p].freeDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </div>
              </button>
            );
          })}
        </div>
        {settings.customDailyTarget != null && (
          <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.lane, marginTop: 10 }}>
            Custom daily override active: {usd0(settings.customDailyTarget)} — clear it from What If on Home.
          </div>
        )}
      </section>

      <SectionHeading>Payoff method</SectionHeading>
      <section style={card}>
        <SectionLabel>SNOWBALL VS AVALANCHE</SectionLabel>
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <TogglePill on={settings.payoffMethod !== "snowball"} onClick={() => set("payoffMethod", "avalanche")}>Avalanche</TogglePill>
          <TogglePill on={settings.payoffMethod === "snowball"} onClick={() => set("payoffMethod", "snowball")}>Snowball</TogglePill>
        </div>
        <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.muted, marginTop: 10, lineHeight: 1.5 }}>
          {settings.payoffMethod === "snowball"
            ? "Snowball: kill smallest balances first for quick wins."
            : "Avalanche: kill highest APR first to cut interest drag."}
        </div>
      </section>

      <SectionHeading>Baselines</SectionHeading>
      <section style={card}>
        <NumberRow label="Monthly living cost" hint="Rent + car + living" value={settings.monthlyBaseline} onChange={(v) => set("monthlyBaseline", v)} prefix="$" />
        <NumberRow label="Tax set-aside rate" hint="Auto-reserved from income" value={Math.round(settings.taxRate * 100)} onChange={(v) => set("taxRate", (Number(v) || 0) / 100)} suffix="%" />
        <NumberRow label="Emergency buffer goal" hint="Car-repair reserve" value={settings.bufferGoal} onChange={(v) => set("bufferGoal", v)} prefix="$" last />
      </section>

      <SectionHeading>Daily gas</SectionHeading>
      <section style={card}>
        <NumberRow
          label="Gas money / day"
          hint="Added on top of debt target so you know total to earn"
          value={settings.dailyGasBudget ?? 40}
          onChange={(v) => set("dailyGasBudget", Math.max(0, Number(v) || 0))}
          prefix="$"
          last
        />
        <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.muted, marginTop: 4, lineHeight: 1.5 }}>
          Home shows debt target + this gas amount = total to earn. Change it anytime if fuel prices shift.
        </div>
      </section>

      <SectionHeading>Reminders</SectionHeading>
      <section style={card}>
        <div style={rowBetween}>
          <div>
            <div style={{ fontFamily: FONT_DISP, fontWeight: 600, fontSize: 14 }}>Soft reminders</div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.muted, marginTop: 4, lineHeight: 1.45 }}>
              Buffer below goal + min payments near deadline
            </div>
          </div>
          <TogglePill on={settings.softReminders !== false} onClick={() => set("softReminders", settings.softReminders === false)}>
            {settings.softReminders === false ? "Off" : "On"}
          </TogglePill>
        </div>
      </section>

      {onSignOut && (
        <>
          <SectionHeading>Account</SectionHeading>
          <section style={card}>
            <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.muted, marginBottom: 11, lineHeight: 1.5 }}>
              Signed in as <span style={{ color: C.text }}>{accountEmail || "you"}</span>. This account’s debts and plan are private.
            </div>
            <button onClick={onSignOut} style={{ ...btnGhost, width: "100%", color: C.amber, borderColor: C.amberDim }}>
              Sign out
            </button>
          </section>
        </>
      )}

      <SectionHeading>Backup</SectionHeading>
      <section style={card}>
        <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.muted, marginBottom: 11, lineHeight: 1.5 }}>
          Cloud sync requires login. Export JSON anytime, or CSV for sheets / taxes.
        </div>
        <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
          <button onClick={onExport} style={{ ...btnPrimary, flex: 1, minWidth: 120 }}><Download size={15} /> Export JSON</button>
          <button onClick={onExportCsv} style={{ ...btnGhost, flex: 1, minWidth: 120 }}><FileSpreadsheet size={15} /> Export CSV</button>
          <button onClick={onImportClick} style={{ ...btnGhost, flex: 1, minWidth: 120 }}><Upload size={15} /> Import JSON</button>
        </div>
      </section>

      <SectionHeading>Danger zone</SectionHeading>
      <section style={{ ...card, borderColor: C.redDim }}>
        {confirmReset ? (
          <div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 11.5, color: C.text, marginBottom: 10 }}>
              This wipes all logged earnings, expenses, and payments and restores the starting debt data. Export a backup first if unsure.
            </div>
            <div style={{ display: "flex", gap: 9 }}>
              <button onClick={() => { onReset(); setConfirmReset(false); }} style={{ ...btnPrimary, background: C.red, borderColor: C.red, flex: 1 }}>
                <Trash2 size={14} /> Yes, reset everything
              </button>
              <button onClick={() => setConfirmReset(false)} style={{ ...btnGhost, flex: 1 }}>Cancel</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setConfirmReset(true)} style={{ ...btnGhost, width: "100%", color: C.red, borderColor: C.redDim }}>
            <Trash2 size={14} /> Reset all data
          </button>
        )}
      </section>

      <div style={{ textAlign: "center", fontFamily: FONT_MONO, fontSize: 10, color: C.faint, marginTop: 16 }}>
        Total debt {usd(INITIAL_TOTAL)} · baseline as of {AS_OF}
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Small shared bits                                                  */
/* ================================================================== */
function SectionLabel({ children, icon: Icon }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      {Icon && <Icon size={13} color={C.faint} />}
      <span style={{ fontFamily: FONT_MONO, fontSize: 10.5, letterSpacing: 1.2, color: C.faint }}>{children}</span>
    </div>
  );
}
function SectionHeading({ children }) {
  return (
    <div style={{ fontFamily: FONT_DISP, fontWeight: 600, fontSize: 13, color: C.muted, margin: "18px 2px 10px", letterSpacing: 0.2 }}>
      {children}
    </div>
  );
}
function Field({ label, children, flex }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 5, flex: flex ? 1 : undefined }}>
      <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: C.faint, letterSpacing: 0.5 }}>{label}</span>
      {children}
    </label>
  );
}
function TogglePill({ on, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        padding: "8px 0",
        borderRadius: 9,
        border: `1px solid ${on ? C.green : C.line}`,
        background: on ? C.greenDim : "transparent",
        color: on ? C.text : C.muted,
        fontFamily: FONT_DISP,
        fontWeight: 600,
        fontSize: 12.5,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}
function Legend({ color, label, dashed }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ width: 14, height: 0, borderTop: `${dashed ? "2px dashed" : "3px solid"} ${color}` }} />
      <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: C.muted }}>{label}</span>
    </div>
  );
}
function NumberRow({ label, hint, value, onChange, prefix, suffix, last }) {
  return (
    <div style={{ display: "flex", alignItems: "center", padding: "9px 0", borderBottom: last ? "none" : `1px solid ${C.lineSoft}` }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: FONT_DISP, fontWeight: 600, fontSize: 13, color: C.text }}>{label}</div>
        <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: C.faint }}>{hint}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
        {prefix && <span style={{ fontFamily: FONT_MONO, color: C.muted, fontSize: 13 }}>{prefix}</span>}
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          inputMode="decimal"
          style={{ ...input, width: 78, textAlign: "right", padding: "7px 8px" }}
        />
        {suffix && <span style={{ fontFamily: FONT_MONO, color: C.muted, fontSize: 13 }}>{suffix}</span>}
      </div>
    </div>
  );
}

/* confetti */
function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 60 }).map((_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.6,
        dur: 2 + Math.random() * 1.2,
        color: [C.green, C.lane, C.blue, C.amber, "#fff"][i % 5],
        size: 5 + Math.random() * 6,
        rot: Math.random() * 360,
      })),
    []
  );
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 60, overflow: "hidden" }}>
      <style>{`@keyframes ddfall{0%{transform:translateY(-20px) rotate(0);opacity:1}100%{transform:translateY(105vh) rotate(720deg);opacity:0}}`}</style>
      {pieces.map((p) => (
        <div
          key={p.id}
          style={{
            position: "absolute",
            top: 0,
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 1.6,
            background: p.color,
            borderRadius: 1,
            transform: `rotate(${p.rot}deg)`,
            animation: `ddfall ${p.dur}s ${p.delay}s ease-in forwards`,
          }}
        />
      ))}
    </div>
  );
}

/* ================================================================== */
/*  Styles                                                             */
/* ================================================================== */
const page = {
  background: `
    radial-gradient(900px 420px at 50% -10%, rgba(255,229,102,.09), transparent 55%),
    radial-gradient(700px 360px at 100% 20%, rgba(61,220,151,.05), transparent 50%),
    linear-gradient(180deg, #0A1018 0%, ${C.asphalt} 40%, #06090D 100%)
  `,
  minHeight: "100vh",
  color: C.text,
  fontFamily: FONT_BODY,
  WebkitFontSmoothing: "antialiased",
};
const card = {
  background: C.surface,
  border: `1px solid ${C.line}`,
  borderRadius: 16,
  padding: "14px 15px",
  marginBottom: 12,
};
const rowBetween = { display: "flex", alignItems: "center", justifyContent: "space-between" };
const input = {
  background: C.surface2,
  border: `1px solid ${C.line}`,
  borderRadius: 9,
  color: C.text,
  fontFamily: FONT_MONO,
  fontSize: 13,
  padding: "9px 10px",
  width: "100%",
  outline: "none",
  boxSizing: "border-box",
};
const btnPrimary = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 7,
  background: C.green,
  color: C.asphalt,
  border: `1px solid ${C.green}`,
  borderRadius: 10,
  padding: "11px 14px",
  fontFamily: FONT_DISP,
  fontWeight: 700,
  fontSize: 13.5,
  cursor: "pointer",
};
const btnGhost = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 7,
  background: "transparent",
  color: C.text,
  border: `1px solid ${C.line}`,
  borderRadius: 10,
  padding: "11px 14px",
  fontFamily: FONT_DISP,
  fontWeight: 600,
  fontSize: 13,
  cursor: "pointer",
};
const btnSm = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  background: C.surface2,
  color: C.text,
  border: `1px solid ${C.line}`,
  borderRadius: 8,
  padding: "7px 11px",
  fontFamily: FONT_DISP,
  fontWeight: 600,
  fontSize: 11.5,
  cursor: "pointer",
};
const progTrack = {
  position: "relative",
  height: 9,
  background: C.surface2,
  borderRadius: 6,
  overflow: "hidden",
  border: `1px solid ${C.lineSoft}`,
};
const progFill = { height: "100%", borderRadius: 6, transition: "width .5s ease" };
const miniStat = {
  flex: 1,
  background: C.surface2,
  border: `1px solid ${C.lineSoft}`,
  borderRadius: 10,
  padding: "9px 10px",
};
const miniLabel = { fontFamily: FONT_MONO, fontSize: 9, letterSpacing: 0.8, color: C.faint };
const miniVal = { fontFamily: FONT_MONO, fontWeight: 700, fontSize: 15, marginTop: 3 };
const badgeIcon = {
  width: 30, height: 30, borderRadius: 9, background: C.lane,
  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
};
const badgeIconSm = {
  width: 22, height: 22, borderRadius: 7, background: C.lane,
  display: "flex", alignItems: "center", justifyContent: "center",
  boxShadow: `0 0 0 3px ${C.asphalt}`,
};
const paidBadge = {
  display: "inline-flex", alignItems: "center", gap: 3,
  background: C.greenDim, color: C.green, border: `1px solid ${C.green}`,
  borderRadius: 6, padding: "2px 6px", fontFamily: FONT_MONO, fontWeight: 700, fontSize: 9.5, letterSpacing: 0.5,
};
const deadlineBadge = {
  fontFamily: FONT_MONO, fontWeight: 700, fontSize: 9.5, letterSpacing: 0.5,
  border: "1px solid", borderRadius: 6, padding: "3px 7px",
};
const chip = (on) => ({
  fontFamily: FONT_DISP, fontWeight: 600, fontSize: 11.5,
  padding: "6px 11px", borderRadius: 8,
  border: `1px solid ${on ? C.amber : C.line}`,
  background: on ? C.amberDim : "transparent",
  color: on ? C.text : C.muted, cursor: "pointer",
});
const planBtn = (on) => ({
  flex: 1, textAlign: "left", cursor: "pointer",
  borderRadius: 11, padding: "12px 13px",
  border: `1px solid ${on ? C.lane : C.line}`,
  background: on ? C.lane : "transparent",
  color: on ? C.asphalt : C.text,
});
const bottomNav = {
  position: "fixed", bottom: 0, left: 0, right: 0,
  background: "rgba(11,15,20,0.94)",
  borderTop: `1px solid ${C.line}`,
  backdropFilter: "blur(10px)",
  paddingBottom: "env(safe-area-inset-bottom, 0px)",
  zIndex: 40,
};
const navBtn = (on) => ({
  flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
  padding: "10px 0 9px", background: "transparent", border: "none",
  color: on ? C.green : C.faint, cursor: "pointer",
});
const tooltip = {
  background: C.surface2, border: `1px solid ${C.line}`, borderRadius: 9,
  fontFamily: FONT_MONO, fontSize: 12, color: C.text,
};
const toastStyle = {
  position: "fixed", bottom: 74, left: "50%", transform: "translateX(-50%)",
  background: C.surface2, border: `1px solid ${C.green}`, color: C.text,
  borderRadius: 10, padding: "9px 16px", fontFamily: FONT_DISP, fontWeight: 600, fontSize: 12.5,
  zIndex: 55, whiteSpace: "nowrap",
};
const celebrateBanner = {
  position: "fixed", top: 14, left: "50%", transform: "translateX(-50%)",
  background: C.greenDim, border: `1px solid ${C.green}`, color: C.text,
  borderRadius: 12, padding: "10px 18px", fontFamily: FONT_DISP, fontWeight: 700, fontSize: 14,
  display: "flex", alignItems: "center", gap: 8, zIndex: 61,
};
