import React from "react";
import SectionLayout from "../components/dashboard/SectionLayout";
import EvidenceTable from "../components/dashboard/EvidenceTable";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

const funnelData = [
  { name: "Total", value: 1245, color: "#94A3B8" },
  { name: "Active", value: 398, color: "#3B82F6" },
  { name: "Core Drivers", value: 45, color: "#2563EB" },
];

const evidenceColumns = [
  { key: "name", label: "Publisher" },
  { key: "type", label: "类型" },
  { key: "gmv", label: "GMV" },
  { key: "cpa", label: "CPA" },
  { key: "status", label: "状态" },
];
const evidenceData = [
  { name: "RetailMeNot", type: "Deal/Coupon", gmv: "$85,000", cpa: "$12.30", status: "Active" },
  { name: "Wirecutter", type: "Content", gmv: "$62,000", cpa: "$18.50", status: "Active" },
  { name: "Rakuten", type: "Loyalty", gmv: "$54,000", cpa: "$8.90", status: "Active" },
  { name: "BuzzFeed", type: "Content", gmv: "$31,000", cpa: "$22.10", status: "Active" },
  { name: "Honey", type: "Tech/Sub", gmv: "$28,500", cpa: "$6.40", status: "Active" },
];

const derivationNotes = [
  {
    title: "口径定义",
    items: [
      { label: "Active", value: "total_revenue > 0" },
      { label: "去重", value: "PublisherID 优先，缺失时用 publisher_name" },
      { label: "Core Driver", value: "Top contributors reaching 80% cumulative GMV" },
    ],
  },
  {
    title: "计算步骤",
    items: [
      { label: "Step 1", value: "筛选 total_revenue > 0 得到 Active 集合" },
      { label: "Step 2", value: "按 total_revenue desc 排序" },
      { label: "Step 3", value: "累计至 80% 确定 Core Drivers" },
    ],
  },
];

export default function Activation() {
  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">激活漏斗</h1>
        <p className="text-sm text-slate-500 mt-1">从 Total 到 Active 到 Core Drivers 的转化全景</p>
      </div>

      <SectionLayout
        conclusion="当前激活率 32%，低于 40% 目标线。398 个活跃 Publisher 中仅 45 个为 Core Driver，存在中腰部断层。"
        conclusionStatus="warning"
        derivationNotes={derivationNotes}
      >
        {/* Funnel chart */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Publisher 激活漏斗</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funnelData} layout="vertical" barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 12, fill: "#94A3B8" }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 13, fill: "#475569", fontWeight: 500 }} width={100} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: "1px solid #E2E8F0", boxShadow: "0 4px 12px rgba(0,0,0,0.06)" }}
                  formatter={(value) => [`${value} publishers`, "数量"]}
                />
                <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={36}>
                  {funnelData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Mini stats */}
          <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-slate-100">
            {funnelData.map((d) => (
              <div key={d.name} className="text-center">
                <p className="text-2xl font-bold text-slate-900 tabular-nums">{d.value.toLocaleString()}</p>
                <p className="text-xs text-slate-500 mt-0.5">{d.name}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Evidence table */}
        <EvidenceTable
          title="Active Publisher 明细"
          columns={evidenceColumns}
          data={evidenceData}
          derivationNotes={derivationNotes}
        />
      </SectionLayout>
    </div>
  );
}