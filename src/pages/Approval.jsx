import React, { useState } from "react";
import SectionLayout from "../components/dashboard/SectionLayout";
import EvidenceTable from "../components/dashboard/EvidenceTable";
import InsightsPanel from "../components/dashboard/InsightsPanel";
import DatasetSelector from "../components/dashboard/DatasetSelector";
import DataLoader from "../components/dashboard/DataLoader";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Badge } from "@/components/ui/badge";

const derivationNotes = [
  {
    title: "口径定义",
    items: [
      { label: "Approved", value: "approved_revenue 字段" },
      { label: "Pending", value: "pending_revenue 字段" },
      { label: "Declined", value: "declined_revenue 字段" },
      { label: "Approval Rate", value: "approved_revenue / total_revenue" },
    ],
  },
  {
    title: "阈值",
    items: [
      { label: "健康", value: "Approval Rate ≥ 85%" },
      { label: "关注", value: "70% ≤ Rate < 85%" },
      { label: "风险", value: "Rate < 70%" },
    ],
  },
];

export default function Approval() {
  const [selectedDataset, setSelectedDataset] = useState(null);
  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">交易质量</h1>
          <p className="text-sm text-slate-500 mt-1">Approval/Pending/Declined 分布与异常 Publisher 识别</p>
        </div>
        <DatasetSelector value={selectedDataset} onChange={setSelectedDataset} />
      </div>

      <DataLoader datasetId={selectedDataset}>
        {({ getMetric, getTable, getSection }) => {
          const section = getSection(5);
          const approvalTable = getTable('approval_table');

          // Build waterfall from metrics
          const totalGMV = getMetric('total_gmv');
          const approvedGMV = getMetric('total_approved_gmv');
          const pendingGMV = getMetric('total_pending_gmv');
          const declinedGMV = getMetric('total_declined_gmv');
          const approvalRate = getMetric('approval_rate');

          const waterfallData = [
            { name: "Total GMV", value: totalGMV, fill: "#94A3B8", label: `$${(totalGMV / 1000).toFixed(0)}K` },
            { name: "Approved", value: approvedGMV, fill: "#16A34A", label: `$${(approvedGMV / 1000).toFixed(0)}K` },
            { name: "Pending", value: pendingGMV, fill: "#F59E0B", label: `$${(pendingGMV / 1000).toFixed(0)}K` },
            { name: "Declined", value: declinedGMV, fill: "#DC2626", label: `$${(declinedGMV / 1000).toFixed(0)}K` },
          ];

          // Find high-decline publishers from table
          const riskPublishers = approvalTable
            .filter(p => p.decline_rate && p.decline_rate > 0.5)
            .sort((a, b) => b.declined_revenue - a.declined_revenue)
            .slice(0, 3)
            .map(p => ({
              name: p.publisher_name,
              declined: `$${(p.declined_revenue / 1000).toFixed(0)}K`,
              rate: `${(p.decline_rate * 100).toFixed(0)}%`,
              tag: p.decline_rate > 0.7 ? "疑似欺诈" : p.decline_rate > 0.6 ? "异常高拒" : "质量偏低"
            }));

          // Format evidence table
          const evidenceColumns = [
            { key: "publisher_name", label: "Publisher" },
            { key: "total_revenue", label: "Total GMV" },
            { key: "approved_revenue", label: "Approved" },
            { key: "pending_revenue", label: "Pending" },
            { key: "declined_revenue", label: "Declined" },
            { key: "approval_rate", label: "Approval %" },
          ];

          const evidenceData = approvalTable.map(p => ({
            ...p,
            total_revenue: `$${(p.total_revenue / 1000).toFixed(0)}K`,
            approved_revenue: `$${(p.approved_revenue / 1000).toFixed(0)}K`,
            pending_revenue: `$${(p.pending_revenue / 1000).toFixed(0)}K`,
            declined_revenue: `$${(p.declined_revenue / 1000).toFixed(0)}K`,
            approval_rate: `${(p.approval_rate * 100).toFixed(0)}%`,
          }));

          const conclusionStatus = approvalRate >= 0.85 ? "good" : approvalRate >= 0.7 ? "warning" : "bad";
          const conclusion = section?.conclusion || `整体 Approval Rate ${(approvalRate * 100).toFixed(0)}%，${approvalRate < 0.85 ? '低于 85% 健康线' : '达标'}。Declined 金额 $${(declinedGMV / 1000).toFixed(0)}K。`;

          return (
            <>
              <SectionLayout
                conclusion={conclusion}
                conclusionStatus={conclusionStatus}
                derivationNotes={derivationNotes}
              >
                {/* Waterfall */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6">
                  <h3 className="text-sm font-semibold text-slate-700 mb-4">GMV 审批瀑布</h3>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={waterfallData} barCategoryGap="30%">
                        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#64748B" }} />
                        <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} />
                        <Tooltip
                          contentStyle={{ borderRadius: 12, border: "1px solid #E2E8F0" }}
                          formatter={(v) => [`$${(v / 1000).toFixed(0)}K`]}
                        />
                        <Bar dataKey="value" radius={[8, 8, 0, 0]} barSize={56}>
                          {waterfallData.map((entry, idx) => (
                            <Cell key={idx} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Summary stats */}
                  <div className="grid grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-100">
                    {waterfallData.map((d) => (
                      <div key={d.name} className="text-center">
                        <p className="text-lg font-bold text-slate-900">{d.label}</p>
                        <p className="text-xs text-slate-500">{d.name}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Risk publishers */}
                {riskPublishers.length > 0 && (
                  <div className="bg-white rounded-2xl border border-slate-200 p-6">
                    <h3 className="text-sm font-semibold text-red-600 mb-3">⚠ 高拒绝率 Publisher</h3>
                    <div className="space-y-2">
                      {riskPublishers.map((p) => (
                        <div key={p.name} className="flex items-center justify-between p-3 bg-red-50/50 rounded-xl border border-red-100">
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-semibold text-slate-800">{p.name}</span>
                            <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px]">{p.tag}</Badge>
                          </div>
                          <div className="flex items-center gap-4 text-xs">
                            <span className="text-slate-500">Declined: <span className="text-red-600 font-semibold">{p.declined}</span></span>
                            <span className="text-slate-500">Decline Rate: <span className="text-red-600 font-semibold">{p.rate}</span></span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <EvidenceTable
                  title="交易质量明细"
                  columns={evidenceColumns}
                  data={evidenceData}
                  derivationNotes={derivationNotes}
                />
              </SectionLayout>

              <InsightsPanel
                insights={[
                  "Approval Rate是衡量交易质量的核心指标，直接影响实际收入和Publisher信心",
                  "健康的联盟计划Approval Rate应≥85%，低于70%说明存在严重的欺诈或质量问题",
                  "Pending状态通常持续7-30天，占比过高（>20%）会影响现金流预测",
                  "Declined主要原因包括：订单取消/退货、疑似欺诈、违反条款、技术跟踪错误"
                ]}
                problems={[
                  "如果单个Publisher的Decline Rate超过50%，需立即暂停合作并启动调查",
                  "Declined集中在少数Publisher说明是渠道质量问题；如果广泛分布则可能是系统或政策问题",
                  "持续的低Approval Rate会导致优质Publisher流失，形成恶性循环"
                ]}
              />
            </>
          );
        }}
      </DataLoader>
    </div>
  );
}