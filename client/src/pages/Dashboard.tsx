import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  AreaChart, Area, ResponsiveContainer, Cell,
  ComposedChart, Line,
} from "recharts";
import {
  Trophy, TrendingDown, Clock, Ban, Percent,
  IndianRupee, AlertCircle, Users, Lightbulb, TrendingUp,
} from "lucide-react";
import { api } from "../api";
import type {
  OverviewStats, YearlyStats, BuyerStats, CompetitorStats,
  L1GapStats, FunnelStats, MonthlyStats, Tender,
} from "../types";

// ── Helpers ──────────────────────────────────────────────────────────
function fmtRs(n: number | null | undefined) {
  if (!n) return "—";
  if (n >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(2)} Cr`;
  if (n >= 1_00_000)    return `₹${(n / 1_00_000).toFixed(2)} L`;
  return `₹${n.toLocaleString("en-IN")}`;
}
function fmtDate(s: string | null) {
  if (!s) return "—";
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
}
function daysUntil(dateStr: string | null) {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / 86_400_000);
}

// ── Stat Card ─────────────────────────────────────────────────────────
function StatCard({
  label, value, sub, icon: Icon, color, trend,
}: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; color: string; trend?: { val: number; label: string };
}) {
  return (
    <div className="card p-5 flex items-start gap-4">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-slate-900 mt-0.5">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
        {trend && (
          <p className={`text-xs font-medium mt-1 ${trend.val >= 0 ? "text-emerald-600" : "text-rose-500"}`}>
            {trend.val >= 0 ? "▲" : "▼"} {Math.abs(trend.val)}% {trend.label}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Custom Tooltip ─────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="card p-3 text-xs space-y-1 shadow-lg border border-slate-100">
      <p className="font-semibold text-slate-700">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <span className="font-medium">{
            p.name === "Win Rate" ? `${p.value}%` : p.value
          }</span>
        </p>
      ))}
    </div>
  );
};

// ── Key Insights ───────────────────────────────────────────────────────
function KeyInsights({
  overview, yearly, competitors, l1gap,
}: {
  overview: OverviewStats;
  yearly: YearlyStats[];
  competitors: CompetitorStats[];
  l1gap: L1GapStats[];
}) {
  const insights: { text: string; type: "good" | "warn" | "info" }[] = [];

  const wr = overview.win_rate ?? 0;
  if (wr >= 50)       insights.push({ text: `Strong win rate of ${wr}% — above industry median.`, type: "good" });
  else if (wr >= 30)  insights.push({ text: `Win rate ${wr}% — room to improve pricing strategy.`, type: "warn" });
  else                insights.push({ text: `Win rate only ${wr}% — pricing or bid targeting needs review.`, type: "warn" });

  const latestYear = yearly.at(-1);
  const prevYear   = yearly.at(-2);
  if (latestYear && prevYear && latestYear.win_rate != null && prevYear.win_rate != null) {
    const delta = latestYear.win_rate - prevYear.win_rate;
    if (delta > 0)
      insights.push({ text: `Win rate improved +${delta.toFixed(1)}% vs last year (${latestYear.year}).`, type: "good" });
    else if (delta < 0)
      insights.push({ text: `Win rate fell ${delta.toFixed(1)}% vs last year — check ${latestYear.year} lost bids.`, type: "warn" });
  }

  if (competitors.length > 0) {
    const top = competitors[0];
    insights.push({
      text: `"${top.l1_bidder_name}" beat you ${top.times_beat_us} times — avg gap ${fmtRs(top.avg_our_price - top.avg_l1_price)} over-bid.`,
      type: "warn",
    });
  }

  if (l1gap.length > 0) {
    const avg = l1gap.reduce((s, r) => s + r.gap_pct, 0) / l1gap.length;
    insights.push({ text: `Avg over-bid gap on lost tenders: +${avg.toFixed(1)}% — consider tighter pricing.`, type: "info" });
  }

  if (overview.active > 10)
    insights.push({ text: `${overview.active} active tenders need follow-up or status update.`, type: "info" });

  return (
    <div className="card p-5">
      <h2 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
        <Lightbulb className="w-4 h-4 text-amber-500" /> Key Insights
      </h2>
      <div className="space-y-2">
        {insights.map((ins, i) => (
          <div key={i} className={`flex items-start gap-2.5 p-2.5 rounded-lg text-xs ${
            ins.type === "good" ? "bg-emerald-50 text-emerald-800"
            : ins.type === "warn" ? "bg-amber-50 text-amber-800"
            : "bg-blue-50 text-blue-800"
          }`}>
            <span className="mt-0.5 text-base leading-none">
              {ins.type === "good" ? "✅" : ins.type === "warn" ? "⚠️" : "ℹ️"}
            </span>
            <p>{ins.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────
export default function Dashboard() {
  const [overview,     setOverview]     = useState<OverviewStats | null>(null);
  const [yearly,       setYearly]       = useState<YearlyStats[]>([]);
  const [buyers,       setBuyers]       = useState<BuyerStats[]>([]);
  const [competitors,  setCompetitors]  = useState<CompetitorStats[]>([]);
  const [l1gap,        setL1gap]        = useState<L1GapStats[]>([]);
  const [funnel,       setFunnel]       = useState<FunnelStats[]>([]);
  const [monthly,      setMonthly]      = useState<MonthlyStats[]>([]);
  const [pipeline,     setPipeline]     = useState<Tender[]>([]);
  const [loading,      setLoading]      = useState(true);

  useEffect(() => {
    Promise.all([
      api.getOverview(),
      api.getYearly(),
      api.getBuyers(),
      api.getCompetitors(),
      api.getL1Gap(),
      api.getFunnel(),
      api.getMonthly(),
      api.getPipeline(),
    ]).then(([ov, yr, by, co, l1, fn, mo, pi]) => {
      setOverview(ov);
      setYearly(yr);
      setBuyers(by);
      setCompetitors(co);
      setL1gap(l1);
      setFunnel(fn);
      setMonthly(mo);
      setPipeline(pi);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-slate-500 text-sm mt-3">Loading dashboard…</p>
        </div>
      </div>
    );
  }

  const ov = overview!;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500 text-sm mt-0.5">GEM Tender Performance Overview</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-400">Last refreshed</p>
          <p className="text-xs font-medium text-slate-600">{new Date().toLocaleString("en-IN", { hour12: true, hour: "numeric", minute: "2-digit", day: "numeric", month: "short" })}</p>
        </div>
      </div>

      {/* ── Row 1: Stat Cards (8) ── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Total Tenders"   value={ov.total}           icon={FileIcon}      color="bg-indigo-500" />
        <StatCard label="Won"             value={ov.won}             icon={Trophy}        color="bg-emerald-500"
                  sub={`Win rate ${ov.win_rate ?? 0}%`} />
        <StatCard label="Lost"            value={ov.lost}            icon={TrendingDown}  color="bg-rose-500" />
        <StatCard label="Active"          value={ov.active}          icon={Clock}         color="bg-amber-500"
                  sub="In evaluation" />
        <StatCard label="Cancelled"       value={ov.cancelled}       icon={Ban}           color="bg-slate-500" />
        <StatCard label="Win Rate"        value={`${ov.win_rate ?? 0}%`} icon={Percent}   color="bg-blue-500"
                  sub="Won ÷ (Won + Lost)" />
        <StatCard label="Order Value Won" value={fmtRs(ov.total_order_value)} icon={IndianRupee} color="bg-violet-500"
                  sub="Total contracts won" />
        <StatCard label="Total Bid Value" value={fmtRs(ov.total_bid_value)} icon={TrendingUp} color="bg-cyan-500"
                  sub="All submitted bids" />
      </div>

      {/* ── Key Insights ── */}
      <KeyInsights
        overview={ov}
        yearly={yearly}
        competitors={competitors}
        l1gap={l1gap}
      />

      {/* ── Row 2: Yearly (with win rate line) + Funnel ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Win/Loss by Year with Win Rate overlay */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-slate-800 mb-4">Win / Loss by Year  <span className="text-xs font-normal text-slate-400 ml-1">— line = win rate %</span></h2>
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={yearly} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="year" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} unit="%" domain={[0, 100]} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar yAxisId="left" dataKey="won"     name="Won"      fill="#10b981" radius={[4,4,0,0]} />
              <Bar yAxisId="left" dataKey="lost"    name="Lost"     fill="#f43f5e" radius={[4,4,0,0]} />
              <Bar yAxisId="left" dataKey="active"  name="Active"   fill="#f59e0b" radius={[4,4,0,0]} />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="win_rate"
                name="Win Rate"
                stroke="#6366f1"
                strokeWidth={2.5}
                dot={{ r: 4, fill: "#6366f1" }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Bid Status Funnel */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-slate-800 mb-4">Bid Status Distribution</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={funnel.slice(0, 8)} layout="vertical" barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="status" type="category" tick={{ fontSize: 10 }} width={130} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" name="Count" radius={[0,4,4,0]}>
                {funnel.slice(0,8).map((_, i) => (
                  <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Row 3: Buyers + L1 Gap ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Top Buyers */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Users className="w-4 h-4 text-slate-400" /> Top Buyers by Volume
          </h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={buyers.slice(0, 8)} layout="vertical" barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="buyer_name" type="category" tick={{ fontSize: 10 }} width={160}
                     tickFormatter={(v) => v?.length > 22 ? v.substring(0, 22) + "…" : v} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="total_tenders" name="Total" fill="#6366f1" radius={[0,4,4,0]} />
              <Bar dataKey="won"           name="Won"   fill="#10b981" radius={[0,4,4,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* L1 Gap Chart */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-slate-800 mb-1 flex items-center gap-2">
            L1 Gap Analysis
            <span className="text-xs font-normal text-slate-400">(lost tenders — % above L1)</span>
          </h2>
          {l1gap.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-slate-400 text-sm">No L1 data available</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={l1gap.slice(0, 15)} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="tender_id" tick={false} />
                <YAxis tick={{ fontSize: 11 }} unit="%" />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload as L1GapStats;
                    return (
                      <div className="card p-3 text-xs space-y-1 shadow-lg max-w-xs border border-slate-100">
                        <p className="font-semibold text-slate-700 truncate">{d.tender_id}</p>
                        <p className="text-slate-500 truncate">{d.product_desc}</p>
                        <p>Our bid: <span className="font-medium">{fmtRs(d.our_bid_price)}</span></p>
                        <p>L1 bid: <span className="font-medium text-emerald-600">{fmtRs(d.l1_bid_price)}</span></p>
                        <p>Gap: <span className="font-medium text-rose-600">+{d.gap_pct}%</span></p>
                        {d.l1_bidder_name && <p>Winner: <span className="font-medium">{d.l1_bidder_name}</span></p>}
                      </div>
                    );
                  }}
                />
                <Bar dataKey="gap_pct" name="Gap %" radius={[4,4,0,0]}>
                  {l1gap.slice(0,15).map((d, i) => (
                    <Cell key={i} fill={d.gap_pct > 20 ? "#f43f5e" : d.gap_pct > 10 ? "#f59e0b" : "#6366f1"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Row 4: Monthly Revenue ── */}
      {monthly.length > 0 && (
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <IndianRupee className="w-4 h-4 text-slate-400" /> Won Contract Value Over Time
          </h2>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={monthly}>
              <defs>
                <linearGradient id="valGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => fmtRs(v)} />
              <Tooltip
                formatter={(v: any) => [fmtRs(v), "Contract Value"]}
                labelStyle={{ fontSize: 11 }}
                contentStyle={{ fontSize: 11 }}
              />
              <Area dataKey="total_value" name="Value" stroke="#6366f1" fill="url(#valGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Row 5: Pipeline + Competitors ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Pending Pipeline */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500" /> Active Tenders — Action Required
          </h2>
          {pipeline.length === 0 ? (
            <p className="text-slate-400 text-sm">No active tenders.</p>
          ) : (
            <div className="space-y-2">
              {pipeline.slice(0, 8).map((t) => {
                const days = daysUntil(t.end_date);
                return (
                  <div key={t.id} className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-slate-50 border border-slate-100">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-mono text-indigo-600 font-medium">{t.tender_id}</p>
                      <p className="text-xs text-slate-600 truncate mt-0.5">
                        {t.buyer_name} · {t.product_desc?.substring(0, 40)}…
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">{t.status}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`text-xs font-medium ${
                        days == null ? "text-slate-400"
                        : days < 0   ? "text-slate-400"
                        : days < 7   ? "text-rose-600"
                        : days < 30  ? "text-amber-600"
                        : "text-slate-500"
                      }`}>
                        {days == null ? "No date"
                        : days < 0   ? "Expired"
                        : `${days}d left`}
                      </p>
                      <p className="text-xs text-slate-400">{fmtDate(t.end_date)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Competitors */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-slate-800 mb-3">Top Competitors (Beat Us Most)</h2>
          {competitors.length === 0 ? (
            <p className="text-slate-400 text-sm">No competitor data yet.</p>
          ) : (
            <div className="space-y-3">
              {competitors.slice(0, 8).map((c, i) => {
                const priceAdv = c.avg_our_price && c.avg_l1_price
                  ? ((c.avg_our_price - c.avg_l1_price) / c.avg_l1_price * 100).toFixed(1)
                  : null;
                return (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-xs text-slate-400 w-4">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium text-slate-700 truncate">{c.l1_bidder_name}</p>
                        {priceAdv && (
                          <span className="text-xs text-rose-500 font-medium ml-2 flex-shrink-0">
                            +{priceAdv}% over-bid
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <div className="flex-1 bg-slate-100 rounded-full h-1.5">
                          <div
                            className="bg-rose-500 h-1.5 rounded-full"
                            style={{ width: `${Math.min(100, (c.times_beat_us / (competitors[0]?.times_beat_us || 1)) * 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-500 w-12 text-right">
                          {c.times_beat_us}× won
                        </span>
                      </div>
                      {c.avg_l1_price && (
                        <p className="text-xs text-slate-400 mt-0.5">
                          Avg L1: {fmtRs(c.avg_l1_price)} · Our avg: {fmtRs(c.avg_our_price)}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// placeholder icon
function FileIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

const PALETTE = [
  "#6366f1","#10b981","#f59e0b","#f43f5e","#3b82f6",
  "#8b5cf6","#06b6d4","#84cc16",
];
