import React, { useState } from "react";
import SectionLayout from "../components/dashboard/SectionLayout";
import EvidenceTable from "../components/dashboard/EvidenceTable";
import InsightsPanel from "../components/dashboard/InsightsPanel";
import DatasetSelector from "../components/dashboard/DatasetSelector";
import DataLoader from "../components/dashboard/DataLoader";
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ZAxis, ReferenceLine, Cell } from "recharts";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const typeColors = {
  deal: "#EF4444",
  deal_coupon: "#EF4444",
  content: "#3B82F6",
  loyalty: "#8B5CF6",
  loyalty_cashback: "#8B5CF6",
  tech: "#06B6D4",
  tech_sub: "#06B6D4",
  search: "#F59E0B",
  other: "#94A3B8",
};

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
];

export default function Efficiency() {
  const [datasetId, setDatasetId] = useState(null);
  const [selected, setSelected] = useState(null);

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">效率象限</h1>
          <p className="text-sm text-slate-500 mt-1">CPA vs AOV 四象限定位 Publisher 策略优先级</p>
        </div>
        <DatasetSelector value={datasetId} onChange={setDatasetId} />
      </div>

      <DataLoader datasetId={datasetId}>
        {({ getTable, getSection }) => {
          const section = getSection(4);
          const scatterData = getTable("efficiency_scatter");
          const medianCPA = (() => {
            const arr = scatterData.map((d) => Number(d.cpa) || 0).sort((a, b) => a - b);
            if (arr.length === 0) return 0;
            const mid = Math.floor(arr.length / 2);
            return arr.length % 2 === 0 ? (arr[mid - 1] + arr[mid]) / 2 : arr[mid];
          })();
          const medianAOV = (() => {
            const arr = scatterData.map((d) => Number(d.aov) || 0).sort((a, b) => a - b);
            if (arr.length === 0) return 0;
            const mid = Math.floor(arr.length / 2);
            return arr.length % 2 === 0 ? (arr[mid - 1] + arr[mid]) / 2 : arr[mid];
          })();

          const evidenceData = scatterData.map((d) => ({
            ...d,
            cpa: `$${Number(d.cpa || 0).toFixed(2)}`,
            aov: `$${Number(d.aov || 0).toFixed(2)}`,
            roi: `${Number(d.roi || 0).toFixed(2)}x`,
            gmv: `$${(Number(d.gmv || 0) / 1000).toFixed(1)}K`,
          }));

          return (
            <>
              <SectionLayout
                conclusion={section?.conclusion || "效率分析基于最新数据集自动生成。"}
                conclusionStatus={section?.conclusion_status || "neutral"}
                derivationNotes={section?.derivation_notes || derivationNotes}
              >
                <div className="bg-white rounded-2xl border border-slate-200 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-slate-700">CPA vs AOV 散点图</h3>
                    <div className="flex gap-3">
                      {Array.from(new Set(scatterData.map((d) => d.type || "other"))).map((type) => (
                        <div key={type} className="flex items-center gap-1.5 text-xs text-slate-500">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ background: typeColors[type] || "#94A3B8" }} />
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
                                  <span>CPA: ${Number(d.cpa || 0).toFixed(2)}</span>
                                  <span>AOV: ${Number(d.aov || 0).toFixed(2)}</span>
                                  <span>ROI: {Number(d.roi || 0).toFixed(2)}x</span>
                                  <span>GMV: ${(Number(d.gmv || 0) / 1000).toFixed(1)}K</span>
                                </div>
                              </div>
                            );
                          }}
                        />
                        <Scatter data={scatterData} onClick={(e) => setSelected(e)}>
                          {scatterData.map((entry, idx) => (
                            <Cell key={idx} fill={typeColors[entry.type] || "#94A3B8"} fillOpacity={0.75} />
                          ))}
                        </Scatter>
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <EvidenceTable
                  title="Publisher 效率明细"
                  columns={[
                    { key: "name", label: "Publisher" },
                    { key: "type", label: "类型" },
                    { key: "cpa", label: "CPA" },
                    { key: "aov", label: "AOV" },
                    { key: "roi", label: "ROI" },
                    { key: "gmv", label: "GMV" },
                  ]}
                  data={evidenceData}
                  derivationNotes={section?.derivation_notes || derivationNotes}
                />
              </SectionLayout>

              <Sheet open={!!selected} onOpenChange={() => setSelected(null)}>
                <SheetContent className="w-[400px] sm:w-[480px]">
                  <SheetHeader>
                    <SheetTitle>{selected?.name || "Publisher Profile"}</SheetTitle>
                  </SheetHeader>
                  {selected && (
                    <div className="mt-6 space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { label: "GMV", value: `$${(Number(selected.gmv || 0) / 1000).toFixed(1)}K` },
                          { label: "CPA", value: `$${Number(selected.cpa || 0).toFixed(2)}` },
                          { label: "AOV", value: `$${Number(selected.aov || 0).toFixed(2)}` },
                          { label: "ROI", value: `${Number(selected.roi || 0).toFixed(2)}x` },
                        ].map((m) => (
                          <div key={m.label} className="bg-slate-50 rounded-lg p-3">
                            <p className="text-xs text-slate-500">{m.label}</p>
                            <p className="text-lg font-bold text-slate-900 mt-0.5">{m.value}</p>
                          </div>
                        ))}
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-1.5">类型</p>
                        <Badge className="bg-blue-50 text-blue-700 border-blue-200">{selected.type}</Badge>
                      </div>
                      <Button className="w-full bg-blue-600 hover:bg-blue-700 text-sm">加入行动计划</Button>
                    </div>
                  )}
                </SheetContent>
              </Sheet>

              <InsightsPanel
                insights={[
                  "效率页已切换为按当前数据集实时计算的散点图和证据表",
                  "每次新数据集完成处理后，象限分布和结论会自动更新",
                ]}
                problems={[
                  "当订单字段缺失时，CPA/AOV 可能为 0，建议在 Input 阶段补全 orders 字段",
                ]}
              />
            </>
          );
        }}
      </DataLoader>
    </div>
  );
}
