import React, { useState } from "react";
import SectionLayout from "../components/dashboard/SectionLayout";
import EvidenceTable from "../components/dashboard/EvidenceTable";
import InsightsPanel from "../components/dashboard/InsightsPanel";
import DatasetSelector from "../components/dashboard/DatasetSelector";
import DataLoader from "../components/dashboard/DataLoader";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";

const colorByType = {
  content: "#3B82F6",
  deal_coupon: "#EF4444",
  loyalty_cashback: "#8B5CF6",
  search: "#F59E0B",
  tech_sub: "#06B6D4",
  other: "#94A3B8",
};

const derivationNotes = [
  {
    title: "映射规则",
    items: [
      { label: "优先级", value: "tag > publisher_type > parent_publisher_type" },
      { label: "默认", value: "无法识别归入 Other" },
    ],
  },
  {
    title: "计算公式",
    items: [
      { label: "GMV 占比", value: "type_revenue / sum(total_revenue)" },
      { label: "数量占比", value: "type_count / active_publishers" },
    ],
  },
];

export default function MixHealth() {
  const [datasetId, setDatasetId] = useState(null);

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">结构健康</h1>
          <p className="text-sm text-slate-500 mt-1">GMV 类型分布与数量分布的健康度评估</p>
        </div>
        <DatasetSelector value={datasetId} onChange={setDatasetId} />
      </div>

      <DataLoader datasetId={datasetId}>
        {({ getTable, getSection }) => {
          const section = getSection(3);
          const mixRows = getTable("mix_health_table");
          const totalGMV = mixRows.reduce((sum, row) => sum + (Number(row.gmv) || 0), 0);

          const gmvData = mixRows.map((row) => ({
            name: row.type,
            value: totalGMV > 0 ? Number((((Number(row.gmv) || 0) / totalGMV) * 100).toFixed(1)) : 0,
            color: colorByType[row.type] || "#94A3B8",
          }));

          const countData = mixRows.map((row) => ({
            name: row.type,
            count: row.count,
          }));

          const evidenceData = mixRows.map((row) => {
            const gmvShare = totalGMV > 0 ? ((Number(row.gmv) || 0) / totalGMV) * 100 : 0;
            return {
              type: row.type,
              count: row.count,
              gmv: `$${((Number(row.gmv) || 0) / 1000).toFixed(1)}K`,
              gmvPct: `${gmvShare.toFixed(1)}%`,
              status: gmvShare > 50 ? "集中偏高" : gmvShare < 10 ? "占比偏低" : "健康",
            };
          });

          return (
            <>
              <SectionLayout
                conclusion={section?.conclusion || "结构健康分析基于最新数据集自动生成。"}
                conclusionStatus={section?.conclusion_status || "neutral"}
                derivationNotes={section?.derivation_notes || derivationNotes}
              >
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  <div className="bg-white rounded-2xl border border-slate-200 p-6">
                    <h3 className="text-sm font-semibold text-slate-700 mb-4">GMV 类型占比</h3>
                    <div className="h-[280px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={gmvData} cx="50%" cy="50%" innerRadius={70} outerRadius={110} dataKey="value" stroke="none" paddingAngle={2}>
                            {gmvData.map((entry, idx) => (
                              <Cell key={idx} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E2E8F0" }} formatter={(v) => [`${v}%`, "GMV 占比"]} />
                          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-200 p-6">
                    <h3 className="text-sm font-semibold text-slate-700 mb-4">Publisher 数量分布</h3>
                    <div className="h-[280px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={countData} barCategoryGap="25%">
                          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                          <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94A3B8" }} />
                          <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} />
                          <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E2E8F0" }} />
                          <Bar dataKey="count" fill="#3B82F6" radius={[6, 6, 0, 0]} barSize={24} name="Publisher 数量" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                <EvidenceTable
                  title="类型结构明细"
                  columns={[
                    { key: "type", label: "类型" },
                    { key: "count", label: "数量" },
                    { key: "gmv", label: "GMV" },
                    { key: "gmvPct", label: "GMV 占比" },
                    { key: "status", label: "状态" },
                  ]}
                  data={evidenceData}
                  derivationNotes={section?.derivation_notes || derivationNotes}
                />
              </SectionLayout>

              <InsightsPanel
                insights={[
                  "结构健康页已切换为按当前数据集动态计算，不再使用固定示例数据",
                  "每次重算后，GMV 占比和数量分布会随新数据自动刷新",
                ]}
                problems={[
                  "若某单一类型长期超过 50%，建议在 Action Plan 中建立去集中化动作",
                ]}
              />
            </>
          );
        }}
      </DataLoader>
    </div>
  );
}
