import React, { useState } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "../utils";
import KPICard from "../components/dashboard/KPICard";
import RiskOpportunityCard from "../components/dashboard/RiskOpportunityCard";
import { Button } from "@/components/ui/button";
import { FileText, Sparkles, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

// Demo KPI data
const kpis = [
  {
    title: "Active Ratio",
    value: "32%",
    target: "40%",
    status: "yellow",
    trend: -3.2,
    trendLabel: "vs 上月",
    evidenceRows: [
      { label: "总 Publisher", value: "1,245" },
      { label: "活跃 Publisher", value: "398" },
      { label: "活跃定义", value: "total_revenue > 0" },
    ],
  },
  {
    title: "Content GMV 占比",
    value: "18%",
    target: "30%",
    status: "red",
    trend: 2.1,
    trendLabel: "vs 上月",
    evidenceRows: [
      { label: "Content GMV", value: "$245K" },
      { label: "Total GMV", value: "$1.36M" },
    ],
  },
  {
    title: "Deal GMV 占比",
    value: "52%",
    target: "≤35%",
    status: "red",
    trend: 1.8,
    trendLabel: "vs 上月",
    evidenceRows: [
      { label: "Deal/Coupon GMV", value: "$707K" },
      { label: "Total GMV", value: "$1.36M" },
    ],
  },
  {
    title: "GMV/Active Publisher",
    value: "$3,417",
    target: "$4,000",
    status: "yellow",
    trend: -5.0,
    trendLabel: "vs 上月",
    evidenceRows: [
      { label: "Total GMV", value: "$1.36M" },
      { label: "Active Publishers", value: "398" },
    ],
  },
  {
    title: "Top10 GMV 占比",
    value: "68%",
    target: "≤50%",
    status: "red",
    trend: 0.5,
    trendLabel: "vs 上月",
    evidenceRows: [
      { label: "Top10 GMV", value: "$924K" },
      { label: "Total GMV", value: "$1.36M" },
    ],
  },
  {
    title: "Non-promo GMV 占比",
    value: "41%",
    target: "≥50%",
    status: "yellow",
    trend: 3.2,
    trendLabel: "vs 上月",
    evidenceRows: [
      { label: "Non-promo GMV", value: "$557K" },
      { label: "Total GMV", value: "$1.36M" },
    ],
  },
];

const risks = [
  {
    title: "头部集中度过高",
    trigger: "Top10 Publisher 贡献 68% GMV，远超 50% 警戒线，任一流失将造成显著收入波动",
    action: "启动 Tier2 加速孵化计划，90 天内培养 5 个新 Core Driver",
    owner: "BD Lead",
    deadline: "Q2 2026",
    linkPage: "Concentration",
  },
  {
    title: "Deal/Coupon 结构过重",
    trigger: "Deal GMV 占比 52%，超出 35% 健康上限，存在折扣依赖与利润侵蚀风险",
    action: "提高 Content 类佣金率 2%，降低 Coupon 类佣金率 1%，激励结构迁移",
    owner: "Program Manager",
    deadline: "Q1 2026",
    linkPage: "MixHealth",
  },
  {
    title: "交易审批率偏低",
    trigger: "整体 Approval Rate 78%，Declined 金额集中在 3 个 Publisher",
    action: "对高拒绝率 Publisher 启动治理审查流程",
    owner: "Compliance",
    deadline: "2026-03",
    linkPage: "Approval",
  },
];

const opportunities = [
  {
    title: "Content 渠道扩张空间大",
    trigger: "Content GMV 仅 18%，但 Content Publisher 的 AOV 和 Approval Rate 均高于平均",
    action: "招募 20 个垂直领域 Content Creator，配套专属落地页与佣金激励",
    owner: "Content Lead",
    deadline: "Q2 2026",
    linkPage: "Activation",
  },
  {
    title: "社交视频渠道 0→1",
    trigger: "当前无 Social Video 类 Publisher，但竞品已有 15% GMV 来自短视频",
    action: "启动 TikTok/IG Affiliate 招募计划，首批 10 个达人",
    owner: "BD Lead",
    deadline: "Q2 2026",
    linkPage: "MixHealth",
  },
  {
    title: "落地页转化率可提升",
    trigger: "官网分析显示落地页缺少信任组件、评价模块，CVR 低于行业基准",
    action: "优化 Affiliate 专属落地页，添加评价与 FAQ，预计 CVR 提升 15%",
    owner: "Product",
    deadline: "2026-04",
    linkPage: "Efficiency",
  },
];

export default function Overview() {
  return (
    <div className="space-y-8 max-w-[1400px] mx-auto">
      {/* Page header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Affiliate Growth Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">一屏掌握渠道健康度与核心风险机会</p>
        </div>
        <div className="flex gap-2">
          <Link to={createPageUrl("ReportCenter")}>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <FileText className="w-3.5 h-3.5" />
              生成完整报告
            </Button>
          </Link>
          <Button size="sm" className="gap-1.5 text-xs bg-blue-600 hover:bg-blue-700">
            <Sparkles className="w-3.5 h-3.5" />
            Board 摘要版
          </Button>
        </div>
      </div>

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
    </div>
  );
}