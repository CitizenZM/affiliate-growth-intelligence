import React, { useState } from "react";
import SectionLayout from "../components/dashboard/SectionLayout";
import EvidenceTable from "../components/dashboard/EvidenceTable";
import InsightsPanel from "../components/dashboard/InsightsPanel";
import DatasetSelector from "../components/dashboard/DatasetSelector";
import DataLoader from "../components/dashboard/DataLoader";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Sector } from "recharts";
import { useLanguage } from "@/components/LanguageContext";

// High-level category grouping
const HIGH_LEVEL_CATEGORIES = {
  content: { label: 'Content', color: '#3B82F6', target: { min: 25, max: 35 } },
  deal_coupon: { label: 'Deal / Coupon', color: '#EF4444', target: { min: 0, max: 35 } },
  loyalty_cashback: { label: 'Loyalty / Cashback', color: '#8B5CF6', target: { min: 10, max: 20 } },
  social_video: { label: 'Social / Video', color: '#10B981', target: { min: 5, max: 15 } },
  other: { label: 'Other', color: '#94A3B8', target: { min: 0, max: 15 } },
};

// Map granular publisher_type → high-level category
const TYPE_TO_CATEGORY = {
  content: 'content',
  deal_coupon: 'deal_coupon',
  loyalty_cashback: 'loyalty_cashback',
  social_video: 'social_video',
  search: 'other',
  tech_sub: 'other',
  other: 'other',
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



const renderActiveShape = (props) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, value } = props;
  return (
    <g>
      <text x={cx} y={cy - 12} textAnchor="middle" fill="#0F172A" className="text-base" style={{ fontSize: 22, fontWeight: 700 }}>
        {value}%
      </text>
      <text x={cx} y={cy + 14} textAnchor="middle" fill="#64748B" style={{ fontSize: 12 }}>
        {payload.name}
      </text>
      <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius + 6} startAngle={startAngle} endAngle={endAngle} fill={fill} />
      <Sector cx={cx} cy={cy} innerRadius={innerRadius - 4} outerRadius={innerRadius - 1} startAngle={startAngle} endAngle={endAngle} fill={fill} />
    </g>
  );
};

export default function MixHealth() {
  const [selectedDataset, setSelectedDataset] = useState(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const { t, language } = useLanguage();
  const mh = t('mixHealth');
  const isEn = language === 'en';

  const derivationNotes = [
    {
      title: mh.derivation.mappingTitle,
      items: [
        { label: isEn ? "Priority" : "优先级", value: mh.derivation.priority },
        { label: isEn ? "Default" : "默认", value: mh.derivation.defaultMapping },
      ],
    },
    {
      title: mh.derivation.formulaTitle,
      items: [
        { label: mh.cols.gmvShare, value: mh.derivation.gmvShare },
        { label: mh.cols.targetPct, value: mh.derivation.targetInterval },
      ],
    },
  ];

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
            conclusion = isEn
              ? `Deal/Coupon GMV share is ${dealShare.toFixed(0)}%, significantly exceeding the 35% ceiling.`
              : `Deal/Coupon 渠道 GMV 占比 ${dealShare.toFixed(0)}%，严重超出 35% 上限。`;
            conclusionStatus = 'bad';
          }
          if (contentShare < 25) {
            conclusion += isEn
              ? ` Content share is only ${contentShare.toFixed(0)}%, well below the 25-35% target range — structural imbalance risk.`
              : ` Content 渠道仅 ${contentShare.toFixed(0)}%，远低于 25-35% 目标区间，结构失衡风险显著。`;
            conclusionStatus = 'bad';
          }
          
          if (!conclusion) {
            conclusion = isEn ? 'All channel types are within target ranges — structure is healthy.' : '各渠道类型占比符合目标区间，结构健康。';
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
        insights={isEn ? [
          "Content publishers typically have the highest AOV and user quality but higher acquisition costs — core channel for brand building",
          "Deal/Coupon channels drive high order volume but low margins; over-reliance compresses overall profitability",
          "Loyalty/Cashback channels have stable repeat purchase rates, suitable as a reliable base",
          "Healthy channel structure: Content 25-35%, Deal ≤35%, Loyalty 10-20%, supplemented by other channels"
        ] : [
          "Content类Publisher通常AOV最高、用户质量最好，但获客成本也较高，是品牌建设的核心渠道",
          "Deal/Coupon类能带来大量订单但利润率低，过度依赖会压缩整体利润空间",
          "Loyalty/Cashback类具有稳定的复购率，适合作为基础盘保障",
          "健康的渠道结构应该是：Content 25-35%、Deal ≤35%、Loyalty 10-20%、其他渠道补充"
        ]}
        problems={isEn ? [
          "Deal share above 50% means the channel is over-promotionalized, which long-term damages brand value and user loyalty",
          "Content share below 15% means a lack of high-quality content channels, making it hard to reach high-value users",
          "If a publisher type's count far exceeds target but GMV share is low, channel quality is inconsistent and needs cleanup"
        ] : [
          "Deal类超过50%说明渠道过度促销化，长期会损害品牌价值和用户忠诚度",
          "Content类低于15%意味着缺乏高质量内容渠道，难以触达高价值用户",
          "如果某类型Publisher数量远超目标但GMV占比低，说明该类型渠道质量参差不齐，需要清理"
        ]}
      />
    </div>
  );
}