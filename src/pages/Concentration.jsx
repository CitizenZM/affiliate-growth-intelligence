import React, { useState } from "react";
import SectionLayout from "../components/dashboard/SectionLayout";
import EvidenceTable from "../components/dashboard/EvidenceTable";
import InsightsPanel from "../components/dashboard/InsightsPanel";
import DatasetSelector from "../components/dashboard/DatasetSelector";
import DataLoader from "../components/dashboard/DataLoader";
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge";

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
  const [datasetId, setDatasetId] = useState(null);

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">集中度分析</h1>
          <p className="text-sm text-slate-500 mt-1">Pareto 曲线揭示 GMV 集中风险与头部依赖</p>
        </div>
        <DatasetSelector value={datasetId} onChange={setDatasetId} />
      </div>

      <DataLoader datasetId={datasetId}>
        {({ getMetric, getTable, getSection }) => {
          const section = getSection(2);
          const top1Share = getMetric("top1_share");
          const top10Share = getMetric("top10_share");
          const pubsTo50 = getMetric("publishers_to_50pct");
          const paretoPoints = getTable("pareto_points");
          const topnRows = getTable("topn_table");

          const paretoData = paretoPoints.map((row) => ({
            pubPct: Number(row.pubPct) || 0,
            gmvPct: Number(row.gmvPct) || 0,
          }));

          const top3Share =
            topnRows
              .slice(0, 3)
              .reduce((sum, row) => sum + (Number(String(row.pct).replace("%", "")) || 0), 0) / 100;

          const metrics = [
            { label: "Top 1", value: `${(top1Share * 100).toFixed(1)}%`, status: top1Share > 0.3 ? "red" : "yellow" },
            { label: "Top 3", value: `${(top3Share * 100).toFixed(1)}%`, status: top3Share > 0.45 ? "red" : "yellow" },
            { label: "Top 10", value: `${(top10Share * 100).toFixed(1)}%`, status: top10Share > 0.6 ? "red" : "yellow" },
            { label: "50% GMV 所需", value: `${pubsTo50} 个`, status: pubsTo50 < 5 ? "red" : "yellow" },
          ];

          const conclusionStatus = top10Share > 0.6 ? "bad" : top10Share > 0.5 ? "warning" : "good";
          const conclusion =
            section?.conclusion ||
            `Top10 Publisher 贡献 ${(top10Share * 100).toFixed(1)}% GMV，50% GMV 仅需 ${pubsTo50} 个 Publisher。`;

          return (
            <>
              <SectionLayout conclusion={conclusion} conclusionStatus={conclusionStatus} derivationNotes={section?.derivation_notes || derivationNotes}>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {metrics.map((m) => (
                    <div key={m.label} className="bg-white rounded-xl border border-slate-200 p-4 text-center">
                      <p className="text-xs text-slate-500 mb-1">{m.label}</p>
                      <p className="text-xl font-bold text-slate-900">{m.value}</p>
                      <Badge
                        className={`mt-1.5 text-[10px] ${
                          m.status === "red"
                            ? "bg-red-50 text-red-700 border-red-200"
                            : "bg-amber-50 text-amber-700 border-amber-200"
                        }`}
                      >
                        {m.status === "red" ? "超标" : "关注"}
                      </Badge>
                    </div>
                  ))}
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-6">
                  <h3 className="text-sm font-semibold text-slate-700 mb-4">Pareto 曲线 — 累计 Publisher % vs 累计 GMV %</h3>
                  <div className="h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={paretoData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                        <XAxis
                          dataKey="pubPct"
                          tick={{ fontSize: 11, fill: "#94A3B8" }}
                          tickFormatter={(v) => `${v}%`}
                          label={{ value: "累计 Publisher %", position: "insideBottom", offset: -5, fontSize: 11, fill: "#94A3B8" }}
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: "#94A3B8" }}
                          tickFormatter={(v) => `${v}%`}
                          label={{ value: "累计 GMV %", angle: -90, position: "insideLeft", fontSize: 11, fill: "#94A3B8" }}
                        />
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
                  columns={[
                    { key: "rank", label: "#" },
                    { key: "name", label: "Publisher" },
                    { key: "gmv", label: "GMV" },
                    { key: "pct", label: "占比" },
                    { key: "cumPct", label: "累计" },
                  ]}
                  data={topnRows}
                  derivationNotes={section?.derivation_notes || derivationNotes}
                />
              </SectionLayout>

              <InsightsPanel
                insights={[
                  "Pareto曲线可视化了'少量Publisher贡献多数GMV'现象，曲线越陡峭说明集中度越高",
                  "50% GMV所需Publisher数量是衡量头部依赖的关键指标，值越小说明集中风险越高",
                  "Top10 GMV占比超过60%属于高风险状态，任何头部渠道流失都会造成显著冲击",
                ]}
                problems={[
                  "如果Top1占比超过30%，说明单点风险过高，应立即启动去集中化计划",
                  "若曲线长期陡峭且无改善，需要在激活与分层治理中引入明确扩张目标",
                ]}
              />
            </>
          );
        }}
      </DataLoader>
    </div>
  );
}
