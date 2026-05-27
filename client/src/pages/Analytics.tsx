import { useEffect, useState } from "react";
import {
  ComposedChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, Cell, PieChart, Pie, RadarChart,
  PolarGrid, PolarAngleAxis, Radar,
} from "recharts";
import { TrendingUp, Target, BarChart2, Users } from "lucide-react";
import { api } from "../api";
import type { BuyerStats, WinTrendStats, ProductStats, TenderTypeStats } from "../types";

// ── Helpers ───────────────────────────────────────────────────────────
function fmtRs(n: number | null | undefined) {
  if (!n) return "—";
  if (n >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(2)} Cr`;
  if (n >= 1_00_000)    return `₹${(n / 1_00_000).toFixed(2)} L`;
  return `₹${n.toLocaleString("en-IN")}`;
}

const PALETTE = [
  "#6366f1","#10b981","#f59e0b","#f43f5e","#3b82f6",
  "#8b5cf6","#06b6d4","#84cc16","#f97316","#ec4899",
  "#14b8a6","#a855f7",
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-100 rounded-xl p-3 shadow-xl text-xs space-y-1">
      <p className="font-semibold text-slate-700">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color ?? p.fill }}>
          {p.name}: <span className="font-medium">
            {p.name.toLowerCase().includes("rate") || p.name === "Win %"
              ? `${p.value}%`
              : p.name.toLowerCase().includes("value")
              ? fmtRs(p.value)
              : p.value}
          </span>
        </p>
      ))}
    </div>
  );
};

// ── Win Rate Trend ────────────────────────────────────────────────────
function WinRateTrendChart({ data }: { data: WinTrendStats[] }) {
  if (data.length === 0) return <Empty />;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="month" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
        <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
        <YAxis yAxisId="right" orientation="right" unit="%" tick={{ fontSize: 11 }} domain={[0, 100]} />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar yAxisId="left" dataKey="won"  name="Won"  fill="#10b981" radius={[3,3,0,0]} />
        <Bar yAxisId="left" dataKey="lost" name="Lost" fill="#f43f5e" radius={[3,3,0,0]} />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="win_rate"
          name="Win Rate %"
          stroke="#6366f1"
          strokeWidth={2.5}
          dot={{ r: 3 }}
          activeDot={{ r: 5 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// ── Buyer Chart ───────────────────────────────────────────────────────
function BuyerChart({ data }: { data: BuyerStats[] }) {
  if (data.length === 0) return <Empty />;
  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data.slice(0, 10)} layout="vertical" barCategoryGap="25%">
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis type="number" tick={{ fontSize: 11 }} />
        <YAxis
          dataKey="buyer_name"
          type="category"
          tick={{ fontSize: 10 }}
          width={170}
          tickFormatter={(v) => v?.length > 26 ? v.substring(0, 26) + "…" : v}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="total_tenders" name="Total"  fill="#6366f1" radius={[0,3,3,0]} />
        <Bar dataKey="won"           name="Won"    fill="#10b981" radius={[0,3,3,0]} />
        <Bar dataKey="lost"          name="Lost"   fill="#f43f5e" radius={[0,3,3,0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Tender Type Donut ─────────────────────────────────────────────────
function TenderTypePie({ data }: { data: TenderTypeStats[] }) {
  if (data.length === 0) return <Empty />;
  return (
    <div className="flex flex-col items-center gap-4">
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={90}
            dataKey="total"
            nameKey="tender_type"
            label={({ tender_type, percent }) => `${tender_type} ${(percent * 100).toFixed(0)}%`}
            labelLine={false}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(v, name) => [v, name]} />
        </PieChart>
      </ResponsiveContainer>
      <div className="w-full space-y-2">
        {data.map((d, i) => (
          <div key={d.tender_type} className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: PALETTE[i] }} />
            <div className="flex-1">
              <div className="flex justify-between text-xs">
                <span className="font-medium text-slate-700">{d.tender_type}</span>
                <span className="text-slate-500">{d.total} tenders</span>
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                <div className="flex-1 bg-slate-100 rounded-full h-1.5">
                  <div className="h-1.5 rounded-full bg-emerald-500"
                    style={{ width: `${d.win_rate ?? 0}%` }} />
                </div>
                <span className="text-xs text-slate-500">{d.win_rate ?? 0}% win</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Products Radar ────────────────────────────────────────────────────
function ProductsRadar({ data }: { data: ProductStats[] }) {
  if (data.length === 0) return <Empty />;
  const radarData = data.slice(0, 8).map((d) => ({
    product: d.product.substring(0, 20),
    win_rate: d.win_rate ?? 0,
  }));
  return (
    <ResponsiveContainer width="100%" height={260}>
      <RadarChart data={radarData}>
        <PolarGrid />
        <PolarAngleAxis dataKey="product" tick={{ fontSize: 9 }} />
        <Radar
          name="Win Rate %"
          dataKey="win_rate"
          stroke="#6366f1"
          fill="#6366f1"
          fillOpacity={0.25}
        />
        <Tooltip />
      </RadarChart>
    </ResponsiveContainer>
  );
}

// ── Products Table ────────────────────────────────────────────────────
function ProductsTable({ data }: { data: ProductStats[] }) {
  if (data.length === 0) return <Empty />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            <th className="px-3 py-2.5 text-left font-semibold text-slate-500 uppercase tracking-wide">Product</th>
            <th className="px-3 py-2.5 text-right font-semibold text-slate-500 uppercase tracking-wide">Total</th>
            <th className="px-3 py-2.5 text-right font-semibold text-slate-500 uppercase tracking-wide">Won</th>
            <th className="px-3 py-2.5 text-right font-semibold text-slate-500 uppercase tracking-wide">Lost</th>
            <th className="px-3 py-2.5 text-right font-semibold text-slate-500 uppercase tracking-wide">Win %</th>
            <th className="px-3 py-2.5 text-right font-semibold text-slate-500 uppercase tracking-wide">Avg Our Bid</th>
            <th className="px-3 py-2.5 text-right font-semibold text-slate-500 uppercase tracking-wide">Avg L1 Bid</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.map((d, i) => {
            const wr = d.win_rate ?? 0;
            return (
              <tr key={i} className="hover:bg-slate-50 transition-colors">
                <td className="px-3 py-2.5 text-slate-700 max-w-[260px] truncate font-medium" title={d.product}>
                  {d.product}
                </td>
                <td className="px-3 py-2.5 text-right text-slate-600">{d.total}</td>
                <td className="px-3 py-2.5 text-right text-emerald-700 font-medium">{d.won}</td>
                <td className="px-3 py-2.5 text-right text-rose-600">{d.lost}</td>
                <td className="px-3 py-2.5 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <div className="w-16 bg-slate-100 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full ${wr >= 50 ? "bg-emerald-500" : wr >= 30 ? "bg-amber-500" : "bg-rose-500"}`}
                        style={{ width: `${wr}%` }}
                      />
                    </div>
                    <span className={`font-semibold ${wr >= 50 ? "text-emerald-600" : wr >= 30 ? "text-amber-600" : "text-rose-500"}`}>
                      {wr}%
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right text-slate-600">{fmtRs(d.avg_our_bid)}</td>
                <td className="px-3 py-2.5 text-right text-emerald-700">{fmtRs(d.avg_l1_bid)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Buyer Detail Table ────────────────────────────────────────────────
function BuyerTable({ data }: { data: BuyerStats[] }) {
  if (data.length === 0) return <Empty />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            <th className="px-3 py-2.5 text-left font-semibold text-slate-500 uppercase">Buyer</th>
            <th className="px-3 py-2.5 text-right font-semibold text-slate-500 uppercase">Total</th>
            <th className="px-3 py-2.5 text-right font-semibold text-slate-500 uppercase">Won</th>
            <th className="px-3 py-2.5 text-right font-semibold text-slate-500 uppercase">Lost</th>
            <th className="px-3 py-2.5 text-right font-semibold text-slate-500 uppercase">Win %</th>
            <th className="px-3 py-2.5 text-right font-semibold text-slate-500 uppercase">Value Won</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.map((d, i) => {
            const wr = d.win_rate ?? 0;
            return (
              <tr key={i} className="hover:bg-slate-50 transition-colors">
                <td className="px-3 py-2.5 text-slate-700 max-w-[280px] truncate font-medium" title={d.buyer_name}>
                  {d.buyer_name}
                </td>
                <td className="px-3 py-2.5 text-right text-slate-600">{d.total_tenders}</td>
                <td className="px-3 py-2.5 text-right text-emerald-700 font-medium">{d.won}</td>
                <td className="px-3 py-2.5 text-right text-rose-600">{d.lost}</td>
                <td className="px-3 py-2.5 text-right">
                  <span className={`inline-block px-1.5 py-0.5 rounded font-semibold ${
                    wr >= 50 ? "bg-emerald-100 text-emerald-700"
                    : wr >= 30 ? "bg-amber-100 text-amber-700"
                    : "bg-rose-100 text-rose-600"
                  }`}>{wr}%</span>
                </td>
                <td className="px-3 py-2.5 text-right text-violet-700 font-medium">{fmtRs(d.total_value)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Empty() {
  return (
    <div className="flex items-center justify-center h-40 text-slate-400 text-sm">
      No data available yet
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-slate-500 text-sm mt-3">Loading analytics…</p>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────
export default function Analytics() {
  const [buyers,     setBuyers]     = useState<BuyerStats[]>([]);
  const [winTrend,   setWinTrend]   = useState<WinTrendStats[]>([]);
  const [products,   setProducts]   = useState<ProductStats[]>([]);
  const [tenderType, setTenderType] = useState<TenderTypeStats[]>([]);
  const [loading,    setLoading]    = useState(true);

  useEffect(() => {
    Promise.all([
      api.getBuyers(),
      api.getWinTrend(),
      api.getProducts(),
      api.getTenderType(),
    ]).then(([by, wt, pr, tt]) => {
      setBuyers(by);
      setWinTrend(wt);
      setProducts(pr);
      setTenderType(tt);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">Analytics</h1>
        <p className="text-slate-500 text-sm mt-0.5">Deep-dive into bid performance, trends &amp; buyer insights</p>
      </div>

      {/* ── Row 1: Win Rate Trend ── */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-slate-800 mb-1 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-indigo-500" /> Win Rate Trend Over Time
        </h2>
        <p className="text-xs text-slate-400 mb-4">Monthly — bars = won/lost count · line = win rate %</p>
        <WinRateTrendChart data={winTrend} />
      </div>

      {/* ── Row 2: Buyer Chart + Type Donut ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Users className="w-4 h-4 text-slate-400" /> Buyer-wise Volume
          </h2>
          <BuyerChart data={buyers} />
        </div>

        <div className="card p-5">
          <h2 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-slate-400" /> Tender Type Mix (BID vs RA)
          </h2>
          <TenderTypePie data={tenderType} />
        </div>
      </div>

      {/* ── Row 3: Products Radar + Table ── */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-slate-800 mb-1 flex items-center gap-2">
          <Target className="w-4 h-4 text-emerald-500" /> Product Performance
        </h2>
        <p className="text-xs text-slate-400 mb-4">Products with 2+ tenders — win rate, avg bid comparison</p>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div>
            <p className="text-xs font-medium text-slate-500 mb-2 uppercase tracking-wide">Win Rate Radar (Top 8)</p>
            <ProductsRadar data={products} />
          </div>
          <div className="xl:col-span-2">
            <p className="text-xs font-medium text-slate-500 mb-2 uppercase tracking-wide">Full Product Breakdown</p>
            <ProductsTable data={products} />
          </div>
        </div>
      </div>

      {/* ── Row 4: Buyer Detail Table ── */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <Users className="w-4 h-4 text-violet-500" /> Buyer Detail — Win Rate & Value
        </h2>
        <BuyerTable data={buyers} />
      </div>
    </div>
  );
}
