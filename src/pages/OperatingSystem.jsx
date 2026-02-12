import React, { useState } from "react";
import SectionLayout from "../components/dashboard/SectionLayout";
import InsightsPanel from "../components/dashboard/InsightsPanel";
import DatasetSelector from "../components/dashboard/DatasetSelector";
import DataLoader from "../components/dashboard/DataLoader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, Users, Star, TrendingUp, AlertTriangle } from "lucide-react";

const tierMeta = {
  "Tier 1": { icon: Star, color: "from-amber-500 to-orange-500", bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-800" },
  "Tier 2": { icon: TrendingUp, color: "from-blue-500 to-indigo-500", bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-800" },
  "Tier 3": { icon: Users, color: "from-slate-400 to-slate-500", bg: "bg-slate-50", border: "border-slate-200", text: "text-slate-700" },
  "Tier 4": { icon: AlertTriangle, color: "from-red-400 to-red-500", bg: "bg-red-50", border: "border-red-200", text: "text-red-700" },
};

const derivationNotes = [
  {
    title: "分层规则",
    items: [
      { label: "Tier 1", value: "Top 10 by GMV" },
      { label: "Tier 2", value: "Top 11-50 by GMV" },
      { label: "Tier 3", value: "其余 active publisher" },
      { label: "Tier 4", value: "total_revenue = 0" },
    ],
  },
];

export default function OperatingSystem() {
  const [datasetId, setDatasetId] = useState(null);

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">分层治理</h1>
          <p className="text-sm text-slate-500 mt-1">四层金字塔模型，差异化运营策略</p>
        </div>
        <div className="flex gap-2">
          <DatasetSelector value={datasetId} onChange={setDatasetId} />
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            <Download className="w-3.5 h-3.5" /> 导出 Tier 名单
          </Button>
        </div>
      </div>

      <DataLoader datasetId={datasetId}>
        {({ getTable, getSection }) => {
          const section = getSection(6);
          const tiers = getTable("tier_summary");
          const totalGMV = tiers.reduce((sum, t) => sum + (Number(t.gmv) || 0), 0);

          return (
            <>
              <SectionLayout
                conclusion={section?.conclusion || "分层治理结论基于最新数据集自动生成。"}
                conclusionStatus={section?.conclusion_status || "neutral"}
                derivationNotes={section?.derivation_notes || derivationNotes}
              >
                <div className="space-y-3">
                  {tiers.map((tier) => {
                    const meta = tierMeta[tier.tier] || tierMeta["Tier 3"];
                    const Icon = meta.icon;
                    const gmvShare = totalGMV > 0 ? ((Number(tier.gmv) || 0) / totalGMV) * 100 : 0;
                    return (
                      <div key={tier.tier} className={`bg-white rounded-2xl border ${meta.border} p-5 transition-all hover:shadow-md`}>
                        <div className="flex items-start gap-4">
                          <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${meta.color} flex items-center justify-center text-white shadow-sm flex-shrink-0`}>
                            <Icon className="w-5 h-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-2">
                              <h3 className="text-sm font-bold text-slate-800">{tier.tier}</h3>
                              <div className="flex items-center gap-3">
                                <Badge className={`${meta.bg} ${meta.text} text-[11px]`}>{tier.count} publishers</Badge>
                                <span className="text-sm font-bold text-slate-900 tabular-nums">${(Number(tier.gmv || 0) / 1000).toFixed(1)}K</span>
                                <span className="text-xs text-slate-400">({gmvShare.toFixed(1)}%)</span>
                              </div>
                            </div>
                            {tier.top_publishers?.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {tier.top_publishers.map((p) => (
                                  <span key={p} className="text-[11px] px-2 py-0.5 bg-slate-100 rounded-md text-slate-600">
                                    {p}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="mt-3">
                          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full bg-gradient-to-r ${meta.color}`} style={{ width: `${gmvShare}%` }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </SectionLayout>

              <InsightsPanel
                insights={[
                  "分层页已切换为基于当前数据集的实时 Tier 计算",
                  "新数据集完成处理后，Tier 人数、GMV 和代表 Publisher 会自动更新",
                ]}
                problems={[
                  "若 Tier 1 GMV 占比持续偏高，建议同步启动 Concentration 模块的去集中化动作",
                ]}
              />
            </>
          );
        }}
      </DataLoader>
    </div>
  );
}
