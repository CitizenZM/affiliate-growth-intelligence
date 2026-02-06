import React from "react";
import SectionLayout from "../components/dashboard/SectionLayout";
import EvidenceTable from "../components/dashboard/EvidenceTable";
import InsightsPanel from "../components/dashboard/InsightsPanel";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";

const gmvData = [
  { name: "Content", value: 18, color: "#3B82F6" },
  { name: "Deal/Coupon", value: 52, color: "#EF4444" },
  { name: "Loyalty/Cashback", value: 15, color: "#8B5CF6" },
  { name: "Search", value: 8, color: "#F59E0B" },
  { name: "Tech/Sub", value: 5, color: "#06B6D4" },
  { name: "Other", value: 2, color: "#94A3B8" },
];

const countData = [
  { name: "Content", count: 120, target: 180 },
  { name: "Deal/Coupon", count: 85, target: 70 },
  { name: "Loyalty", count: 45, target: 50 },
  { name: "Search", count: 60, target: 40 },
  { name: "Tech/Sub", count: 38, target: 30 },
  { name: "Other", count: 50, target: 30 },
];

const evidenceColumns = [
  { key: "type", label: "类型" },
  { key: "count", label: "数量" },
  { key: "gmv", label: "GMV" },
  { key: "gmvPct", label: "GMV 占比" },
  { key: "targetPct", label: "目标区间" },
  { key: "status", label: "状态" },
];
const evidenceData = [
  { type: "Content", count: 120, gmv: "$245K", gmvPct: "18%", targetPct: "25-35%", status: "偏低" },
  { type: "Deal/Coupon", count: 85, gmv: "$707K", gmvPct: "52%", targetPct: "≤35%", status: "超标" },
  { type: "Loyalty/Cashback", count: 45, gmv: "$204K", gmvPct: "15%", targetPct: "10-20%", status: "健康" },
  { type: "Search", count: 60, gmv: "$109K", gmvPct: "8%", targetPct: "5-15%", status: "健康" },
  { type: "Tech/Sub", count: 38, gmv: "$68K", gmvPct: "5%", targetPct: "≤10%", status: "健康" },
];

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
      { label: "目标区间", value: "基于行业 benchmark 设定" },
    ],
  },
];

export default function MixHealth() {
  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">结构健康</h1>
        <p className="text-sm text-slate-500 mt-1">GMV 类型分布与数量分布的健康度评估</p>
      </div>

      <SectionLayout
        conclusion="Deal/Coupon 渠道 GMV 占比 52%，严重超出 35% 上限。Content 渠道仅 18%，远低于 25-35% 目标区间，结构失衡风险显著。"
        conclusionStatus="bad"
        derivationNotes={derivationNotes}
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Donut - GMV */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h3 className="text-sm font-semibold text-slate-700 mb-4">GMV 类型占比</h3>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={gmvData}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={110}
                    dataKey="value"
                    stroke="none"
                    paddingAngle={2}
                  >
                    {gmvData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: "1px solid #E2E8F0" }}
                    formatter={(v) => [`${v}%`, "GMV 占比"]}
                  />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Bar - Count */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h3 className="text-sm font-semibold text-slate-700 mb-4">Publisher 数量 vs 目标</h3>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={countData} barCategoryGap="25%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94A3B8" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E2E8F0" }} />
                  <Bar dataKey="count" fill="#3B82F6" radius={[6, 6, 0, 0]} barSize={24} name="当前" />
                  <Bar dataKey="target" fill="#E2E8F0" radius={[6, 6, 0, 0]} barSize={24} name="目标" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <EvidenceTable
          title="类型结构明细"
          columns={evidenceColumns}
          data={evidenceData}
          derivationNotes={derivationNotes}
        />
      </SectionLayout>

      <InsightsPanel
        insights={[
          "Content类Publisher通常AOV最高、用户质量最好，但获客成本也较高，是品牌建设的核心渠道",
          "Deal/Coupon类能带来大量订单但利润率低，过度依赖会压缩整体利润空间",
          "Loyalty/Cashback类具有稳定的复购率，适合作为基础盘保障",
          "健康的渠道结构应该是：Content 25-35%、Deal ≤35%、Loyalty 10-20%、其他渠道补充"
        ]}
        problems={[
          "Deal类超过50%说明渠道过度促销化，长期会损害品牌价值和用户忠诚度",
          "Content类低于15%意味着缺乏高质量内容渠道，难以触达高价值用户",
          "如果某类型Publisher数量远超目标但GMV占比低，说明该类型渠道质量参差不齐，需要清理"
        ]}
      />
    </div>
  );
}