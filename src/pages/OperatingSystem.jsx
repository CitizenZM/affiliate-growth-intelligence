import React, { useState } from "react";
import SectionLayout from "../components/dashboard/SectionLayout";
import InsightsPanel from "../components/dashboard/InsightsPanel";
import DatasetSelector from "../components/dashboard/DatasetSelector";
import DataLoader from "../components/dashboard/DataLoader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, Users, Star, TrendingUp, AlertTriangle } from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";

const tierConfigsBase = [
  { icon: Star, color: "from-amber-500 to-orange-500", bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-800" },
  { icon: TrendingUp, color: "from-blue-500 to-indigo-500", bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-800" },
  { icon: Users, color: "from-slate-400 to-slate-500", bg: "bg-slate-50", border: "border-slate-200", text: "text-slate-700" },
  { icon: AlertTriangle, color: "from-red-400 to-red-500", bg: "bg-red-50", border: "border-red-200", text: "text-red-700" },
];

const getDerivationNotes = (os) => [
  {
    title: os.derivation.title,
    items: [
      { label: "Tier 1", value: os.derivation.tier1 },
      { label: "Tier 2", value: os.derivation.tier2 },
      { label: "Tier 3", value: os.derivation.tier3 },
      { label: "Tier 4", value: os.derivation.tier4 },
    ],
  },
];

export default function OperatingSystem() {
  const [selectedDataset, setSelectedDataset] = useState(null);
  const { t } = useLanguage();
  const os = t('operatingSystem');
  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{os.title}</h1>
          <p className="text-sm text-slate-500 mt-1">{os.subtitle}</p>
        </div>
        <div className="flex gap-2">
          <DatasetSelector value={selectedDataset} onChange={setSelectedDataset} />
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            <Download className="w-3.5 h-3.5" /> {os.exportBtn}
          </Button>
        </div>
      </div>

      <DataLoader datasetId={selectedDataset}>
        {({ getMetric, getTable, getSection, allPublishers }) => {
          const section = getSection(6);
          const totalGMV = getMetric('total_gmv');
          
          // Get all publishers and sort by revenue
          const sortedPublishers = allPublishers
            .filter(p => p.total_revenue > 0)
            .sort((a, b) => (b.total_revenue || 0) - (a.total_revenue || 0));
          
          const inactiveCount = allPublishers.filter(p => !p.total_revenue || p.total_revenue === 0).length;
          
          // Calculate tiers based on cumulative GMV
          let cumGMV = 0;
          const tier1 = [];
          const tier2 = [];
          const tier3 = [];
          
          sortedPublishers.forEach(pub => {
            cumGMV += pub.total_revenue || 0;
            const cumPct = cumGMV / totalGMV;
            
            if (cumPct <= 0.5) {
              tier1.push(pub);
            } else if (cumPct <= 0.8) {
              tier2.push(pub);
            } else {
              tier3.push(pub);
            }
          });
          
          const tier1GMV = tier1.reduce((s, p) => s + (p.total_revenue || 0), 0);
          const tier2GMV = tier2.reduce((s, p) => s + (p.total_revenue || 0), 0);
          const tier3GMV = tier3.reduce((s, p) => s + (p.total_revenue || 0), 0);
          
          const tierLabels = [os.tiers.tier1, os.tiers.tier2, os.tiers.tier3, os.tiers.tier4];
          const tierStrategies = [os.tiers.tier1Strategy, os.tiers.tier2Strategy, os.tiers.tier3Strategy, os.tiers.tier4Strategy];

          const tiers = [
            {
              ...tierConfigsBase[0],
              name: tierLabels[0],
              strategy: tierStrategies[0],
              count: tier1.length,
              gmv: `$${(tier1GMV / 1000).toFixed(0)}K`,
              gmvPct: `${((tier1GMV / totalGMV) * 100).toFixed(0)}%`,
              publishers: tier1.slice(0, 5).map(p => p.publisher_name || p.publisher_id).concat(tier1.length > 5 ? [`+${tier1.length - 5} more`] : []),
            },
            {
              ...tierConfigsBase[1],
              name: tierLabels[1],
              strategy: tierStrategies[1],
              count: tier2.length,
              gmv: `$${(tier2GMV / 1000).toFixed(0)}K`,
              gmvPct: `${((tier2GMV / totalGMV) * 100).toFixed(0)}%`,
              publishers: tier2.slice(0, 4).map(p => p.publisher_name || p.publisher_id).concat(tier2.length > 4 ? [`+${tier2.length - 4} more`] : []),
            },
            {
              ...tierConfigsBase[2],
              name: tierLabels[2],
              strategy: tierStrategies[2],
              count: tier3.length,
              gmv: `$${(tier3GMV / 1000).toFixed(0)}K`,
              gmvPct: `${((tier3GMV / totalGMV) * 100).toFixed(0)}%`,
              publishers: tier3.slice(0, 3).map(p => p.publisher_name || p.publisher_id).concat(tier3.length > 3 ? [`+${tier3.length - 3} more`] : []),
            },
            {
              ...tierConfigsBase[3],
              name: tierLabels[3],
              strategy: tierStrategies[3],
              count: inactiveCount,
              gmv: "$0",
              gmvPct: "0%",
              publishers: [],
            },
          ];
          
          const isEn = t('nav.overview') === 'Overview';
          const conclusion = section?.conclusion || (isEn
            ? `Currently ${tier1.length} Hero Publishers contribute ${((tier1GMV / totalGMV) * 100).toFixed(0)}% GMV, ${tier2.length} Growth publishers contribute ${((tier2GMV / totalGMV) * 100).toFixed(0)}%. Recommend accelerating Long Tail incubation into the Growth tier.`
            : `当前 ${tier1.length} 个 Hero Publisher 贡献 ${((tier1GMV / totalGMV) * 100).toFixed(0)}% GMV，${tier2.length} 个 Growth 贡献 ${((tier2GMV / totalGMV) * 100).toFixed(0)}%。建议从 Long Tail 中加速孵化进入 Growth 层。`);
          
          return (
            <>
              <SectionLayout
                conclusion={conclusion}
                conclusionStatus={section?.conclusion_status || "neutral"}
                derivationNotes={getDerivationNotes(os)}
              >
                {/* Pyramid */}
                <div className="space-y-3">
                  {tiers.map((tier, i) => (
                    <div key={tier.name} className={`bg-white rounded-2xl border ${tier.border} p-5 transition-all hover:shadow-md`}>
                      <div className="flex items-start gap-4">
                        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${tier.color} flex items-center justify-center text-white shadow-sm flex-shrink-0`}>
                          <tier.icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-bold text-slate-800">{tier.name}</h3>
                            <div className="flex items-center gap-3">
                              <Badge className={`${tier.bg} ${tier.text} text-[11px]`}>{tier.count} publishers</Badge>
                              <span className="text-sm font-bold text-slate-900 tabular-nums">{tier.gmv}</span>
                              <span className="text-xs text-slate-400">({tier.gmvPct})</span>
                            </div>
                          </div>
                          
                          <div className={`${tier.bg} rounded-lg p-3 mb-2`}>
                            <p className="text-xs font-medium text-slate-600">
                              <span className={`${tier.text} font-semibold`}>{os.strategy}: </span>
                              {tier.strategy}
                            </p>
                          </div>

                          {tier.publishers.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {tier.publishers.map((p) => (
                                <span key={p} className="text-[11px] px-2 py-0.5 bg-slate-100 rounded-md text-slate-600">{p}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Width bar proportional */}
                      <div className="mt-3">
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full bg-gradient-to-r ${tier.color}`}
                            style={{ width: tier.gmvPct }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </SectionLayout>

              <InsightsPanel
                insights={isEn ? [
                  "The four-tier pyramid model is the standard for mature affiliate programs, maximizing ROI through differentiated strategies",
                  "Tier 1 Hero typically has 10-15 publishers but contributes 50%+ GMV, requiring the highest level of resource investment and relationship management",
                  "Tier 2 Growth is the future Hero pipeline — tiered incentives and nurturing can accelerate promotion to Tier 1",
                  "Tier 3 Long Tail has low individual output but large volume; automated operations enable scalable management",
                  "Tier 4 Inactive should be periodically cleaned up to avoid consuming system resources and lowering operational efficiency"
                ] : [
                  "四层金字塔模型是成熟联盟计划的标配，通过差异化运营策略最大化ROI",
                  "Tier 1 Hero通常占10-15个Publisher但贡献50%+ GMV，需要最高级别的资源投入和关系维护",
                  "Tier 2 Growth是未来的Hero储备，通过阶梯式激励和培育可快速提升至Tier 1",
                  "Tier 3 Long Tail虽然单体产出低，但总量庞大，通过自动化运营可实现规模化",
                  "Tier 4 Inactive需要定期清理，避免占用系统资源和降低运营效率"
                ]}
                problems={isEn ? [
                  "If Tier 1 accounts for over 70% of GMV, it indicates over-reliance on top publishers — accelerate Tier 2 development",
                  "If Tier 4 exceeds 60%, activation rate is too low — optimize recruitment quality or launch an activation campaign",
                  "The promotion path from Tier 3 to Tier 2 must be clear, with defined KPIs and incentive mechanisms"
                ] : [
                  "如果Tier 1占比超过70%，说明过度依赖头部，抗风险能力弱，需要加速培育Tier 2",
                  "Tier 4占比超过60%说明激活率低，需要优化招商质量或启动激活campaign",
                  "从Tier 3到Tier 2的晋升通道应该是明确的，需要设定清晰的KPI和激励机制"
                ]}
              />
            </>
          );
        }}
      </DataLoader>
    </div>
  );
}