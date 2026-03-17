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
import { useLanguage } from "@/components/LanguageContext";
import { useTranslatedItems } from "@/components/dashboard/useTranslatedText";
import { getActiveDatasetId, setActiveDatasetId } from "@/lib/activeDataset";

export default function Dashboard() {
  const [selectedDatasetId, setSelectedDatasetId] = useState(null);
  const { t } = useLanguage();
  const db = t('overview');
  const isEn = t('nav.overview') === 'Overview';

  const { data: datasets = [], isLoading: datasetsLoading } = useQuery({
    queryKey: ['datasets'],
    queryFn: async () => {
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('数据加载超时（>10秒），请刷新页面')), 10000)
      );
      const dataPromise = base44.entities.DataUpload.list('-created_date', 50);
      return Promise.race([dataPromise, timeoutPromise]);
    },
    refetchInterval: (query) => {
      const data = query.state.data || [];
      return data.some((d) => d.status === 'processing') ? 3000 : false;
    },
    retry: 1,
  });

  const selectedDataset = datasets.find((d) => d.id === selectedDatasetId) || null;
  const selectedIsProcessing = !selectedDataset || selectedDataset.status === 'processing';

  const { data: metrics = [], isLoading: metricsLoading } = useQuery({
    queryKey: ['metrics', selectedDatasetId],
    queryFn: async () => {
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('指标数据加载超时（>10秒），请检查数据处理状态')), 10000)
      );
      const dataPromise = base44.entities.MetricSnapshot.filter({ dataset_id: selectedDatasetId });
      return Promise.race([dataPromise, timeoutPromise]);
    },
    enabled: !!selectedDatasetId,
    refetchInterval: selectedIsProcessing ? 3000 : false,
    retry: 1,
  });

  const { data: sections = [] } = useQuery({
    queryKey: ['sections', selectedDatasetId],
    queryFn: async () => {
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('报告数据加载超时（>10秒）')), 10000)
      );
      const dataPromise = base44.entities.ReportSection.filter({ dataset_id: selectedDatasetId });
      return Promise.race([dataPromise, timeoutPromise]);
    },
    enabled: !!selectedDatasetId,
    refetchInterval: selectedIsProcessing ? 3000 : false,
    retry: 1,
  });

  // Auto-select active dataset or latest dataset
  React.useEffect(() => {
    if (!datasets.length) return;
    const activeId = getActiveDatasetId();
    const activeDataset = datasets.find((dataset) => dataset.id === activeId);
    const fallback = activeDataset || datasets[0];
    if ((!selectedDatasetId || !datasets.some((dataset) => dataset.id === selectedDatasetId)) && fallback) {
      setSelectedDatasetId(fallback.id);
    }
  }, [datasets, selectedDatasetId]);

  const getMetric = (key) => metrics.find(m => m.metric_key === key)?.value_num || 0;
  const brandContext = selectedDataset?.website_scrape_data;
  const warnings = selectedDataset?.processing_warnings || [];
  const hasPartialData = warnings.length > 0;
  const capabilities = selectedDataset?.capabilities || {};
  const approvalAvailable = !!capabilities.has_approval_breakdown;
  const approvalWarning = warnings.find((warning) => warning.toLowerCase().includes('approval'));

  const kpis = [
    {
      title: db.kpis?.activeRatio || "Active Ratio",
      value: `${(getMetric('active_ratio') * 100).toFixed(1)}%`,
      target: "40%",
      status: getMetric('active_ratio') < 0.4 ? "yellow" : getMetric('active_ratio') >= 0.5 ? "green" : "yellow",
    },
    {
      title: db.kpis?.top10Share || (isEn ? "Top10 GMV Share" : "Top10 GMV 占比"),
      value: `${(getMetric('top10_share') * 100).toFixed(0)}%`,
      target: "≤50%",
      status: getMetric('top10_share') > 0.7 ? "red" : getMetric('top10_share') > 0.5 ? "yellow" : "green",
    },
    {
      title: db.kpis?.totalGmv || "Total GMV",
      value: `$${(getMetric('total_gmv') / 1000).toFixed(0)}K`,
      status: "green",
    },
    {
      title: db.kpis?.gmvPerActive || "GMV/Active Publisher",
      value: `$${getMetric('gmv_per_active').toFixed(0)}`,
      target: "$4,000",
      status: getMetric('gmv_per_active') < 3500 ? "yellow" : "green",
    },
    {
      title: db.kpis?.approvalRate || "Approval Rate",
      value: approvalAvailable ? `${(getMetric('approval_rate') * 100).toFixed(0)}%` : "--",
      target: "≥85%",
      status: approvalAvailable ? (getMetric('approval_rate') < 0.75 ? "red" : getMetric('approval_rate') < 0.85 ? "yellow" : "green") : "neutral",
      evidenceRows: approvalAvailable ? [
        { label: "Approval Rate", value: `${(getMetric('approval_rate') * 100).toFixed(1)}%` },
      ] : [
        { label: "Status", value: approvalWarning || "Approval split unavailable in this dataset" },
      ],
    },
    {
      title: db.kpis?.publishersTo50 || (isEn ? "Publishers for 50% GMV" : "50% GMV 所需"),
      value: `${getMetric('publishers_to_50pct')}`,
      unit: isEn ? "" : " 个",
      status: getMetric('publishers_to_50pct') < 5 ? "red" : getMetric('publishers_to_50pct') < 10 ? "yellow" : "green",
    },
  ];

  const seenRisk = new Set();
  const risks = sections
    .flatMap(s => (s.key_findings || []).filter(f => typeof f === 'object' && f.type === 'risk'))
    .filter(f => { const k = String(f.title || ""); if (seenRisk.has(k)) return false; seenRisk.add(k); return true; })
    .slice(0, 3);

  const seenOpp = new Set();
  const opportunities = sections
    .flatMap(s => (s.key_findings || []).filter(f => typeof f === 'object' && f.type === 'opportunity'))
    .filter(f => { const k = String(f.title || ""); if (seenOpp.has(k)) return false; seenOpp.add(k); return true; })
    .slice(0, 3);
  const translatedRisks = useTranslatedItems(risks, ["title", "trigger", "action", "owner", "deadline"]);
  const translatedOpportunities = useTranslatedItems(opportunities, ["title", "trigger", "action", "owner", "deadline"]);

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
        <h2 className="text-xl font-semibold text-slate-700">{db.emptyTitle || (isEn ? "No datasets" : "暂无数据集")}</h2>
        <p className="text-sm text-slate-500">{db.emptySubtitle || (isEn ? "Please upload a CSV file on the Input page" : "请先在数据接入页面上传 CSV 文件")}</p>
        <Link to={createPageUrl('Input')}>
          <Button className="bg-blue-600 hover:bg-blue-700">
            <Sparkles className="w-4 h-4 mr-2" />
            {db.uploadData || (isEn ? "Upload Data" : "开始上传数据")}
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
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{db.title}</h1>
          <p className="text-sm text-slate-500 mt-1">{db.subtitle}</p>
        </div>
      <div className="flex gap-2">
          {hasPartialData && (
            <div className="px-3 py-2 rounded-lg bg-amber-50 text-amber-700 text-xs border border-amber-200">
              {t('shared.partialDataset')}
            </div>
          )}
          <Select value={selectedDatasetId || ''} onValueChange={(nextValue) => {
            setActiveDatasetId(nextValue);
            setSelectedDatasetId(nextValue);
          }}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder={db.placeholders?.selectDataset || (isEn ? "Select Dataset" : "选择数据集")} />
            </SelectTrigger>
            <SelectContent>
              {datasets.map(d => (
                <SelectItem key={d.id} value={d.id}>
                  {d.version_label || d.file_name} ({db.placeholders?.status || (isEn ? "Status" : "状态")}: {d.status})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Link to={createPageUrl("ReportCenter")}>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <FileText className="w-3.5 h-3.5" />
              {db.generateReport || (isEn ? "Generate Full Report" : "生成完整报告")}
            </Button>
          </Link>
        </div>
      </div>

      {metricsLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600 mr-2" />
          <span className="text-sm text-slate-500">{db.loadingMetrics || (isEn ? "Loading metrics..." : "加载指标数据...")}</span>
        </div>
      ) : (
        <>
          {/* KPI Cockpit */}
          <div>
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">{db.coreKpis || (isEn ? "Core KPIs" : "核心 KPI")}</h2>
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
                    {db.top3Risks || (isEn ? "Top Risks" : "主要风险")}
                  </h2>
                  <div className="space-y-3">
                    {translatedRisks.map((r, i) => (
                      <RiskOpportunityCard key={i} type="risk" {...r} />
                    ))}
                  </div>
                </div>
              )}

              {opportunities.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold text-blue-500/80 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    {db.top3Opportunities || (isEn ? "Top Opportunities" : "主要机会")}
                  </h2>
                  <div className="space-y-3">
                    {translatedOpportunities.map((o, i) => (
                      <RiskOpportunityCard key={i} type="opportunity" {...o} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {brandContext && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <div className="flex items-center justify-between gap-4 mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-700">
                    {brandContext.brand_name ? `${brandContext.brand_name} Brand Context` : (db.brandContextTitle || "Brand Context")}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    {db.brandContextSubtitle || "Auto-enriched brand and site research"}
                    {selectedDataset?.website_url ? ` • ${selectedDataset.website_url}` : ""}
                  </p>
                </div>
                {brandContext.has_promotion && (
                  <span className="px-2 py-1 rounded-full bg-blue-50 text-blue-700 text-[11px] border border-blue-200">
                    {db.promotionDetected || "Promotion detected"}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-slate-400 text-xs uppercase tracking-wide mb-1">{db.brand || "Brand"}</p>
                  <p className="text-slate-700 font-medium">{brandContext.brand_name || 'Insta360'}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-xs uppercase tracking-wide mb-1">{db.productCategories || "Product Categories"}</p>
                  <p className="text-slate-700">{(brandContext.product_categories || []).join(' / ') || db.notAvailable || 'Not available'}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-xs uppercase tracking-wide mb-1">{db.keySellingPoints || "Key Selling Points"}</p>
                  <p className="text-slate-700">{(brandContext.key_selling_points || []).slice(0, 3).join(' / ') || db.notAvailable || 'Not available'}</p>
                </div>
              </div>
              {warnings.length > 0 && (
                <div className="mt-4 p-3 rounded-xl bg-amber-50 border border-amber-200">
                  <p className="text-xs font-semibold text-amber-800 mb-1">{db.datasetWarnings || "Dataset warnings"}</p>
                  <p className="text-xs text-amber-700">{warnings[0]}</p>
                </div>
              )}
            </div>
          )}

          {/* Quick links */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">{db.quickLinks || (isEn ? "Quick Links" : "快速跳转")}</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {[
                { label: db.quickLinkLabels?.activation || (isEn ? "Activation Funnel" : "激活漏斗"), page: "Activation" },
                { label: db.quickLinkLabels?.concentration || (isEn ? "Concentration" : "集中度分析"), page: "Concentration" },
                { label: db.quickLinkLabels?.mixHealth || (isEn ? "Mix Health" : "结构健康"), page: "MixHealth" },
                { label: db.quickLinkLabels?.efficiency || (isEn ? "Efficiency Quadrant" : "效率象限"), page: "Efficiency" },
                { label: db.quickLinkLabels?.approval || (isEn ? "Trade Quality" : "交易质量"), page: "Approval" },
                { label: db.quickLinkLabels?.operatingSystem || (isEn ? "Tier Management" : "分层治理"), page: "OperatingSystem" },
                { label: db.quickLinkLabels?.actionPlan || (isEn ? "Action Plan" : "行动计划"), page: "ActionPlan" },
                { label: db.quickLinkLabels?.input || (isEn ? "Data Input" : "数据接入"), page: "Input" },
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
            insights={isEn ? [
              "Dashboard summarizes 6 core health KPIs using color coding (green=healthy, yellow=watch, red=risk) for quick issue identification",
              "Active Ratio shows what % of publishers are generating GMV; below 40% indicates many dormant channel resources",
              "Top10 GMV Share measures top-heavy dependency; above 50% means over-reliance on a few key channels",
              "GMV/Active Publisher reflects per-channel output efficiency, a key indicator of channel quality"
            ] : [
              "Dashboard汇总了联盟计划的6大核心健康度指标，通过颜色编码（绿色=健康，黄色=关注，红色=风险）快速识别问题区域",
              "Active Ratio显示有多少比例的Publisher在活跃产生GMV，低于40%说明存在大量沉睡渠道资源",
              "Top10 GMV占比衡量头部依赖度，超过50%意味着业务过度依赖少数几个大渠道，抗风险能力弱",
              "GMV/Active Publisher反映单渠道产出效率，是衡量渠道质量的关键指标"
            ]}
            problems={isEn ? [
              "Multiple red/yellow KPIs indicate structural issues in the affiliate program; prioritize visiting the relevant detail pages",
              "Top Risks and Opportunities are auto-extracted from AI analysis; click to navigate to the specific chapter",
              "Use the dataset dropdown to compare data across time periods and track improvement"
            ] : [
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
