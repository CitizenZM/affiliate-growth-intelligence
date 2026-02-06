import React from "react";
import SectionLayout from "../components/dashboard/SectionLayout";
import EvidenceTable from "../components/dashboard/EvidenceTable";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Badge } from "@/components/ui/badge";

const waterfallData = [
  { name: "Total GMV", value: 1360000, fill: "#94A3B8", label: "$1.36M" },
  { name: "Approved", value: 1060800, fill: "#16A34A", label: "$1.06M" },
  { name: "Pending", value: 163200, fill: "#F59E0B", label: "$163K" },
  { name: "Declined", value: 136000, fill: "#DC2626", label: "$136K" },
];

const riskPublishers = [
  { name: "CouponFollow", declined: "$45K", rate: "62%", tag: "异常高拒" },
  { name: "DealSpy", declined: "$38K", rate: "71%", tag: "疑似欺诈" },
  { name: "BargainHunt", declined: "$21K", rate: "55%", tag: "质量偏低" },
];

const evidenceColumns = [
  { key: "name", label: "Publisher" },
  { key: "total", label: "Total GMV" },
  { key: "approved", label: "Approved" },
  { key: "pending", label: "Pending" },
  { key: "declined", label: "Declined" },
  { key: "rate", label: "Approval %" },
];
const evidenceData = [
  { name: "RetailMeNot", total: "$312K", approved: "$281K", pending: "$19K", declined: "$12K", rate: "90%" },
  { name: "Rakuten", total: "$168K", approved: "$147K", pending: "$13K", declined: "$8K", rate: "87%" },
  { name: "Honey", total: "$132K", approved: "$122K", pending: "$7K", declined: "$3K", rate: "92%" },
  { name: "CouponFollow", total: "$22K", approved: "$8K", pending: "$1K", declined: "$13K", rate: "38%" },
  { name: "DealSpy", total: "$15K", approved: "$4K", pending: "$1K", declined: "$10K", rate: "29%" },
];

const derivationNotes = [
  {
    title: "口径定义",
    items: [
      { label: "Approved", value: "status = 'approved'" },
      { label: "Pending", value: "status = 'pending'" },
      { label: "Declined", value: "status = 'declined' 或 'reversed'" },
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
  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">交易质量</h1>
        <p className="text-sm text-slate-500 mt-1">Approval/Pending/Declined 分布与异常 Publisher 识别</p>
      </div>

      <SectionLayout
        conclusion="整体 Approval Rate 78%，低于 85% 健康线。Declined 金额 $136K，集中在 3 个 Publisher，建议启动治理审查。"
        conclusionStatus="warning"
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
                <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} tickFormatter={(v) => `$${(v / 1000000).toFixed(1)}M`} />
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

        <EvidenceTable
          title="交易质量明细"
          columns={evidenceColumns}
          data={evidenceData}
          derivationNotes={derivationNotes}
        />
      </SectionLayout>
    </div>
  );
}