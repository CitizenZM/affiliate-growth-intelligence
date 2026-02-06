import React from "react";
import SectionLayout from "../components/dashboard/SectionLayout";
import InsightsPanel from "../components/dashboard/InsightsPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, Users, Star, TrendingUp, AlertTriangle } from "lucide-react";

const tiers = [
  {
    name: "Tier 1 — Hero",
    icon: Star,
    color: "from-amber-500 to-orange-500",
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-800",
    count: 10,
    gmv: "$680K",
    gmvPct: "50%",
    strategy: "专属佣金率 + 联合内容 + 季度 QBR + 独家促销窗口",
    publishers: ["RetailMeNot", "Rakuten", "Honey", "Wirecutter"],
  },
  {
    name: "Tier 2 — Growth",
    icon: TrendingUp,
    color: "from-blue-500 to-indigo-500",
    bg: "bg-blue-50",
    border: "border-blue-200",
    text: "text-blue-800",
    count: 35,
    gmv: "$408K",
    gmvPct: "30%",
    strategy: "阶梯佣金激励 + 内容模板支持 + 月度 Performance Review",
    publishers: ["BuzzFeed", "CNN Underscored", "TopCashback", "SlickDeals"],
  },
  {
    name: "Tier 3 — Long Tail",
    icon: Users,
    color: "from-slate-400 to-slate-500",
    bg: "bg-slate-50",
    border: "border-slate-200",
    text: "text-slate-700",
    count: 353,
    gmv: "$272K",
    gmvPct: "20%",
    strategy: "标准佣金 + 自动化邮件 Nurture + 季度批量激活活动",
    publishers: ["CouponFollow", "TechRadar", "+349 more"],
  },
  {
    name: "Tier 4 — Inactive",
    icon: AlertTriangle,
    color: "from-red-400 to-red-500",
    bg: "bg-red-50",
    border: "border-red-200",
    text: "text-red-700",
    count: 847,
    gmv: "$0",
    gmvPct: "0%",
    strategy: "季度激活邮件 + 连续 6 月无效自动清理 + 治理白名单排除",
    publishers: [],
  },
];

const derivationNotes = [
  {
    title: "分层规则",
    items: [
      { label: "Tier 1", value: "Top contributors 达 50% GMV" },
      { label: "Tier 2", value: "50%-80% GMV 区间" },
      { label: "Tier 3", value: "active but < 80% 区间" },
      { label: "Tier 4", value: "total_revenue = 0" },
    ],
  },
];

export default function OperatingSystem() {
  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">分层治理</h1>
          <p className="text-sm text-slate-500 mt-1">四层金字塔模型，差异化运营策略</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            <Download className="w-3.5 h-3.5" /> 导出 Tier 名单
          </Button>
        </div>
      </div>

      <SectionLayout
        conclusion="当前 10 个 Hero Publisher 贡献 50% GMV，35 个 Growth 贡献 30%。建议从 Long Tail 中加速孵化 5 个进入 Growth 层。"
        conclusionStatus="neutral"
        derivationNotes={derivationNotes}
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
                      <span className={`${tier.text} font-semibold`}>策略: </span>
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
        insights={[
          "四层金字塔模型是成熟联盟计划的标配，通过差异化运营策略最大化ROI",
          "Tier 1 Hero通常占10-15个Publisher但贡献50%+ GMV，需要最高级别的资源投入和关系维护",
          "Tier 2 Growth是未来的Hero储备，通过阶梯式激励和培育可快速提升至Tier 1",
          "Tier 3 Long Tail虽然单体产出低，但总量庞大，通过自动化运营可实现规模化",
          "Tier 4 Inactive需要定期清理，避免占用系统资源和降低运营效率"
        ]}
        problems={[
          "如果Tier 1占比超过70%，说明过度依赖头部，抗风险能力弱，需要加速培育Tier 2",
          "Tier 4占比超过60%说明激活率低，需要优化招商质量或启动激活campaign",
          "从Tier 3到Tier 2的晋升通道应该是明确的，需要设定清晰的KPI和激励机制"
        ]}
      />
    </div>
  );
}