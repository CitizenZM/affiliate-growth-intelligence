import React, { useState } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "../utils";
import KPICard from "../components/dashboard/KPICard";
import RiskOpportunityCard from "../components/dashboard/RiskOpportunityCard";
import DatasetSelector from "../components/dashboard/DatasetSelector";
import DataLoader from "../components/dashboard/DataLoader";
import { Button } from "@/components/ui/button";
import { FileText, Sparkles, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

export default function Overview() {
  const [selectedDataset, setSelectedDataset] = useState(null);
  return (
    <div className="space-y-8 max-w-[1400px] mx-auto">
      {/* Page header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Affiliate Growth Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">一屏掌握渠道健康度与核心风险机会</p>
        </div>
        <div className="flex gap-2">
          <DatasetSelector value={selectedDataset} onChange={setSelectedDataset} />
          <Link to={createPageUrl("ReportCenter")}>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <FileText className="w-3.5 h-3.5" />
              生成完整报告
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
                { label: "总 Publisher", value: totalPubs.toString() },
                { label: "活跃 Publisher", value: activePubs.toString() },
                { label: "活跃定义", value: "total_revenue > 0" },
              ],
            },
            {
              title: "Content GMV 占比",
              value: `${(contentShare * 100).toFixed(0)}%`,
              target: "30%",
              status: contentShare >= 0.3 ? "green" : contentShare >= 0.2 ? "yellow" : "red",
              evidenceRows: [
                { label: "Content GMV", value: `$${((contentShare * totalGMV) / 1000).toFixed(0)}K` },
                { label: "Total GMV", value: `$${(totalGMV / 1000).toFixed(0)}K` },
              ],
            },
            {
              title: "Deal GMV 占比",
              value: `${(dealShare * 100).toFixed(0)}%`,
              target: "≤35%",
              status: dealShare <= 0.35 ? "green" : dealShare <= 0.45 ? "yellow" : "red",
              evidenceRows: [
                { label: "Deal/Coupon GMV", value: `$${((dealShare * totalGMV) / 1000).toFixed(0)}K` },
                { label: "Total GMV", value: `$${(totalGMV / 1000).toFixed(0)}K` },
              ],
            },
            {
              title: "GMV/Active Publisher",
              value: `$${gmvPerActive.toFixed(0)}`,
              target: "$4,000",
              status: gmvPerActive >= 4000 ? "green" : gmvPerActive >= 3000 ? "yellow" : "red",
              evidenceRows: [
                { label: "Total GMV", value: `$${(totalGMV / 1000).toFixed(0)}K` },
                { label: "Active Publishers", value: activePubs.toString() },
              ],
            },
            {
              title: "Top10 GMV 占比",
              value: `${(top10Share * 100).toFixed(0)}%`,
              target: "≤50%",
              status: top10Share <= 0.5 ? "green" : top10Share <= 0.6 ? "yellow" : "red",
              evidenceRows: [
                { label: "Top10 GMV", value: `$${((top10Share * totalGMV) / 1000).toFixed(0)}K` },
                { label: "Total GMV", value: `$${(totalGMV / 1000).toFixed(0)}K` },
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

          const risks = [
            {
              title: "头部集中度过高",
              trigger: `Top10 Publisher 贡献 ${(top10Share * 100).toFixed(0)}% GMV${top10Share > 0.5 ? '，远超 50% 警戒线' : ''}，任一流失将造成显著收入波动`,
              action: "启动 Tier2 加速孵化计划，90 天内培养 5 个新 Core Driver",
              owner: "BD Lead",
              deadline: "Q2 2026",
              linkPage: "Concentration",
            },
            {
              title: "Deal/Coupon 结构过重",
              trigger: `Deal GMV 占比 ${(dealShare * 100).toFixed(0)}%${dealShare > 0.35 ? '，超出 35% 健康上限' : ''}，存在折扣依赖与利润侵蚀风险`,
              action: "提高 Content 类佣金率 2%，降低 Coupon 类佣金率 1%，激励结构迁移",
              owner: "Program Manager",
              deadline: "Q1 2026",
              linkPage: "MixHealth",
            },
            {
              title: "交易审批率偏低",
              trigger: `整体 Approval Rate ${(approvalRate * 100).toFixed(0)}%${approvalRate < 0.85 ? '，低于 85% 健康线' : ''}。Declined 集中在 ${topDeclined.map(p => p.publisher_name).join(', ')}`,
              action: "对高拒绝率 Publisher 启动治理审查流程",
              owner: "Compliance",
              deadline: "2026-03",
              linkPage: "Approval",
            },
          ];

          const opportunities = [
            {
              title: "Content 渠道扩张空间大",
              trigger: `Content GMV 仅 ${(contentShare * 100).toFixed(0)}%，但 Content Publisher 的 AOV 和 Approval Rate 均高于平均`,
              action: "招募 20 个垂直领域 Content Creator，配套专属落地页与佣金激励",
              owner: "Content Lead",
              deadline: "Q2 2026",
              linkPage: "Activation",
            },
            {
              title: "激活率提升空间",
              trigger: `当前活跃率 ${(activeRatio * 100).toFixed(0)}%，${totalPubs - activePubs} 个 Publisher 未产生收入`,
              action: "启动 Publisher 激活计划，提供培训和专属素材",
              owner: "BD Lead",
              deadline: "Q2 2026",
              linkPage: "Activation",
            },
            {
              title: "平均产出可提升",
              trigger: `GMV/Active Publisher 为 $${gmvPerActive.toFixed(0)}${gmvPerActive < 4000 ? '，低于目标' : ''}，存在提升空间`,
              action: "优化 Publisher 培育体系，提供更好的工具和激励",
              owner: "Product",
              deadline: "2026-04",
              linkPage: "Efficiency",
            },
          ];

          return (
            <>
              {/* KPI Cockpit */}
              <div>
                <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">核心 KPI</h2>
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
                    Top 3 风险
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
                    Top 3 机会
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
                <h3 className="text-sm font-semibold text-slate-700 mb-3">快速跳转</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {[
                    { label: "激活漏斗", page: "Activation" },
                    { label: "集中度分析", page: "Concentration" },
                    { label: "结构健康", page: "MixHealth" },
                    { label: "效率象限", page: "Efficiency" },
                    { label: "交易质量", page: "Approval" },
                    { label: "分层治理", page: "OperatingSystem" },
                    { label: "行动计划", page: "ActionPlan" },
                    { label: "数据接入", page: "Input" },
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