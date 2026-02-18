import React, { useState } from "react";
import SectionLayout from "../components/dashboard/SectionLayout";
import EvidenceTable from "../components/dashboard/EvidenceTable";
import InsightsPanel from "../components/dashboard/InsightsPanel";
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ZAxis, ReferenceLine, Cell } from "recharts";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/LanguageContext";

const scatterData = [
  { name: "RetailMeNot", cpa: 12.3, aov: 85, gmv: 312000, type: "deal", roi: 6.9 },
  { name: "Wirecutter", cpa: 18.5, aov: 120, gmv: 62000, type: "content", roi: 6.5 },
  { name: "Rakuten", cpa: 8.9, aov: 72, gmv: 168000, type: "loyalty", roi: 8.1 },
  { name: "BuzzFeed", cpa: 22.1, aov: 95, gmv: 31000, type: "content", roi: 4.3 },
  { name: "Honey", cpa: 6.4, aov: 65, gmv: 132000, type: "tech", roi: 10.2 },
  { name: "SlickDeals", cpa: 9.8, aov: 55, gmv: 45000, type: "deal", roi: 5.6 },
  { name: "TopCashback", cpa: 11.2, aov: 78, gmv: 38000, type: "loyalty", roi: 7.0 },
  { name: "CNN Underscored", cpa: 25.0, aov: 140, gmv: 28000, type: "content", roi: 5.6 },
  { name: "CouponFollow", cpa: 7.5, aov: 48, gmv: 22000, type: "deal", roi: 6.4 },
  { name: "TechRadar", cpa: 20.0, aov: 115, gmv: 18000, type: "content", roi: 5.8 },
];

const typeColors = { deal: "#EF4444", content: "#3B82F6", loyalty: "#8B5CF6", tech: "#06B6D4" };

const derivationNotes = [
  {
    title: "指标定义",
    items: [
      { label: "CPA", value: "total_commission / orders" },
      { label: "AOV", value: "total_revenue / orders" },
      { label: "ROI", value: "total_revenue / total_commission" },
      { label: "点大小", value: "按 GMV 缩放" },
    ],
  },
  {
    title: "象限策略",
    items: [
      { label: "高AOV低CPA", value: "★ 最优 — 加码投入" },
      { label: "高AOV高CPA", value: "优化转化路径" },
      { label: "低AOV低CPA", value: "批量扩展" },
      { label: "低AOV高CPA", value: "治理或淘汰" },
    ],
  },
];

const evidenceColumns = [
  { key: "name", label: "Publisher" },
  { key: "type", label: "类型" },
  { key: "cpa", label: "CPA" },
  { key: "aov", label: "AOV" },
  { key: "roi", label: "ROI" },
  { key: "gmv", label: "GMV" },
];
const evidenceData = scatterData.map(d => ({
  ...d,
  cpa: `$${d.cpa}`,
  aov: `$${d.aov}`,
  roi: `${d.roi}x`,
  gmv: `$${(d.gmv / 1000).toFixed(0)}K`,
}));

export default function Efficiency() {
  const [selected, setSelected] = useState(null);
  const { t } = useLanguage();
  const ef = t('efficiency');

  const medianCPA = 12;
  const medianAOV = 80;

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{ef.title}</h1>
        <p className="text-sm text-slate-500 mt-1">{ef.subtitle}</p>
      </div>

      <SectionLayout
        conclusion="Content 类 Publisher AOV 显著高于平均（$110 vs $80），但 CPA 也偏高。Loyalty 类在低 CPA 象限表现优异，可批量扩展。"
        conclusionStatus="neutral"
        derivationNotes={derivationNotes}
      >
        {/* Scatter */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-700">{ef.chartTitle}</h3>
            <div className="flex gap-3">
              {Object.entries(typeColors).map(([type, color]) => (
                <div key={type} className="flex items-center gap-1.5 text-xs text-slate-500">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                  {type}
                </div>
              ))}
            </div>
          </div>
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="cpa" name="CPA" tick={{ fontSize: 11, fill: "#94A3B8" }} label={{ value: "CPA ($)", position: "insideBottom", offset: -5, fontSize: 11, fill: "#94A3B8" }} />
                <YAxis dataKey="aov" name="AOV" tick={{ fontSize: 11, fill: "#94A3B8" }} label={{ value: "AOV ($)", angle: -90, position: "insideLeft", fontSize: 11, fill: "#94A3B8" }} />
                <ZAxis dataKey="gmv" range={[60, 400]} />
                <ReferenceLine x={medianCPA} stroke="#E2E8F0" strokeDasharray="4 4" />
                <ReferenceLine y={medianAOV} stroke="#E2E8F0" strokeDasharray="4 4" />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: "1px solid #E2E8F0" }}
                  content={({ payload }) => {
                    if (!payload?.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-lg">
                        <p className="font-semibold text-sm text-slate-800">{d.name}</p>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-1.5 text-xs text-slate-600">
                          <span>CPA: ${d.cpa}</span>
                          <span>AOV: ${d.aov}</span>
                          <span>ROI: {d.roi}x</span>
                          <span>GMV: ${(d.gmv / 1000).toFixed(0)}K</span>
                        </div>
                      </div>
                    );
                  }}
                />
                <Scatter
                  data={scatterData}
                  onClick={(e) => setSelected(e)}
                >
                  {scatterData.map((entry, idx) => (
                    <Cell key={idx} fill={typeColors[entry.type] || "#94A3B8"} fillOpacity={0.75} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>

          {/* Quadrant labels */}
          <div className="grid grid-cols-2 gap-2 mt-3">
            <div className="bg-emerald-50 rounded-lg p-2.5 text-center">
              <p className="text-[11px] font-semibold text-emerald-700">{ef.quadrant.q1}</p>
              <p className="text-[10px] text-emerald-600">{ef.quadrant.q1sub}</p>
            </div>
            <div className="bg-amber-50 rounded-lg p-2.5 text-center">
              <p className="text-[11px] font-semibold text-amber-700">{ef.quadrant.q2}</p>
              <p className="text-[10px] text-amber-600">{ef.quadrant.q2sub}</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-2.5 text-center">
              <p className="text-[11px] font-semibold text-blue-700">{ef.quadrant.q3}</p>
              <p className="text-[10px] text-blue-600">{ef.quadrant.q3sub}</p>
            </div>
            <div className="bg-red-50 rounded-lg p-2.5 text-center">
              <p className="text-[11px] font-semibold text-red-700">{ef.quadrant.q4}</p>
              <p className="text-[10px] text-red-600">{ef.quadrant.q4sub}</p>
            </div>
          </div>
        </div>

        <EvidenceTable
          title={ef.tableTitle}
          columns={evidenceColumns}
          data={evidenceData}
          derivationNotes={derivationNotes}
        />
      </SectionLayout>

      {/* Publisher profile drawer */}
      <Sheet open={!!selected} onOpenChange={() => setSelected(null)}>
        <SheetContent className="w-[400px] sm:w-[480px]">
          <SheetHeader>
            <SheetTitle>{selected?.name || "Publisher Profile"}</SheetTitle>
          </SheetHeader>
          {selected && (
            <div className="mt-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "GMV", value: `$${(selected.gmv / 1000).toFixed(0)}K` },
                  { label: "CPA", value: `$${selected.cpa}` },
                  { label: "AOV", value: `$${selected.aov}` },
                  { label: "ROI", value: `${selected.roi}x` },
                ].map((m) => (
                  <div key={m.label} className="bg-slate-50 rounded-lg p-3">
                    <p className="text-xs text-slate-500">{m.label}</p>
                    <p className="text-lg font-bold text-slate-900 mt-0.5">{m.value}</p>
                  </div>
                ))}
              </div>
              <div>
              <p className="text-xs text-slate-500 mb-1.5">{ef.drawer.type}</p>
              <Badge className="bg-blue-50 text-blue-700 border-blue-200">{selected.type}</Badge>
              </div>
              <div>
              <p className="text-xs text-slate-500 mb-1.5">{ef.drawer.recommended}</p>
              <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-700">
                {selected.aov > medianAOV && selected.cpa < medianCPA
                  ? ef.drawer.star
                  : selected.aov > medianAOV
                  ? ef.drawer.highValue
                  : selected.cpa < medianCPA
                  ? ef.drawer.efficient
                  : ef.drawer.review}
              </div>
              </div>
              <Button className="w-full bg-blue-600 hover:bg-blue-700 text-sm">{ef.drawer.addAction}</Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <InsightsPanel
        insights={[
          "效率象限通过CPA和AOV两个维度，将Publisher分为4类：星级（高AOV低CPA）、潜力（高AOV高CPA）、规模（低AOV低CPA）、问题（低AOV高CPA）",
          "散点大小代表GMV，可以直观看出哪些Publisher既效率高又体量大",
          "ROI（投入产出比）是综合评估Publisher价值的核心指标，通常健康值应≥5x",
          "不同类型Publisher有不同特征：Content类通常高AOV但CPA也高，Deal类CPA低但AOV也低"
        ]}
        problems={[
          "如果一个Publisher处于右下象限（低AOV高CPA）且GMV占比大，属于高优先级治理对象",
          "高AOV高CPA的Publisher不一定要淘汰，可以通过优化落地页、佣金结构来降低CPA",
          "批量扩展低AOV低CPA的Publisher时，要注意边际效应递减，避免盲目追求数量"
        ]}
      />
    </div>
  );
}