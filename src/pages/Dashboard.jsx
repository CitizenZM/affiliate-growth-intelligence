import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "../utils";
import KPICard from "../components/dashboard/KPICard";
import RiskOpportunityCard from "../components/dashboard/RiskOpportunityCard";
import InsightsPanel from "../components/dashboard/InsightsPanel";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Sparkles, Loader2, Database } from "lucide-react";
import { motion } from "framer-motion";

export default function Dashboard() {
  const [selectedDatasetId, setSelectedDatasetId] = useState(null);

  // Get all datasets
  const { data: datasets = [], isLoading: datasetsLoading } = useQuery({
    queryKey: ['datasets'],
    queryFn: () => base44.entities.DataUpload.list('-created_date', 50),
  });

  // Get metrics for selected dataset
  const { data: metrics = [], isLoading: metricsLoading } = useQuery({
    queryKey: ['metrics', selectedDatasetId],
    queryFn: () => base44.entities.MetricSnapshot.filter({ dataset_id: selectedDatasetId }),
    enabled: !!selectedDatasetId,
  });

  // Get report sections for risks/opportunities
  const { data: sections = [] } = useQuery({
    queryKey: ['sections', selectedDatasetId],
    queryFn: () => base44.entities.ReportSection.filter({ dataset_id: selectedDatasetId }),
    enabled: !!selectedDatasetId,
  });

  // Auto-select latest completed dataset
  React.useEffect(() => {
    if (datasets.length > 0 && !selectedDatasetId) {
      const latest = datasets.find(d => d.status === 'completed') || datasets[0];
      setSelectedDatasetId(latest.id);
    }
  }, [datasets, selectedDatasetId]);

  // Build KPIs from metrics
  const getMetric = (key) => metrics.find(m => m.metric_key === key)?.value_num || 0;

  const kpis = [
    {
      title: "Active Ratio",
      value: `${(getMetric('active_ratio') * 100).toFixed(1)}%`,
      target: "40%",
      status: getMetric('active_ratio') < 0.4 ? "yellow" : getMetric('active_ratio') >= 0.5 ? "green" : "yellow",
    },
    {
      title: "Top10 GMV 占比",
      value: `${(getMetric('top10_share') * 100).toFixed(0)}%`,
      target: "≤50%",
      status: getMetric('top10_share') > 0.7 ? "red" : getMetric('top10_share') > 0.5 ? "yellow" : "green",
    },
    {
      title: "Total GMV",
      value: `$${(getMetric('total_gmv') / 1000).toFixed(0)}K`,
      status: "green",
    },
    {
      title: "GMV/Active Publisher",
      value: `$${getMetric('gmv_per_active').toFixed(0)}`,
      target: "$4,000",
      status: getMetric('gmv_per_active') < 3500 ? "yellow" : "green",
    },
    {
      title: "Approval Rate",
      value: `${(getMetric('approval_rate') * 100).toFixed(0)}%`,
      target: "≥85%",
      status: getMetric('approval_rate') < 0.75 ? "red" : getMetric('approval_rate') < 0.85 ? "yellow" : "green",
    },
    {
      title: "50% GMV 所需",
      value: `${getMetric('publishers_to_50pct')}`,
      unit: " 个",
      status: getMetric('publishers_to_50pct') < 5 ? "red" : getMetric('publishers_to_50pct') < 10 ? "yellow" : "green",
    },
  ];

  // Extract risks and opportunities from sections
  const risks = sections
    .flatMap(s => (s.key_findings || []).filter(f => f.type === 'risk'))
    .slice(0, 3);

  const opportunities = sections
    .flatMap(s => (s.key_findings || []).filter(f => f.type === 'opportunity'))
    .slice(0, 3);

  if (datasetsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (datasets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Database className="w-16 h-16 text-slate-300" />
        <h2 className="text-xl font-semibold text-slate-700">暂无数据集</h2>
        <p className="text-sm text-slate-500">请先在数据接入页面上传 CSV 文件</p>
        <Link to={createPageUrl('Input')}>
          <Button className="bg-blue-600 hover:bg-blue-700">
            <Sparkles className="w-4 h-4 mr-2" />
            开始上传数据
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Affiliate Growth Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">一屏掌握渠道健康度与核心风险机会</p>
        </div>
        <div className="flex gap-2">
          <Select value={selectedDatasetId || ''} onValueChange={setSelectedDatasetId}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="选择数据集" />
            </SelectTrigger>
            <SelectContent>
              {datasets.map(d => (
                <SelectItem key={d.id} value={d.id}>
                  {d.version_label || d.file_name} ({d.status})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Link to={createPageUrl("ReportCenter")}>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <FileText className="w-3.5 h-3.5" />
              生成完整报告
            </Button>
          </Link>
        </div>
      </div>

      {metricsLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600 mr-2" />
          <span className="text-sm text-slate-500">加载指标数据...</span>
        </div>
      ) : (
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
          {(risks.length > 0 || opportunities.length > 0) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {risks.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold text-red-500/80 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500" />
                    主要风险
                  </h2>
                  <div className="space-y-3">
                    {risks.map((r, i) => (
                      <RiskOpportunityCard key={i} type="risk" {...r} />
                    ))}
                  </div>
                </div>
              )}

              {opportunities.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold text-blue-500/80 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    主要机会
                  </h2>
                  <div className="space-y-3">
                    {opportunities.map((o, i) => (
                      <RiskOpportunityCard key={i} type="opportunity" {...o} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

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
                </Link>
              ))}
            </div>
          </div>

          {/* Insights Panel */}
          <InsightsPanel
            insights={[
              "Dashboard汇总了联盟计划的6大核心健康度指标，通过颜色编码（绿色=健康，黄色=关注，红色=风险）快速识别问题区域",
              "Active Ratio显示有多少比例的Publisher在活跃产生GMV，低于40%说明存在大量沉睡渠道资源",
              "Top10 GMV占比衡量头部依赖度，超过50%意味着业务过度依赖少数几个大渠道，抗风险能力弱",
              "GMV/Active Publisher反映单渠道产出效率，是衡量渠道质量的关键指标"
            ]}
            problems={[
              "如果看到多个红色或黄色指标，说明联盟计划存在结构性问题，需要优先查看对应的详细分析页面",
              "主要风险和主要机会模块自动提取AI分析结果，点击可跳转到具体章节查看详细建议",
              "使用数据集下拉菜单可以对比不同时期的数据，追踪改进效果"
            ]}
          />
        </>
      )}
    </div>
  );
}