import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Loader2, AlertCircle } from "lucide-react";

export default function DataLoader({ 
  datasetId, 
  children, 
  emptyMessage = "暂无数据",
  loadingMessage = "加载中..."
}) {
  const { data: dataset = null, isLoading: datasetLoading } = useQuery({
    queryKey: ['dataset', datasetId],
    queryFn: async () => {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('数据加载超时（>10秒），请检查数据处理状态或刷新页面')), 10000)
      );
      const dataPromise = base44.entities.DataUpload.get(datasetId);
      return Promise.race([dataPromise, timeoutPromise]);
    },
    enabled: !!datasetId,
    refetchInterval: (query) => {
      const ds = query.state.data;
      return !ds || ds.status === 'processing' ? 2000 : false;
    },
    retry: 1,
  });

  const isProcessing = !dataset || dataset.status === 'processing';
  const pollInterval = isProcessing ? 3000 : false;

  const { data: metrics = [], isLoading: metricsLoading, error: metricsError } = useQuery({
    queryKey: ['metrics', datasetId],
    queryFn: async () => {
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('数据加载超时（>10秒），请检查数据处理状态或刷新页面')), 10000)
      );
      const dataPromise = base44.entities.MetricSnapshot.filter({ dataset_id: datasetId });
      return Promise.race([dataPromise, timeoutPromise]);
    },
    enabled: !!datasetId,
    refetchInterval: pollInterval,
    retry: 1,
  });

  const { data: evidenceTables = [], isLoading: tablesLoading } = useQuery({
    queryKey: ['evidence', datasetId],
    queryFn: async () => {
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('数据加载超时（>10秒），请检查数据处理状态或刷新页面')), 10000)
      );
      const dataPromise = base44.entities.EvidenceTable.filter({ dataset_id: datasetId });
      return Promise.race([dataPromise, timeoutPromise]);
    },
    enabled: !!datasetId,
    refetchInterval: pollInterval,
    retry: 1,
  });

  const { data: sections = [], isLoading: sectionsLoading } = useQuery({
    queryKey: ['sections', datasetId],
    queryFn: async () => {
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('数据加载超时（>10秒），请检查数据处理状态或刷新页面')), 10000)
      );
      const dataPromise = base44.entities.ReportSection.filter({ dataset_id: datasetId });
      return Promise.race([dataPromise, timeoutPromise]);
    },
    enabled: !!datasetId,
    refetchInterval: pollInterval,
    retry: 1,
  });

  const { data: allPublishers = [], isLoading: publishersLoading } = useQuery({
    queryKey: ['publishers', datasetId],
    queryFn: async () => {
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('数据加载超时（>10秒），请检查数据处理状态或刷新页面')), 10000)
      );
      const dataPromise = base44.entities.Publisher.filter({ dataset_id: datasetId });
      return Promise.race([dataPromise, timeoutPromise]);
    },
    enabled: !!datasetId,
    refetchInterval: pollInterval,
    retry: 1,
  });

  const isLoading = metricsLoading || tablesLoading || sectionsLoading || publishersLoading || datasetLoading;

  if (!datasetId) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertCircle className="w-12 h-12 text-slate-300 mb-3" />
        <p className="text-sm text-slate-500">{emptyMessage}</p>
      </div>
    );
  }

  if (dataset?.status === "processing") {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <p className="text-sm font-medium text-slate-700">{dataset.processing_step || "处理中..."}</p>
        <div className="w-full max-w-md h-2 bg-slate-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-600 transition-all duration-500"
            style={{ width: `${dataset.processing_progress || 0}%` }}
          />
        </div>
        <p className="text-xs text-slate-500">{dataset.processing_progress || 0}%</p>
      </div>
    );
  }

  if (dataset?.status === "error") {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertCircle className="w-12 h-12 text-red-300 mb-3" />
        <p className="text-sm font-medium text-red-600">数据处理失败</p>
        <p className="text-xs text-slate-500 mt-1">{dataset.processing_step || "请返回上传页重新提交，或检查字段映射。"}</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-3" />
        <p className="text-sm text-slate-500">{loadingMessage}</p>
      </div>
    );
  }

  if (metricsError) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertCircle className="w-12 h-12 text-red-300 mb-3" />
        <p className="text-sm text-red-600">加载失败: {metricsError.message}</p>
      </div>
    );
  }

  // Helper functions passed to children
  const getMetric = (key) => metrics.find(m => m.metric_key === key)?.value_num || 0;
  const getTable = (key) => evidenceTables.find(t => t.table_key === key)?.data_json || [];
  const getSection = (id) => sections.find(s => s.section_id === id);
  const capabilities = dataset?.capabilities || {};
  const warnings = dataset?.processing_warnings || [];
  const getEvidenceMeta = (key) => evidenceTables.find(t => t.table_key === key) || null;
  const isModuleAvailable = (module) => {
    if (module === 'approval') return !!capabilities.has_approval_breakdown;
    if (module === 'mix') return !!capabilities.has_publisher_type;
    if (module === 'commission') return !!capabilities.has_commission;
    return true;
  };

  return children({ 
    dataset,
    metrics, 
    evidenceTables, 
    sections, 
    allPublishers,
    getMetric, 
    getTable, 
    getSection,
    getEvidenceMeta,
    capabilities,
    warnings,
    isModuleAvailable,
  });
}
