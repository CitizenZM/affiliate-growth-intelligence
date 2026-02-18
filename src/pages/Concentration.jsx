import React, { useState } from "react";
import SectionLayout from "../components/dashboard/SectionLayout";
import EvidenceTable from "../components/dashboard/EvidenceTable";
import InsightsPanel from "../components/dashboard/InsightsPanel";
import DatasetSelector from "../components/dashboard/DatasetSelector";
import DataLoader from "../components/dashboard/DataLoader";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Area, AreaChart } from "recharts";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/components/LanguageContext";

const evidenceColumns = [
  { key: "rank", label: "#" },
  { key: "name", label: "Publisher" },
  { key: "gmv", label: "GMV" },
  { key: "pct", label: "占比" },
  { key: "cumPct", label: "累计" },
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
  const [selectedDataset, setSelectedDataset] = useState(null);
  const { t } = useLanguage();
  const co = t('concentration');

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{co.title}</h1>
          <p className="text-sm text-slate-500 mt-1">{co.subtitle}</p>
        </div>
        <DatasetSelector value={selectedDataset} onChange={setSelectedDataset} />
      </div>

      <DataLoader datasetId={selectedDataset}>
        {({ getTable, getMetric }) => {
          const topnTable = getTable('topn_table');
          const paretoPoints = getTable('pareto_points');
          const top1Share = getMetric('top1_share');
          const top10Share = getMetric('top10_share');
          const publishersTo50 = getMetric('publishers_to_50pct');

          // Calculate Top3 share from topn_table
          const top3Share = topnTable.slice(0, 3).reduce((sum, pub) => {
            return sum + parseFloat(pub.pct) / 100;
          }, 0);

          // Build TopN metrics from real data
          const topNMetrics = [
            { 
              label: "Top 1", 
              value: `${(top1Share * 100).toFixed(0)}%`, 
              status: top1Share > 0.3 ? "red" : top1Share > 0.2 ? "yellow" : "green" 
            },
            { 
              label: "Top 3", 
              value: `${(top3Share * 100).toFixed(0)}%`, 
              status: top3Share > 0.5 ? "red" : top3Share > 0.4 ? "yellow" : "green" 
            },
            { 
              label: "Top 10", 
              value: `${(top10Share * 100).toFixed(0)}%`, 
              status: top10Share > 0.6 ? "red" : top10Share > 0.5 ? "yellow" : "green" 
            },
            { 
              label: co.publishers50, 
              value: `${publishersTo50}${co.unit50 ? ' ' + co.unit50 : ''}`, 
              status: publishersTo50 < 5 ? "red" : publishersTo50 < 10 ? "yellow" : "green" 
            },
          ];

          // Convert pareto points for chart
          const paretoData = paretoPoints.map(p => ({
            pubPct: parseFloat(p.pubPct),
            gmvPct: parseFloat(p.gmvPct),
          }));

          // Build conclusion
          let conclusion = `Top10 Publisher 贡献 ${(top10Share * 100).toFixed(0)}% GMV`;
          let conclusionStatus = 'good';
          
          if (top10Share > 0.6) {
            conclusion += '，远超 60% 风险线';
            conclusionStatus = 'bad';
          } else if (top10Share > 0.5) {
            conclusion += '，超出 50% 健康线';
            conclusionStatus = 'warning';
          } else {
            conclusion += '，处于健康区间';
          }

          if (publishersTo50 < 5) {
            conclusion += `。仅需 ${publishersTo50} 个 Publisher 即覆盖 50% GMV，头部依赖风险显著。`;
            conclusionStatus = 'bad';
          } else if (publishersTo50 < 10) {
            conclusion += `。需 ${publishersTo50} 个 Publisher 覆盖 50% GMV，存在一定集中风险。`;
            if (conclusionStatus === 'good') conclusionStatus = 'warning';
          }

          return (
            <SectionLayout
              conclusion={conclusion}
              conclusionStatus={conclusionStatus}
              derivationNotes={derivationNotes}
            >
              {/* TopN metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {topNMetrics.map((m) => (
                  <div key={m.label} className="bg-white rounded-xl border border-slate-200 p-4 text-center">
                    <p className="text-xs text-slate-500 mb-1">{m.label}</p>
                    <p className="text-xl font-bold text-slate-900">{m.value}</p>
                    <Badge className={`mt-1.5 text-[10px] ${
                      m.status === "red" ? "bg-red-50 text-red-700 border-red-200" : 
                      m.status === "yellow" ? "bg-amber-50 text-amber-700 border-amber-200" :
                      "bg-green-50 text-green-700 border-green-200"
                    }`}>
                      {m.status === "red" ? t('shared.exceed') : m.status === "yellow" ? t('shared.watch') : t('shared.healthy')}
                    </Badge>
                  </div>
                ))}
              </div>

              {/* Pareto chart */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <h3 className="text-sm font-semibold text-slate-700 mb-4">{co.paretoTitle}</h3>
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
                title={co.tableTitle}
                columns={evidenceColumns}
                data={topnTable.slice(0, 20)}
                derivationNotes={derivationNotes}
              />
            </SectionLayout>
          );
        }}
      </DataLoader>

      <InsightsPanel
        insights={[
          "Pareto曲线可视化了'20%的Publisher产生80%的GMV'现象，曲线越陡峭说明集中度越高",
          "50% GMV所需Publisher数量是衡量头部依赖的关键指标，健康值应≥10个",
          "Top10 GMV占比超过60%属于高风险状态，任何一个头部渠道的流失都可能对业务造成重大影响",
          "集中度适中（Top10在40-50%）既能保证稳定产出，又不会过度依赖少数渠道"
        ]}
        problems={[
          "如果Top1占比超过30%，说明对单一渠道的依赖已到危险水平，需立即启动分散化策略",
          "累计GMV曲线如果在前10%就达到50%，说明长尾渠道几乎没有贡献，需要激活策略",
          "对比不同时期的Pareto曲线走势，可以判断集中度改善或恶化的趋势"
        ]}
      />
    </div>
  );
}