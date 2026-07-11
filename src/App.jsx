import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Home, TrendingUp, Wallet, BarChart3, Settings as SettingsIcon,
  Plus, Check, AlertTriangle, Download, Upload, Car, Flag, Target,
  PiggyBank, Receipt, Trash2, X, ChevronRight, Zap, Shield, Gauge,
  Search, ArrowUpDown, Lightbulb, Pencil, Save
} from "lucide-react";
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine
} from "recharts";

/* ------------------------------------------------------------------ */
/*  Palette — "cockpit at night". Custom hexes via inline styles       */
/*  (artifact Tailwind has no JIT, so arbitrary values won't compile). */
/* ------------------------------------------------------------------ */
const C = {
  asphalt: "#0B0F14",     // page
  surface: "#141A22",     // cards
  surface2: "#1B222C",    // raised
  line: "#26303C",        // hairline
  lineSoft: "#1E2732",
  text: "#E8EDF2",
  muted: "#8A97A6",
  faint: "#5B6875",
  green: "#34D399",
  greenDim: "#1E5C46",
  red: "#F87171",
  redDim: "#5C2323",
  amber: "#FBBF24",
  amberDim: "#5A4410",
  lane: "#FACC15",        // road lane-marking yellow (signature accent)
  blue: "#60A5FA",
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
  { id: 1, name: "Credit Card 01", balance: 508.26, min: null, deadline: null, type: "Interest-bearing", group: "card" },
  { id: 2, name: "Credit Card 02", balance: 400.0, min: null, deadline: null, type: "Interest-bearing", group: "card" },
  { id: 3, name: "Credit Card 03", balance: 500.0, min: null, deadline: null, type: "Interest-bearing", group: "card" },
  { id: 4, name: "Credit Card 04", balance: 280.0, min: null, deadline: null, type: "Interest-bearing", group: "card" },
  { id: 5, name: "Lender Loan 01", balance: 2173.24, min: 168, deadline: null, type: "Fixed installment", group: "loan" },
  { id: 6, name: "Lender Loan 02", balance: 750.0, min: 90, deadline: "2026-07-17", type: "Fixed installment", group: "loan" },
  { id: 7, name: "Anusha (personal)", balance: 2200.0, min: null, deadline: "2026-08-15", type: "Personal, no interest", group: "personal" },
  { id: 8, name: "Mom (personal)", balance: 800.0, min: null, deadline: null, type: "Personal, no interest", group: "personal" },
  { id: 9, name: "Sister (personal)", balance: 1500.0, min: null, deadline: null, type: "Personal, no interest", group: "personal" },
  { id: 10, name: "Dad (personal)", balance: 1500.0, min: null, deadline: null, type: "Personal, no interest", group: "personal" },
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

/* ------------------------------------------------------------------ */
/*  Persistence is handled by cloudStore.js. It always keeps a local  */
/*  backup and syncs to Supabase when cloud environment variables exist. */
/* ------------------------------------------------------------------ */

/* ================================================================== */
/*  APP                                                                */
/* ================================================================== */
export default function App() {
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState("home");
  const [debts, setDebts] = useState(seedDebts);
  const [earnings, setEarnings] = useState([]); // {id,date,gross,other,note}
  const [expenses, setExpenses] = useState([]); // {id,date,amount,category,note}
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [buffer, setBuffer] = useState(0);
  const [celebrate, setCelebrate] = useState(null);
  const [toast, setToast] = useState(null);
  const [syncStatus, setSyncStatus] = useState(cloudEnabled ? "connecting" : "local");
  const toastTimer = useRef(null);

  /* ---- inject fonts once ---- */
  useEffect(() => {
    const id = "dd-fonts";
    if (document.getElementById(id)) return;
    const l = document.createElement("link");
    l.id = id;
    l.rel = "stylesheet";
    l.href =
      "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap";
    document.head.appendChild(l);
  }, []);

  /* ---- load once ---- */
  useEffect(() => {
    (async () => {
      try {
        const { state: s, source } = await loadAppState();
        if (s) {
          if (s.debts) setDebts(s.debts);
          if (s.earnings) setEarnings(s.earnings);
          if (s.expenses) setExpenses(s.expenses);
          if (s.settings) setSettings({ ...DEFAULT_SETTINGS, ...s.settings });
          if (typeof s.buffer === "number") setBuffer(s.buffer);
        }
        setSyncStatus(source === "cloud" ? "synced" : cloudEnabled ? "ready" : "local");
      } catch (error) {
        console.error(error);
        setSyncStatus("error");
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  /* ---- autosave (debounced) whole snapshot into one key ---- */
  const saveTimer = useRef(null);
  useEffect(() => {
    if (!loaded) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSyncStatus(cloudEnabled ? "saving" : "local");
    saveTimer.current = setTimeout(async () => {
      const result = await saveAppState({ debts, earnings, expenses, settings, buffer });
      setSyncStatus(result.cloud ? "synced" : cloudEnabled ? "error" : "local");
    }, 700);
    return () => saveTimer.current && clearTimeout(saveTimer.current);
  }, [debts, earnings, expenses, settings, buffer, loaded]);

  const flash = (msg) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  };

  /* ---------------- derived numbers ---------------- */
  const activeDebts = debts.filter((d) => !d.paid && d.balance > 0.005);
  const originalTotal = debts.reduce((s, d) => s + asMoney(d.originalBalance ?? d.balance), 0) || INITIAL_TOTAL;
  const remainingDebt = debts.reduce((s, d) => s + asMoney(d.balance), 0);
  const pctPaid = Math.min(100, Math.max(0, ((originalTotal - remainingDebt) / originalTotal) * 100));

  const today = todayISO();
  const curMonth = monthKey(today);
  const plan = PLANS[settings.activePlan];
  const planMonth = plan.months[curMonth] || null;

  const incomeOf = (e) => (Number(e.gross) || 0) + (Number(e.other) || 0);
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

  const monthTarget = planMonth ? planMonth.target : 0;
  const baseDaily = planMonth ? planMonth.daily : 0;
  const remainingMonthTarget = Math.max(0, monthTarget - earnedThisMonth);
  const adjustedDaily = planMonth ? remainingMonthTarget / daysRemainingIncl : 0;
  const runningSurplus = earnedThisMonth - baseDaily * daysElapsed;
  const dailyAvgMonth = daysElapsed > 0 ? earnedThisMonth / daysElapsed : 0;
  const projectedMonthEnd = dailyAvgMonth * dim;

  /* today's logged income */
  const earnedToday = earnings
    .filter((e) => e.date === today)
    .reduce((s, e) => s + incomeOf(e), 0);

  /* overall pace for debt-free projection */
  const loggedDays = new Set(earnings.map((e) => e.date)).size;
  const overallDailyAvg = loggedDays > 0 ? totalIncome / loggedDays : baseDaily;
  const expenseDailyAvg = loggedDays > 0 ? totalExpenses / loggedDays : settings.monthlyBaseline / 30.44;
  const monthlyCapacity = Math.max(0, (overallDailyAvg * (1 - settings.taxRate) - expenseDailyAvg) * 30.44);
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

  /* deadline alerts */
  const alerts = activeDebts
    .filter((d) => d.deadline)
    .map((d) => ({ d, days: daysBetween(today, d.deadline) }))
    .filter((x) => x.days <= 10)
    .sort((a, b) => a.days - b.days);

  /* ---------------- actions ---------------- */
  const addEarning = ({ date, gross, other, note }) => {
    const entry = { id: uid(), date: date || today, gross: asMoney(gross), other: asMoney(other), note: (note || "").trim() };
    if (entry.gross + entry.other <= 0) return flash("Enter an income amount");
    setEarnings((p) => [entry, ...p]);
    flash("Earnings logged");
  };
  const addExpense = ({ date, amount, category, note }) => {
    const value = asMoney(amount);
    if (value <= 0) return flash("Enter an expense amount");
    setExpenses((p) => [{ id: uid(), date: date || today, amount: value, category: category || "Other", note: (note || "").trim() }, ...p]);
    flash("Expense logged");
  };
  const removeEntry = (kind, id) => {
    if (kind === "earn") setEarnings((p) => p.filter((e) => e.id !== id));
    else setExpenses((p) => p.filter((e) => e.id !== id));
  };

  const addDebt = ({ name, balance, min, deadline, type, group }) => {
    const cleanName = (name || "").trim();
    const cleanBalance = asMoney(balance);
    if (!cleanName) return flash("Enter a debt name");
    if (cleanBalance <= 0) return flash("Enter the current balance");
    const debt = {
      id: uid(),
      name: cleanName,
      balance: cleanBalance,
      originalBalance: cleanBalance,
      min: asMoney(min) || null,
      deadline: deadline || null,
      type: (type || "Interest-bearing").trim(),
      group: ["card", "loan", "personal"].includes(group) ? group : "card",
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

  const logPayment = (debtId, amount) => {
    const amt = +amount;
    if (!amt || amt <= 0) return;
    setDebts((prev) =>
      prev.map((d) => {
        if (d.id !== debtId) return d;
        const applied = Math.min(asMoney(d.balance), amt);
        const nb = Math.max(0, +(d.balance - applied).toFixed(2));
        const nowPaid = nb <= 0.005;
        if (nowPaid && !d.paid) {
          setCelebrate(d.name);
          setTimeout(() => setCelebrate(null), 2900);
        }
        return {
          ...d,
          balance: nb,
          paid: nowPaid,
          payments: [{ id: uid(), date: today, amount: applied }, ...(d.payments || [])],
        };
      })
    );
    flash("Payment recorded");
  };

  const fundBuffer = (amt) => {
    const a = +amt;
    if (!a) return;
    setBuffer((b) => Math.max(0, b + a));
    flash(a > 0 ? "Buffer funded" : "Buffer adjusted");
  };

  /* export / import */
  const exportJSON = () => {
    const blob = new Blob(
      [JSON.stringify({ debts, earnings, expenses, settings, buffer, exportedAt: new Date().toISOString() }, null, 2)],
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
  const importInputRef = useRef(null);
  const importJSON = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const s = JSON.parse(reader.result);
        if (!s || typeof s !== "object" || !Array.isArray(s.debts)) throw new Error("Invalid backup");
        setDebts(s.debts.map((d) => ({ ...d, balance: asMoney(d.balance), originalBalance: asMoney(d.originalBalance ?? d.balance), payments: Array.isArray(d.payments) ? d.payments : [], paid: asMoney(d.balance) <= 0.005 })));
        if (Array.isArray(s.earnings)) setEarnings(s.earnings);
        if (Array.isArray(s.expenses)) setExpenses(s.expenses);
        if (s.settings) setSettings({ ...DEFAULT_SETTINGS, ...s.settings });
        if (typeof s.buffer === "number") setBuffer(s.buffer);
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
    setSettings(DEFAULT_SETTINGS);
    setBuffer(0);
    flash("Reset to starting data");
  };

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
    debts.forEach((d) => d.payments.forEach((p) => pays.push({ date: p.date, amount: p.amount })));
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
  }, [debts]);

  /* ---------------- render ---------------- */
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
          <Check size={18} /> {celebrate} — paid off! 🎉
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
            {alerts.length > 0 && <AlertsBanner alerts={alerts} />}
            <Hero
              remaining={remainingDebt}
              originalTotal={originalTotal}
              pctPaid={pctPaid}
              debts={debts}
              projectedFreeISO={projectedFreeISO}
              planFreeISO={plan.freeDate}
              paceDelta={paceDelta}
            />
            <SmartPayoffCard debts={debts} available={availableAfterTaxAndExpenses} buffer={buffer} bufferGoal={settings.bufferGoal} />
            <DailyTargetCard
              planMonth={planMonth}
              earnedToday={earnedToday}
              baseDaily={baseDaily}
              adjustedDaily={adjustedDaily}
              runningSurplus={runningSurplus}
              daysRemaining={daysRemainingIncl}
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
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <TaxCard taxReserve={taxReserve} rate={settings.taxRate} totalIncome={totalIncome} />
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
            onEarn={addEarning}
            onExpense={addExpense}
            onRemove={removeEntry}
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
            onImportClick={() => importInputRef.current?.click()}
            onReset={resetAll}
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

function AlertsBanner({ alerts }) {
  return (
    <div style={{ marginBottom: 12 }}>
      {alerts.map(({ d, days }) => {
        const urgent = days <= 7;
        return (
          <div
            key={d.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: urgent ? C.redDim : C.amberDim,
              border: `1px solid ${urgent ? C.red : C.amber}`,
              borderRadius: 12,
              padding: "11px 13px",
              marginBottom: 8,
            }}
          >
            <AlertTriangle size={17} color={urgent ? C.red : C.amber} />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: FONT_DISP, fontWeight: 600, fontSize: 13.5, color: C.text }}>
                {d.name} due {days <= 0 ? "today" : `in ${days} day${days === 1 ? "" : "s"}`}
              </div>
              <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.muted }}>
                Pay in full · {usd(d.balance)} remaining · {monthLabel(d.deadline)}
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
    <section style={{ ...card, padding: "18px 16px 16px", position: "relative", overflow: "hidden" }}>
      <div style={{ fontFamily: FONT_MONO, fontSize: 10.5, letterSpacing: 1.5, color: C.faint }}>
        DISTANCE REMAINING
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 10, marginTop: 4 }}>
        <div style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 40, letterSpacing: -1.5, color: C.text, lineHeight: 0.95 }}>
          {usd0(remaining)}
        </div>
        <div style={{ marginBottom: 6 }}>
          <span style={{ fontFamily: FONT_DISP, fontWeight: 700, fontSize: 15, color: C.green }}>
            {pctPaid.toFixed(1)}%
          </span>
          <span style={{ fontFamily: FONT_MONO, fontSize: 10.5, color: C.faint, marginLeft: 5 }}>paid</span>
        </div>
      </div>

      {/* signature: the road */}
      <Road pct={pctPaid} />

      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
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
            opacity: 0.55,
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


function SmartPayoffCard({ debts, available, buffer, bufferGoal }) {
  const active = debts.filter((d) => !d.paid && asMoney(d.balance) > 0.005);
  if (!active.length) return null;
  const ranked = [...active].sort((a, b) => {
    const aUrgent = a.deadline ? parseISO(a.deadline).getTime() : Infinity;
    const bUrgent = b.deadline ? parseISO(b.deadline).getTime() : Infinity;
    if (aUrgent !== bUrgent) return aUrgent - bUrgent;
    if (a.group !== b.group) return a.group === "card" ? -1 : b.group === "card" ? 1 : 0;
    return a.balance - b.balance;
  });
  const next = ranked[0];
  const bufferGap = Math.max(0, asMoney(bufferGoal) - asMoney(buffer));
  const safeToPay = Math.max(0, available - bufferGap);
  const suggested = Math.min(asMoney(next.balance), safeToPay);
  return (
    <section style={{ ...card, borderColor: C.blue, background: `linear-gradient(145deg, ${C.surface}, ${C.surface2})` }}>
      <div style={rowBetween}>
        <SectionLabel icon={Lightbulb}>SMART NEXT MOVE</SectionLabel>
        <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: C.blue }}>AUTO PRIORITY</span>
      </div>
      <div style={{ marginTop: 9, fontFamily: FONT_DISP, fontWeight: 700, fontSize: 15, color: C.text }}>
        Focus on {next.name}
      </div>
      <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.muted, lineHeight: 1.55, marginTop: 4 }}>
        {bufferGap > 0
          ? `First add ${usd0(bufferGap)} to your emergency buffer. Then direct extra cash to this debt.`
          : suggested > 0
            ? `You currently have about ${usd0(suggested)} available after logged taxes and expenses.`
            : "Keep logging income and expenses to unlock a safe payment suggestion."}
      </div>
    </section>
  );
}

function DailyTargetCard({ planMonth, earnedToday, baseDaily, adjustedDaily, runningSurplus, daysRemaining }) {
  if (!planMonth) {
    return (
      <section style={card}>
        <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.muted }}>
          No plan target for this month — you're outside the payoff window. Keep logging; the debt list is still live.
        </div>
      </section>
    );
  }
  const hit = earnedToday >= adjustedDaily;
  const ahead = runningSurplus >= 0;
  return (
    <section style={card}>
      <div style={rowBetween}>
        <SectionLabel icon={Gauge}>TODAY'S TARGET</SectionLabel>
        <span style={{ fontFamily: FONT_MONO, fontSize: 10.5, color: C.faint }}>{daysRemaining} days left this month</span>
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 14, marginTop: 8 }}>
        <div>
          <div style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 30, color: hit ? C.green : C.text, letterSpacing: -1 }}>
            {usd0(adjustedDaily)}
          </div>
          <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: C.faint, marginTop: 2 }}>
            adjusted · base was {usd0(baseDaily)}
          </div>
        </div>
        <div style={{ marginLeft: "auto", textAlign: "right" }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: C.faint }}>EARNED TODAY</div>
          <div style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 20, color: hit ? C.green : C.text }}>
            {usd0(earnedToday)}
          </div>
        </div>
      </div>
      <div
        style={{
          marginTop: 12,
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: ahead ? C.greenDim : C.redDim,
          border: `1px solid ${ahead ? C.green : C.red}`,
          borderRadius: 9,
          padding: "8px 11px",
        }}
      >
        {ahead ? <Zap size={15} color={C.green} /> : <TrendingUp size={15} color={C.red} />}
        <span style={{ fontFamily: FONT_MONO, fontSize: 11.5, color: C.text }}>
          {ahead ? "Ahead of pace by" : "Behind pace by"} {usd0(Math.abs(runningSurplus))} this month
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

function TaxCard({ taxReserve, rate, totalIncome }) {
  return (
    <div style={{ ...card, marginBottom: 0 }}>
      <SectionLabel icon={Receipt}>TAX RESERVE</SectionLabel>
      <div style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 22, color: C.amber, marginTop: 6 }}>
        {usd0(taxReserve)}
      </div>
      <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: C.faint, marginTop: 3 }}>
        {(rate * 100).toFixed(0)}% of {usd0(totalIncome)} 1099 income
      </div>
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

function EarningForm({ onSubmit }) {
  const [date, setDate] = useState(todayISO());
  const [gross, setGross] = useState("");
  const [other, setOther] = useState("");
  const [note, setNote] = useState("");
  const submit = () => {
    if (!gross && !other) return;
    onSubmit({ date, gross, other, note });
    setGross(""); setOther(""); setNote("");
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
      <Field label="Date">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={input} />
      </Field>
      <div style={{ display: "flex", gap: 9 }}>
        <Field label="Uber gross" flex>
          <input value={gross} onChange={(e) => setGross(e.target.value)} placeholder="$0.00" inputMode="decimal" style={input} />
        </Field>
        <Field label="Other income" flex>
          <input value={other} onChange={(e) => setOther(e.target.value)} placeholder="AI work…" inputMode="decimal" style={input} />
        </Field>
      </div>
      <Field label="Note (optional)">
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Busy Friday night" style={input} />
      </Field>
      <button onClick={submit} style={btnPrimary}><Plus size={15} /> Save earnings</button>
    </div>
  );
}

const EXP_CATS = ["Gas", "Rent", "Food", "Car", "Phone", "Other"];
function ExpenseForm({ onSubmit }) {
  const [date, setDate] = useState(todayISO());
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Gas");
  const [note, setNote] = useState("");
  const submit = () => {
    if (!amount) return;
    onSubmit({ date, amount, category, note });
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
            <button key={c} onClick={() => setCategory(c)} style={chip(category === c)}>{c}</button>
          ))}
        </div>
      </Field>
      <Field label="Note (optional)">
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Chevron fill-up" style={input} />
      </Field>
      <button onClick={submit} style={{ ...btnPrimary, background: C.amber, borderColor: C.amber }}>
        <Plus size={15} /> Save expense
      </button>
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
  const submit = () => onSubmit({ name, balance, min, deadline, group, type });
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
          <select value={group} onChange={(e) => setGroup(e.target.value)} style={input}>
            <option value="card">Credit card</option><option value="loan">Loan</option><option value="personal">Personal debt</option>
          </select>
        </Field>
        <Field label="Due date / payoff deadline"><input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} style={input} /></Field>
        <div style={{ gridColumn: "1 / -1" }}><Field label="Description"><input value={type} onChange={(e) => setType(e.target.value)} placeholder="Interest-bearing, 24.99% APR" style={input} /></Field></div>
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
  const [confirmDelete, setConfirmDelete] = useState(false);
  const original = asMoney(d.originalBalance) || asMoney(d.balance) || 1;
  const pct = Math.min(100, Math.max(0, ((original - d.balance) / original) * 100));
  const days = d.deadline ? daysBetween(today, d.deadline) : null;
  const urgent = days != null && days <= 7 && !d.paid;
  const soon = days != null && days <= 10 && !d.paid;
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
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 8 }}>
        <span style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 21, color: d.paid ? C.green : C.text }}>{usd(d.balance)}</span>
        <span style={{ fontFamily: FONT_MONO, fontSize: 10.5, color: C.faint }}>of {usd(original)}</span>
        {d.min && <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: C.faint, marginLeft: "auto" }}>min {usd0(d.min)}/mo</span>}
      </div>
      <div style={{ ...progTrack, height: 7, marginTop: 9 }}><div style={{ ...progFill, width: `${pct}%`, background: d.paid ? C.green : d.group === "personal" ? C.blue : C.green }} /></div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 9 }}>
        <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: C.faint }}>{d.type}</span>
        {!d.paid && (open ? (
          <div style={{ display: "flex", gap: 6 }}>
            <input value={amt} onChange={(e) => setAmt(e.target.value)} placeholder="$ amount" inputMode="decimal" style={{ ...input, width: 92, padding: "6px 8px", fontSize: 12 }} />
            <button onClick={() => { onPay(d.id, amt); setAmt(""); setOpen(false); }} style={{ ...btnSm, background: C.green, color: C.asphalt, borderColor: C.green }}><Check size={13} /></button>
            <button onClick={() => setOpen(false)} style={btnSm}><X size={13} /></button>
          </div>
        ) : <button onClick={() => setOpen(true)} style={btnSm}><Plus size={12} /> Log payment</button>)}
      </div>
      {(d.payments || []).length > 0 && <div style={{ marginTop: 9, borderTop: `1px solid ${C.lineSoft}`, paddingTop: 7 }}>{d.payments.slice(0, 3).map((p) => <div key={p.id} style={{ display: "flex", justifyContent: "space-between", fontFamily: FONT_MONO, fontSize: 10.5, color: C.muted, marginTop: 2 }}><span>{p.date}</span><span style={{ color: C.green }}>−{usd(p.amount)}</span></div>)}</div>}
      <div style={{ borderTop: `1px solid ${C.lineSoft}`, marginTop: 10, paddingTop: 8 }}>
        {confirmDelete ? <div style={{ display: "flex", alignItems: "center", gap: 7 }}><span style={{ flex: 1, fontFamily: FONT_MONO, fontSize: 10.5, color: C.red }}>Delete this debt and payment history?</span><button onClick={onDelete} style={{ ...btnSm, color: C.red, borderColor: C.redDim }}>Delete</button><button onClick={() => setConfirmDelete(false)} style={btnSm}>Cancel</button></div> : <button onClick={() => setConfirmDelete(true)} style={{ ...btnSm, border: "none", background: "transparent", color: C.faint, paddingLeft: 0 }}><Trash2 size={13} /> Delete debt</button>}
      </div>
    </div>
  );
}

/* ---------- Money view (history + logging) ---------- */
function MoneyView({ earnings, expenses, onEarn, onExpense, onRemove }) {
  const [mode, setMode] = useState("earn");
  const feed = [
    ...earnings.map((e) => ({ ...e, kind: "earn", amt: (Number(e.gross) || 0) + (Number(e.other) || 0) })),
    ...expenses.map((e) => ({ ...e, kind: "spend", amt: Number(e.amount) || 0 })),
  ].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id));

  return (
    <div>
      <section style={card}>
        <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
          <TogglePill on={mode === "earn"} onClick={() => setMode("earn")}>Log earnings</TogglePill>
          <TogglePill on={mode === "spend"} onClick={() => setMode("spend")}>Log expense</TogglePill>
        </div>
        {mode === "earn" ? <EarningForm onSubmit={onEarn} /> : <ExpenseForm onSubmit={onExpense} />}
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
function SettingsView({ settings, setSettings, onExport, onImportClick, onReset }) {
  const [confirmReset, setConfirmReset] = useState(false);
  const set = (k, v) => setSettings((s) => ({ ...s, [k]: v }));
  return (
    <div>
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
      </section>

      <SectionHeading>Baselines</SectionHeading>
      <section style={card}>
        <NumberRow label="Monthly living cost" hint="Rent + car + living" value={settings.monthlyBaseline} onChange={(v) => set("monthlyBaseline", v)} prefix="$" />
        <NumberRow label="Tax set-aside rate" hint="Auto-reserved from income" value={Math.round(settings.taxRate * 100)} onChange={(v) => set("taxRate", (Number(v) || 0) / 100)} suffix="%" />
        <NumberRow label="Emergency buffer goal" hint="Car-repair reserve" value={settings.bufferGoal} onChange={(v) => set("bufferGoal", v)} prefix="$" last />
      </section>

      <SectionHeading>Backup</SectionHeading>
      <section style={card}>
        <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.muted, marginBottom: 11, lineHeight: 1.5 }}>
          Your data saves automatically on this device. Export a JSON file to keep a portable backup or move to another device.
        </div>
        <div style={{ display: "flex", gap: 9 }}>
          <button onClick={onExport} style={{ ...btnPrimary, flex: 1 }}><Download size={15} /> Export JSON</button>
          <button onClick={onImportClick} style={{ ...btnGhost, flex: 1 }}><Upload size={15} /> Import JSON</button>
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
  background: C.asphalt,
  minHeight: "100vh",
  color: C.text,
  fontFamily: FONT_BODY,
  WebkitFontSmoothing: "antialiased",
};
const card = {
  background: C.surface,
  border: `1px solid ${C.line}`,
  borderRadius: 14,
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
