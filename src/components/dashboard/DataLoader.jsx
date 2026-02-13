import React, { useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Loader2, AlertCircle } from "lucide-react";
import { syncAnalysisSnapshot } from "@/lib/supabasePipelineService";

export default function DataLoader({ 
  datasetId, 
  children, 
  emptyMessage = "暂无数据",
  loadingMessage = "加载中..."
}) {
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
    refetchInterval: 3000,
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
    refetchInterval: 3000,
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
    refetchInterval: 3000,
    retry: 1,
  });

  const isLoading = metricsLoading || tablesLoading || sectionsLoading;

  useEffect(() => {
    if (!datasetId || metrics.length === 0) return;
    syncAnalysisSnapshot(datasetId, metrics, evidenceTables, sections).catch(() => {});
  }, [datasetId, metrics, evidenceTables, sections]);

  if (!datasetId) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertCircle className="w-12 h-12 text-slate-300 mb-3" />
        <p className="text-sm text-slate-500">{emptyMessage}</p>
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

  if (datasetId && !isLoading && metrics.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertCircle className="w-12 h-12 text-amber-300 mb-3" />
        <p className="text-sm text-slate-700">当前数据集暂无可用计算结果</p>
        <p className="text-xs text-slate-500 mt-1">请在 Input 页重新上传并等待处理完成（status = completed）</p>
      </div>
    );
  }

  const pickLatest = (records) => {
    if (!records || records.length === 0) return null;
    return [...records].sort((a, b) => {
      const aTime = new Date(a.updated_date || a.created_date || 0).getTime();
      const bTime = new Date(b.updated_date || b.created_date || 0).getTime();
      return bTime - aTime;
    })[0];
  };

  // Helper functions passed to children
  const getMetric = (key) => pickLatest(metrics.filter(m => m.metric_key === key))?.value_num || 0;
  const getTable = (key) => pickLatest(evidenceTables.filter(t => t.table_key === key))?.data_json || [];
  const getSection = (id) => pickLatest(sections.filter(s => s.section_id === id));

  return children({ 
    metrics, 
    evidenceTables, 
    sections, 
    getMetric, 
    getTable, 
    getSection 
  });
}
