import React from "react";
import SectionLayout from "../components/dashboard/SectionLayout";
import EvidenceTable from "../components/dashboard/EvidenceTable";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Area, AreaChart } from "recharts";
import { Badge } from "@/components/ui/badge";

// Pareto curve data (cumulative publishers vs cumulative GMV %)
const paretoData = Array.from({ length: 20 }, (_, i) => {
  const pubPct = ((i + 1) / 20) * 100;
  const gmvPct = Math.min(100, Math.round(100 * (1 - Math.pow(1 - pubPct / 100, 2.5))));
  return { pubPct, gmvPct, label: `${pubPct}%` };
});

const topNMetrics = [
  { label: "Top 1", value: "23%", status: "red" },
  { label: "Top 3", value: "45%", status: "red" },
  { label: "Top 10", value: "68%", status: "red" },
  { label: "50% GMV 所需", value: "4 个", status: "yellow" },
];

const evidenceColumns = [
  { key: "rank", label: "#" },
  { key: "name", label: "Publisher" },
  { key: "gmv", label: "GMV" },
  { key: "pct", label: "占比" },
  { key: "cumPct", label: "累计" },
];
const evidenceData = [
  { rank: 1, name: "RetailMeNot", gmv: "$312K", pct: "23%", cumPct: "23%" },
  { rank: 2, name: "Rakuten", gmv: "$168K", pct: "12%", cumPct: "35%" },
  { rank: 3, name: "Honey", gmv: "$132K", pct: "10%", cumPct: "45%" },
  { rank: 4, name: "Wirecutter", gmv: "$89K", pct: "7%", cumPct: "52%" },
  { rank: 5, name: "BuzzFeed", gmv: "$76K", pct: "6%", cumPct: "57%" },
];

const derivationNotes = [
  {
    title: "排序规则",
    items: [
      { label: "排序字段", value: "total_revenue DESC" },
      { label: "分母", value: "Total GMV = sum(total_revenue)" },
    ],
  },
  {
    title: "阈值说明",
    items: [
      { label: "健康线", value: "Top10 ≤ 50%" },
      { label: "风险线", value: "Top10 > 60%" },
      { label: "50% 覆盖", value: "达到 50% GMV 所需最少 publisher 数" },
    ],
  },
];

export default function Concentration() {
  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">集中度分析</h1>
        <p className="text-sm text-slate-500 mt-1">Pareto 曲线揭示 GMV 集中风险与头部依赖</p>
      </div>

      <SectionLayout
        conclusion="Top10 Publisher 贡献 68% GMV，远超 50% 健康警戒线。仅需 4 个 Publisher 即覆盖 50% GMV，头部依赖风险显著。"
        conclusionStatus="bad"
        derivationNotes={derivationNotes}
      >
        {/* TopN metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {topNMetrics.map((m) => (
            <div key={m.label} className="bg-white rounded-xl border border-slate-200 p-4 text-center">
              <p className="text-xs text-slate-500 mb-1">{m.label}</p>
              <p className="text-xl font-bold text-slate-900">{m.value}</p>
              <Badge className={`mt-1.5 text-[10px] ${
                m.status === "red" ? "bg-red-50 text-red-700 border-red-200" : "bg-amber-50 text-amber-700 border-amber-200"
              }`}>{m.status === "red" ? "超标" : "关注"}</Badge>
            </div>
          ))}
        </div>

        {/* Pareto chart */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Pareto 曲线 — 累计 Publisher % vs 累计 GMV %</h3>
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={paretoData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="pubPct" tick={{ fontSize: 11, fill: "#94A3B8" }} tickFormatter={(v) => `${v}%`} label={{ value: "累计 Publisher %", position: "insideBottom", offset: -5, fontSize: 11, fill: "#94A3B8" }} />
                <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} tickFormatter={(v) => `${v}%`} label={{ value: "累计 GMV %", angle: -90, position: "insideLeft", fontSize: 11, fill: "#94A3B8" }} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: "1px solid #E2E8F0", boxShadow: "0 4px 12px rgba(0,0,0,0.06)" }}
                  formatter={(v) => [`${v}%`]}
                />
                <ReferenceLine y={50} stroke="#F59E0B" strokeDasharray="5 5" label={{ value: "50%", fill: "#F59E0B", fontSize: 11 }} />
                <defs>
                  <linearGradient id="areaBlue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563EB" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="#2563EB" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="gmvPct" stroke="#2563EB" strokeWidth={2.5} fill="url(#areaBlue)" dot={{ fill: "#2563EB", r: 3, strokeWidth: 0 }} activeDot={{ r: 5, fill: "#2563EB" }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <EvidenceTable
          title="TopN 排名明细"
          columns={evidenceColumns}
          data={evidenceData}
          derivationNotes={derivationNotes}
        />
      </SectionLayout>
    </div>
  );
}