import React, { useState } from "react";
import SectionLayout from "../components/dashboard/SectionLayout";
import EvidenceTable from "../components/dashboard/EvidenceTable";
import InsightsPanel from "../components/dashboard/InsightsPanel";
import DatasetSelector from "../components/dashboard/DatasetSelector";
import DataLoader from "../components/dashboard/DataLoader";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { useLanguage } from "@/components/LanguageContext";

const typeColors = {
  'content': "#3B82F6",
  'deal_coupon': "#EF4444",
  'loyalty_cashback': "#8B5CF6",
  'search': "#F59E0B",
  'tech_sub': "#06B6D4",
  'social_video': "#10B981",
  'other': "#94A3B8"
};

const typeTargets = {
  'content': { min: 25, max: 35 },
  'deal_coupon': { min: 0, max: 35 },
  'loyalty_cashback': { min: 10, max: 20 },
  'search': { min: 5, max: 15 },
  'tech_sub': { min: 0, max: 10 },
  'social_video': { min: 5, max: 15 },
  'other': { min: 0, max: 10 }
};

const typeLabels = {
  'content': 'Content',
  'deal_coupon': 'Deal/Coupon',
  'loyalty_cashback': 'Loyalty/Cashback',
  'search': 'Search',
  'tech_sub': 'Tech/Sub',
  'social_video': 'Social/Video',
  'other': 'Other'
};

const evidenceColumns = [
  { key: "type", label: "类型" },
  { key: "count", label: "数量" },
  { key: "gmv", label: "GMV" },
  { key: "gmv_share", label: "GMV 占比" },
  { key: "targetPct", label: "目标区间" },
  { key: "status", label: "状态" },
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
  const [selectedDataset, setSelectedDataset] = useState(null);
  const { t } = useLanguage();
  const mh = t('mixHealth');

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{mh.title}</h1>
          <p className="text-sm text-slate-500 mt-1">{mh.subtitle}</p>
        </div>
        <DatasetSelector value={selectedDataset} onChange={setSelectedDataset} />
      </div>

      <DataLoader datasetId={selectedDataset}>
        {({ getTable, getMetric }) => {
          const mixHealthTable = getTable('mix_health_table');
          const totalGMV = getMetric('total_gmv');

          // Build chart data from real data
          const gmvData = mixHealthTable.map(item => ({
            name: typeLabels[item.type] || item.type,
            value: parseFloat(item.gmv_share),
            color: typeColors[item.type] || typeColors.other
          }));

          const countData = mixHealthTable.map(item => ({
            name: typeLabels[item.type] || item.type,
            count: item.count,
            target: Math.round(item.count * 1.2) // Simple target estimation
          }));

          // Build evidence table
          const evidenceData = mixHealthTable.map(item => {
            const gmvPct = parseFloat(item.gmv_share);
            const target = typeTargets[item.type] || { min: 0, max: 100 };
            let status = mh.statusLabels.healthy;
            let targetPct = `${target.min}-${target.max}%`;
            
            if (target.max === target.min) {
              targetPct = `≤${target.max}%`;
            }
            
            if (gmvPct > target.max) {
              status = mh.statusLabels.exceed;
            } else if (gmvPct < target.min) {
              status = mh.statusLabels.low;
            }

            return {
              type: typeLabels[item.type] || item.type,
              count: item.count,
              gmv: `$${(item.gmv / 1000).toFixed(0)}K`,
              gmv_share: item.gmv_share,
              targetPct,
              status
            };
          });

          // Calculate deal share for conclusion
          const dealItem = mixHealthTable.find(t => t.type === 'deal_coupon');
          const contentItem = mixHealthTable.find(t => t.type === 'content');
          const dealShare = dealItem ? parseFloat(dealItem.gmv_share) : 0;
          const contentShare = contentItem ? parseFloat(contentItem.gmv_share) : 0;

          let conclusion = '';
          let conclusionStatus = 'good';
          
          if (dealShare > 35) {
            conclusion = `Deal/Coupon 渠道 GMV 占比 ${dealShare.toFixed(0)}%，严重超出 35% 上限。`;
            conclusionStatus = 'bad';
          }
          if (contentShare < 25) {
            conclusion += ` Content 渠道仅 ${contentShare.toFixed(0)}%，远低于 25-35% 目标区间，结构失衡风险显著。`;
            conclusionStatus = 'bad';
          }
          
          if (!conclusion) {
            conclusion = '各渠道类型占比符合目标区间，结构健康。';
            conclusionStatus = 'good';
          }

          return (
            <SectionLayout
              conclusion={conclusion}
              conclusionStatus={conclusionStatus}
              derivationNotes={derivationNotes}
            >
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Donut - GMV */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6">
                  <h3 className="text-sm font-semibold text-slate-700 mb-4">{mh.gmvChartTitle}</h3>
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
                  <h3 className="text-sm font-semibold text-slate-700 mb-4">{mh.countChartTitle}</h3>
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={countData} barCategoryGap="25%">
                        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94A3B8" }} />
                        <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} />
                        <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E2E8F0" }} />
                        <Bar dataKey="count" fill="#3B82F6" radius={[6, 6, 0, 0]} barSize={24} name={mh.current} />
                        <Bar dataKey="target" fill="#E2E8F0" radius={[6, 6, 0, 0]} barSize={24} name={mh.target} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              <EvidenceTable
                title={mh.tableTitle}
                columns={[
                  { key: "type", label: mh.cols.type },
                  { key: "count", label: mh.cols.count },
                  { key: "gmv", label: mh.cols.gmv },
                  { key: "gmv_share", label: mh.cols.gmvShare },
                  { key: "targetPct", label: mh.cols.targetPct },
                  { key: "status", label: mh.cols.status },
                ]}
                data={evidenceData}
                derivationNotes={derivationNotes}
              />
            </SectionLayout>
          );
        }}
      </DataLoader>

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