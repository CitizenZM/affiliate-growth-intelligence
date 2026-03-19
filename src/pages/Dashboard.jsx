import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "../utils";
import KPICard from "../components/dashboard/KPICard";
import RiskOpportunityCard from "../components/dashboard/RiskOpportunityCard";
import { motion } from "framer-motion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  FileText, Sparkles, Loader2, Database, ArrowRight,
  TrendingUp, ShieldAlert, Filter, BarChart3, PieChart,
  ScatterChart, ShieldCheck, Layers, ListChecks
} from "lucide-react";
import { useLanguage } from "@/components/LanguageContext";
import { useTranslatedItems } from "@/components/dashboard/useTranslatedText";
import { getActiveDatasetId, setActiveDatasetId } from "@/lib/activeDataset";

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } };
const fadeUp = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } };

export default function Dashboard() {
  const [selectedDatasetId, setSelectedDatasetId] = useState(null);
  const { t } = useLanguage();
  const db = t('overview');
  const isEn = t('nav.overview') === 'Overview';

  const { data: datasets = [], isLoading: datasetsLoading } = useQuery({
    queryKey: ['datasets'],
    queryFn: async () => {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), 10000)
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
        setTimeout(() => reject(new Error('Timeout')), 10000)
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
        setTimeout(() => reject(new Error('Timeout')), 10000)
      );
      const dataPromise = base44.entities.ReportSection.filter({ dataset_id: selectedDatasetId });
      return Promise.race([dataPromise, timeoutPromise]);
    },
    enabled: !!selectedDatasetId,
    refetchInterval: selectedIsProcessing ? 3000 : false,
    retry: 1,
  });

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
  const approvalWarning = warnings.find((w) => w.toLowerCase().includes('approval'));

  const kpis = [
    { title: db.kpis?.activeRatio || "Active Ratio", value: `${(getMetric('active_ratio') * 100).toFixed(1)}%`, target: "40%", status: getMetric('active_ratio') < 0.4 ? "yellow" : getMetric('active_ratio') >= 0.5 ? "green" : "yellow" },
    { title: db.kpis?.top10Share || (isEn ? "Top10 GMV Share" : "Top10 GMV 占比"), value: `${(getMetric('top10_share') * 100).toFixed(0)}%`, target: "≤50%", status: getMetric('top10_share') > 0.7 ? "red" : getMetric('top10_share') > 0.5 ? "yellow" : "green" },
    { title: db.kpis?.totalGmv || "Total GMV", value: `$${(getMetric('total_gmv') / 1000).toFixed(0)}K`, status: "green" },
    { title: db.kpis?.gmvPerActive || "GMV/Active", value: `$${getMetric('gmv_per_active').toFixed(0)}`, target: "$4,000", status: getMetric('gmv_per_active') < 3500 ? "yellow" : "green" },
    { title: db.kpis?.approvalRate || "Approval Rate", value: approvalAvailable ? `${(getMetric('approval_rate') * 100).toFixed(0)}%` : "--", target: "≥85%", status: approvalAvailable ? (getMetric('approval_rate') < 0.75 ? "red" : getMetric('approval_rate') < 0.85 ? "yellow" : "green") : "neutral", evidenceRows: approvalAvailable ? [{ label: "Approval Rate", value: `${(getMetric('approval_rate') * 100).toFixed(1)}%` }] : [{ label: "Status", value: approvalWarning || "Approval split unavailable" }] },
    { title: db.kpis?.publishersTo50 || (isEn ? "Publishers to 50%" : "50% GMV 所需"), value: `${getMetric('publishers_to_50pct')}`, unit: isEn ? "" : " 个", status: getMetric('publishers_to_50pct') < 5 ? "red" : getMetric('publishers_to_50pct') < 10 ? "yellow" : "green" },
  ];

  const seenRisk = new Set();
  const risks = sections.flatMap(s => (s.key_findings || []).filter(f => typeof f === 'object' && f.type === 'risk')).filter(f => { const k = String(f.title || ""); if (seenRisk.has(k)) return false; seenRisk.add(k); return true; }).slice(0, 3);
  const seenOpp = new Set();
  const opportunities = sections.flatMap(s => (s.key_findings || []).filter(f => typeof f === 'object' && f.type === 'opportunity')).filter(f => { const k = String(f.title || ""); if (seenOpp.has(k)) return false; seenOpp.add(k); return true; }).slice(0, 3);
  const translatedRisks = useTranslatedItems(risks, ["title", "trigger", "action", "owner", "deadline"]);
  const translatedOpportunities = useTranslatedItems(opportunities, ["title", "trigger", "action", "owner", "deadline"]);

  const quickLinks = [
    { label: isEn ? "Activation Funnel" : "激活漏斗", page: "Activation", icon: Filter, color: "text-violet-500 bg-violet-50" },
    { label: isEn ? "Concentration" : "集中度", page: "Concentration", icon: BarChart3, color: "text-orange-500 bg-orange-50" },
    { label: isEn ? "Mix Health" : "结构健康", page: "MixHealth", icon: PieChart, color: "text-cyan-500 bg-cyan-50" },
    { label: isEn ? "Efficiency" : "效率象限", page: "Efficiency", icon: ScatterChart, color: "text-emerald-500 bg-emerald-50" },
    { label: isEn ? "Approval" : "交易质量", page: "Approval", icon: ShieldCheck, color: "text-blue-500 bg-blue-50" },
    { label: isEn ? "Tier Mgmt" : "分层治理", page: "OperatingSystem", icon: Layers, color: "text-pink-500 bg-pink-50" },
    { label: isEn ? "Action Plan" : "行动计划", page: "ActionPlan", icon: ListChecks, color: "text-amber-500 bg-amber-50" },
    { label: isEn ? "Full Report" : "完整报告", page: "ReportCenter", icon: FileText, color: "text-indigo-500 bg-indigo-50" },
  ];

  if (datasetsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-blue-600" /></div>
          <p className="text-sm text-slate-400">{isEn ? "Loading..." : "加载中..."}</p>
        </div>
      </div>
    );
  }

  if (datasets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px]">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-5"><Database className="w-7 h-7 text-slate-300" /></div>
        <h2 className="text-lg font-semibold text-slate-800 mb-1">{db.emptyTitle || (isEn ? "No datasets yet" : "暂无数据集")}</h2>
        <p className="text-sm text-slate-400 mb-6 max-w-sm text-center">{db.emptySubtitle || (isEn ? "Upload a publisher performance CSV to get started" : "请先上传 CSV 文件")}</p>
        <Link to={createPageUrl('Input')} className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#0f1729] px-5 text-sm font-semibold text-white hover:bg-[#1a2d4f] transition">
          <Sparkles className="w-4 h-4" />{db.uploadData || (isEn ? "Upload Data" : "开始上传数据")}
        </Link>
      </div>
    );
  }

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6 max-w-[1440px] mx-auto">
      <motion.div variants={fadeUp} className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold text-slate-900 tracking-tight">{db.title || (isEn ? "Overview" : "总览")}</h1>
          <p className="text-[13px] text-slate-400 mt-0.5">{db.subtitle || (isEn ? "Program health at a glance" : "联盟计划健康度一览")}</p>
        </div>
        <div className="flex items-center gap-2">
          {hasPartialData && (
            <span className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-600 text-[11px] font-medium border border-amber-100">{t('shared.partialDataset')}</span>
          )}
          <Select value={selectedDatasetId || ''} onValueChange={(v) => { setActiveDatasetId(v); setSelectedDatasetId(v); }}>
            <SelectTrigger className="w-[200px] h-9 text-[12.5px] rounded-lg border-slate-200 bg-white">
              <SelectValue placeholder={isEn ? "Select dataset" : "选择数据集"} />
            </SelectTrigger>
            <SelectContent>
              {datasets.map(d => (
                <SelectItem key={d.id} value={d.id}>{d.version_label || d.file_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Link to={createPageUrl("ReportCenter")} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition">
            <FileText className="w-3.5 h-3.5" />{isEn ? "Full Report" : "完整报告"}
          </Link>
        </div>
      </motion.div>

      {metricsLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-5 h-5 animate-spin text-blue-500 mr-2" />
          <span className="text-sm text-slate-400">{isEn ? "Loading metrics..." : "加载指标..."}</span>
        </div>
      ) : (
        <>
          <motion.div variants={fadeUp}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{db.coreKpis || (isEn ? "Core KPIs" : "核心 KPI")}</h2>
              <span className="text-[11px] text-slate-300">{metrics.length} {isEn ? "metrics loaded" : "项指标"}</span>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
              {kpis.map((kpi, i) => <KPICard key={i} {...kpi} />)}
            </div>
          </motion.div>

          {(risks.length > 0 || opportunities.length > 0) && (
            <motion.div variants={fadeUp} className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {risks.length > 0 && (
                <div className="rounded-2xl border border-red-100 bg-gradient-to-b from-red-50/40 to-white p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <ShieldAlert className="w-4 h-4 text-red-500" />
                    <h2 className="text-[12px] font-bold text-red-600/80 uppercase tracking-widest">{db.top3Risks || (isEn ? "Top Risks" : "主要风险")}</h2>
                    <span className="ml-auto text-[11px] text-red-300 font-medium">{risks.length}</span>
                  </div>
                  <div className="space-y-2.5">
                    {translatedRisks.map((r, i) => <RiskOpportunityCard key={i} type="risk" {...r} />)}
                  </div>
                </div>
              )}
              {opportunities.length > 0 && (
                <div className="rounded-2xl border border-blue-100 bg-gradient-to-b from-blue-50/40 to-white p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp className="w-4 h-4 text-blue-500" />
                    <h2 className="text-[12px] font-bold text-blue-600/80 uppercase tracking-widest">{db.top3Opportunities || (isEn ? "Top Opportunities" : "主要机会")}</h2>
                    <span className="ml-auto text-[11px] text-blue-300 font-medium">{opportunities.length}</span>
                  </div>
                  <div className="space-y-2.5">
                    {translatedOpportunities.map((o, i) => <RiskOpportunityCard key={i} type="opportunity" {...o} />)}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {brandContext && (
            <motion.div variants={fadeUp} className="rounded-2xl border border-slate-200/60 bg-white overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-[13px] font-semibold text-slate-800">
                    {brandContext.brand_name ? `${brandContext.brand_name} Brand Context` : "Brand Context"}
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {isEn ? "Auto-enriched research" : "自动研究增强"}
                    {selectedDataset?.website_url ? ` · ${selectedDataset.website_url}` : ""}
                  </p>
                </div>
                {brandContext.has_promotion && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-semibold border border-emerald-100">
                    {isEn ? "Promo Active" : "促销中"}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-100">
                <div className="px-5 py-3.5">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider font-medium mb-1">{isEn ? "Brand" : "品牌"}</p>
                  <p className="text-[13px] text-slate-800 font-semibold">{brandContext.brand_name || '--'}</p>
                </div>
                <div className="px-5 py-3.5">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider font-medium mb-1">{isEn ? "Categories" : "品类"}</p>
                  <p className="text-[13px] text-slate-700">{(brandContext.product_categories || []).join(', ') || '--'}</p>
                </div>
                <div className="px-5 py-3.5">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider font-medium mb-1">{isEn ? "Positioning" : "定位"}</p>
                  <p className="text-[13px] text-slate-700 line-clamp-2">{brandContext.homepage_positioning || '--'}</p>
                </div>
              </div>
              {warnings.length > 0 && (
                <div className="px-5 py-3 bg-amber-50/50 border-t border-amber-100">
                  <p className="text-[11px] text-amber-600">{warnings[0]}</p>
                </div>
              )}
            </motion.div>
          )}

          <motion.div variants={fadeUp}>
            <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">{isEn ? "Quick Navigation" : "快速跳转"}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
              {quickLinks.map((link) => (
                <Link key={link.page} to={createPageUrl(link.page)} className="group flex flex-col items-center gap-2 rounded-xl border border-slate-100 bg-white p-3 hover:border-slate-200 hover:shadow-sm transition-all">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${link.color}`}>
                    <link.icon className="w-4 h-4" />
                  </div>
                  <span className="text-[11px] font-medium text-slate-600 text-center leading-tight group-hover:text-slate-900 transition">{link.label}</span>
                </Link>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </motion.div>
  );
}
