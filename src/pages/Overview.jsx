import React, { useState } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "../utils";
import KPICard from "../components/dashboard/KPICard";
import RiskOpportunityCard from "../components/dashboard/RiskOpportunityCard";
import DatasetSelector from "../components/dashboard/DatasetSelector";
import DataLoader from "../components/dashboard/DataLoader";
import { Button } from "@/components/ui/button";
import { FileText, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { useLanguage } from "@/components/LanguageContext";

export default function Overview() {
  const [selectedDataset, setSelectedDataset] = useState(null);
  const { t } = useLanguage();
  const ov = t('overview');
  return (
    <div className="space-y-8 max-w-[1400px] mx-auto">
      {/* Page header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{ov.title}</h1>
          <p className="text-sm text-slate-500 mt-1">{ov.subtitle}</p>
        </div>
        <div className="flex gap-2">
          <DatasetSelector value={selectedDataset} onChange={setSelectedDataset} />
          <Link to={createPageUrl("ReportCenter")}>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <FileText className="w-3.5 h-3.5" />
              {ov.generateReport}
            </Button>
          </Link>
        </div>
      </div>

      <DataLoader datasetId={selectedDataset}>
        {({ getMetric, getTable, getSection }) => {
          const totalPubs = getMetric('total_publishers');
          const activePubs = getMetric('active_publishers');
          const activeRatio = getMetric('active_ratio');
          const totalGMV = getMetric('total_gmv');
          const gmvPerActive = getMetric('gmv_per_active');
          const top10Share = getMetric('top10_share');
          const approvalRate = getMetric('approval_rate');
          const declinedGMV = getMetric('total_declined_gmv');

          // Get publisher type shares
          const contentShare = getMetric('content_share') || 0;
          const dealShare = getMetric('deal_coupon_share') || 0;

          // Build KPIs from real data
          const kpis = [
            {
              title: "Active Ratio",
              value: `${(activeRatio * 100).toFixed(0)}%`,
              target: "40%",
              status: activeRatio >= 0.4 ? "green" : activeRatio >= 0.3 ? "yellow" : "red",
              evidenceRows: [
                { label: ov.labels.totalPubs, value: totalPubs.toString() },
                { label: ov.labels.activePubs, value: activePubs.toString() },
                { label: ov.labels.activeDef, value: "" },
              ],
            },
            {
              title: `Content GMV ${t('concentration.cols.pct') === 'pct' ? 'Share' : t('concentration.cols.pct')}`,
              value: `${(contentShare * 100).toFixed(0)}%`,
              target: "30%",
              status: contentShare >= 0.3 ? "green" : contentShare >= 0.2 ? "yellow" : "red",
              evidenceRows: [
                { label: ov.labels.contentGmv, value: `$${((contentShare * totalGMV) / 1000).toFixed(0)}K` },
                { label: ov.labels.totalGmv, value: `$${(totalGMV / 1000).toFixed(0)}K` },
              ],
            },
            {
              title: `Deal GMV ${t('concentration.cols.pct') === 'pct' ? 'Share' : t('concentration.cols.pct')}`,
              value: `${(dealShare * 100).toFixed(0)}%`,
              target: "≤35%",
              status: dealShare <= 0.35 ? "green" : dealShare <= 0.45 ? "yellow" : "red",
              evidenceRows: [
                { label: ov.labels.dealGmv, value: `$${((dealShare * totalGMV) / 1000).toFixed(0)}K` },
                { label: ov.labels.totalGmv, value: `$${(totalGMV / 1000).toFixed(0)}K` },
              ],
            },
            {
              title: "GMV/Active Publisher",
              value: `$${gmvPerActive.toFixed(0)}`,
              target: "$4,000",
              status: gmvPerActive >= 4000 ? "green" : gmvPerActive >= 3000 ? "yellow" : "red",
              evidenceRows: [
                { label: ov.labels.totalGmv, value: `$${(totalGMV / 1000).toFixed(0)}K` },
                { label: ov.labels.activePubs, value: activePubs.toString() },
              ],
            },
            {
              title: "Top10 GMV Share",
              value: `${(top10Share * 100).toFixed(0)}%`,
              target: "≤50%",
              status: top10Share <= 0.5 ? "green" : top10Share <= 0.6 ? "yellow" : "red",
              evidenceRows: [
                { label: "Top10 GMV", value: `$${((top10Share * totalGMV) / 1000).toFixed(0)}K` },
                { label: ov.labels.totalGmv, value: `$${(totalGMV / 1000).toFixed(0)}K` },
              ],
            },
            {
              title: "Approval Rate",
              value: `${(approvalRate * 100).toFixed(0)}%`,
              target: "≥85%",
              status: approvalRate >= 0.85 ? "green" : approvalRate >= 0.7 ? "yellow" : "red",
              evidenceRows: [
                { label: "Approval Rate", value: `${(approvalRate * 100).toFixed(1)}%` },
                { label: "Declined GMV", value: `$${(declinedGMV / 1000).toFixed(0)}K` },
              ],
            },
          ];

          // Get high-decline publishers for risk
          const approvalTable = getTable('approval_table');
          const topDeclined = approvalTable
            .filter(p => p.declined_revenue > 0)
            .sort((a, b) => b.declined_revenue - a.declined_revenue)
            .slice(0, 3);

          const r = ov.risks;
          const op = ov.opportunities;
          const isEn = t('nav.overview') === 'Overview';

          const risks = [
            {
              title: r.concentrationTitle,
              trigger: `Top10 Publisher ${isEn ? 'contributes' : '贡献'} ${(top10Share * 100).toFixed(0)}% GMV${top10Share > 0.5 ? (isEn ? ', far exceeds 50% threshold' : '，远超 50% 警戒线') : ''}. ${isEn ? 'Loss of any top publisher would cause significant revenue impact.' : '任一流失将造成显著收入波动'}`,
              action: r.concentrationAction,
              owner: r.concentrationOwner,
              deadline: "Q2 2026",
              linkPage: "Concentration",
            },
            {
              title: r.dealTitle,
              trigger: `Deal GMV ${isEn ? 'share' : '占比'} ${(dealShare * 100).toFixed(0)}%${dealShare > 0.35 ? (isEn ? ', exceeds 35% healthy limit' : '，超出 35% 健康上限') : ''}. ${isEn ? 'Discount dependency and margin erosion risk.' : '存在折扣依赖与利润侵蚀风险'}`,
              action: r.dealAction,
              owner: r.dealOwner,
              deadline: "Q1 2026",
              linkPage: "MixHealth",
            },
            {
              title: r.approvalTitle,
              trigger: `${isEn ? 'Overall Approval Rate' : '整体 Approval Rate'} ${(approvalRate * 100).toFixed(0)}%${approvalRate < 0.85 ? (isEn ? ', below 85% healthy line' : '，低于 85% 健康线') : ''}. ${isEn ? 'Declined concentrated at' : 'Declined 集中在'} ${topDeclined.map(p => p.publisher_name).join(', ')}`,
              action: r.approvalAction,
              owner: r.approvalOwner,
              deadline: "2026-03",
              linkPage: "Approval",
            },
          ];

          const opportunities = [
            {
              title: op.contentTitle,
              trigger: `Content GMV ${isEn ? 'only' : '仅'} ${(contentShare * 100).toFixed(0)}%, ${isEn ? 'but Content Publishers show above-average AOV and Approval Rate' : '但 Content Publisher 的 AOV 和 Approval Rate 均高于平均'}`,
              action: op.contentAction,
              owner: op.contentOwner,
              deadline: "Q2 2026",
              linkPage: "Activation",
            },
            {
              title: op.activationTitle,
              trigger: `${isEn ? 'Current active rate' : '当前活跃率'} ${(activeRatio * 100).toFixed(0)}%, ${totalPubs - activePubs} ${isEn ? 'publishers have no revenue' : '个 Publisher 未产生收入'}`,
              action: op.activationAction,
              owner: op.activationOwner,
              deadline: "Q2 2026",
              linkPage: "Activation",
            },
            {
              title: op.outputTitle,
              trigger: `GMV/Active Publisher $${gmvPerActive.toFixed(0)}${gmvPerActive < 4000 ? (isEn ? ', below target' : '，低于目标') : ''}, ${isEn ? 'room for improvement' : '存在提升空间'}`,
              action: op.outputAction,
              owner: op.outputOwner,
              deadline: "2026-04",
              linkPage: "Efficiency",
            },
          ];

          return (
            <>
              {/* KPI Cockpit */}
              <div>
                <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">{ov.coreKpis}</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {kpis.map((kpi, i) => (
                    <KPICard key={i} {...kpi} />
                  ))}
                </div>
              </div>

              {/* Risks & Opportunities */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h2 className="text-sm font-semibold text-red-500/80 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500" />
                    {ov.top3Risks}
                  </h2>
                  <div className="space-y-3">
                    {risks.map((r, i) => (
                      <RiskOpportunityCard key={i} type="risk" {...r} />
                    ))}
                  </div>
                </div>

                <div>
                  <h2 className="text-sm font-semibold text-blue-500/80 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    {ov.top3Opportunities}
                  </h2>
                  <div className="space-y-3">
                    {opportunities.map((o, i) => (
                      <RiskOpportunityCard key={i} type="opportunity" {...o} />
                    ))}
                  </div>
                </div>
              </div>

              {/* Quick links */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">{ov.quickLinks}</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {[
                    { label: ov.quickLinkLabels.activation, page: "Activation" },
                    { label: ov.quickLinkLabels.concentration, page: "Concentration" },
                    { label: ov.quickLinkLabels.mixHealth, page: "MixHealth" },
                    { label: ov.quickLinkLabels.efficiency, page: "Efficiency" },
                    { label: ov.quickLinkLabels.approval, page: "Approval" },
                    { label: ov.quickLinkLabels.operatingSystem, page: "OperatingSystem" },
                    { label: ov.quickLinkLabels.actionPlan, page: "ActionPlan" },
                    { label: ov.quickLinkLabels.input, page: "Input" },
                  ].map((link) => (
                    <Link
                      key={link.page}
                      to={createPageUrl(link.page)}
                      className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors group"
                    >
                      <span className="text-sm text-slate-600 group-hover:text-slate-800">{link.label}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 transition-colors" />
                    </Link>
                  ))}
                </div>
              </div>
            </>
          );
        }}
      </DataLoader>
    </div>
  );
}