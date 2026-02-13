import React, { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Database, ArrowRight, CheckCircle2, AlertCircle, Settings, FileText } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { dataClient } from "@/lib/dataClient";
import DatasetSelector from "@/components/dashboard/DatasetSelector";
import { listDatasetsForSelector } from "@/lib/supabasePipelineService";

const statusIcon = {
  mapped: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />,
  review: <AlertCircle className="w-3.5 h-3.5 text-amber-500" />,
  unmapped: <AlertCircle className="w-3.5 h-3.5 text-red-500" />,
};

const canonicalFields = new Set([
  "publisher_id",
  "publisher_name",
  "total_revenue",
  "total_commission",
  "clicks",
  "orders",
  "approved_revenue",
  "pending_revenue",
  "declined_revenue",
  "publisher_type",
  "aov",
  "cvr",
]);

export default function DataCenter() {
  const [datasetId, setDatasetId] = useState(null);

  const { data: datasets = [] } = useQuery({
    queryKey: ["datasets", "datacenter"],
    queryFn: listDatasetsForSelector,
    refetchInterval: 3000,
  });

  const activeDataset = useMemo(() => {
    if (!datasetId) return datasets[0] || null;
    return datasets.find((d) => d.id === datasetId) || null;
  }, [datasets, datasetId]);

  const mapping = activeDataset?.field_mapping || {};
  const fieldMappings = Object.entries(mapping).map(([source, target]) => ({
    source,
    target: target || "—",
    status: !target ? "unmapped" : canonicalFields.has(target) ? "mapped" : "review",
  }));

  const { data: jobs = [] } = useQuery({
    queryKey: ["jobs", activeDataset?.id],
    queryFn: () =>
      activeDataset?.id
        ? dataClient.entities.Job.filter({ dataset_id: activeDataset.id })
        : [],
    enabled: !!activeDataset?.id,
    refetchInterval: 3000,
  });

  const computeLogs = jobs
    .filter((j) => ["parse_csv", "compute_metrics", "ai_generate"].includes(j.job_type))
    .sort((a, b) => new Date(b.started_at || 0).getTime() - new Date(a.started_at || 0).getTime())
    .map((j) => ({
      version: activeDataset?.version_label || activeDataset?.file_name || "N/A",
      time: j.started_at ? new Date(j.started_at).toLocaleString() : "—",
      duration:
        j.started_at && j.completed_at
          ? `${((new Date(j.completed_at).getTime() - new Date(j.started_at).getTime()) / 1000).toFixed(1)}s`
          : "—",
      rows: activeDataset?.row_count || 0,
      status: j.status === "completed" ? "success" : j.status === "failed" ? "warning" : "running",
      notes: `${j.job_type} · ${j.status}`,
    }));

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">数据中心</h1>
          <p className="text-sm text-slate-500 mt-1">字段映射、分类规则与复算日志（按当前数据集）</p>
        </div>
        <DatasetSelector value={datasetId} onChange={setDatasetId} />
      </div>

      <Tabs defaultValue="fields" className="w-full">
        <TabsList className="bg-slate-100 rounded-lg p-0.5">
          <TabsTrigger value="fields" className="text-xs gap-1.5"><Database className="w-3.5 h-3.5" /> 字段映射</TabsTrigger>
          <TabsTrigger value="types" className="text-xs gap-1.5"><Settings className="w-3.5 h-3.5" /> 分类映射</TabsTrigger>
          <TabsTrigger value="logs" className="text-xs gap-1.5"><FileText className="w-3.5 h-3.5" /> 复算日志</TabsTrigger>
        </TabsList>

        <TabsContent value="fields" className="mt-4">
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <span className="text-sm font-semibold text-slate-700">字段映射编辑器</span>
              <div className="flex gap-2 text-[11px]">
                <Badge className="bg-emerald-50 text-emerald-700">已映射 {fieldMappings.filter((f) => f.status === "mapped").length}</Badge>
                <Badge className="bg-amber-50 text-amber-700">待确认 {fieldMappings.filter((f) => f.status === "review").length}</Badge>
                <Badge className="bg-red-50 text-red-700">未映射 {fieldMappings.filter((f) => f.status === "unmapped").length}</Badge>
              </div>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50/50">
                <tr>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold text-slate-500">源字段</th>
                  <th className="px-5 py-2.5 text-center text-xs font-semibold text-slate-500" />
                  <th className="px-5 py-2.5 text-left text-xs font-semibold text-slate-500">目标字段</th>
                  <th className="px-5 py-2.5 text-center text-xs font-semibold text-slate-500">状态</th>
                </tr>
              </thead>
              <tbody>
                {fieldMappings.length === 0 ? (
                  <tr><td colSpan={4} className="px-5 py-8 text-center text-xs text-slate-400">当前数据集暂无字段映射</td></tr>
                ) : fieldMappings.map((f, i) => (
                  <tr key={i} className="border-t border-slate-50 hover:bg-slate-50/50">
                    <td className="px-5 py-2.5 font-mono text-xs text-slate-700">{f.source}</td>
                    <td className="px-5 py-2.5 text-center"><ArrowRight className="w-3.5 h-3.5 text-slate-300 mx-auto" /></td>
                    <td className="px-5 py-2.5 font-mono text-xs text-slate-700">{f.target}</td>
                    <td className="px-5 py-2.5 text-center">{statusIcon[f.status]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="types" className="mt-4">
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
              <span className="text-sm font-semibold text-slate-700">分类映射规则</span>
            </div>
            <div className="p-5 text-xs text-slate-500">
              当前版本分类映射来源于 `field_mapping + publisher_type`，与上传数据集实时关联。
            </div>
          </div>
        </TabsContent>

        <TabsContent value="logs" className="mt-4">
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
              <span className="text-sm font-semibold text-slate-700">复算日志</span>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50/50">
                <tr>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold text-slate-500">版本</th>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold text-slate-500">时间</th>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold text-slate-500">耗时</th>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold text-slate-500">行数</th>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold text-slate-500">状态</th>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold text-slate-500">备注</th>
                </tr>
              </thead>
              <tbody>
                {computeLogs.length === 0 ? (
                  <tr><td colSpan={6} className="px-5 py-8 text-center text-xs text-slate-400">暂无复算日志</td></tr>
                ) : computeLogs.map((log, i) => (
                  <tr key={i} className="border-t border-slate-50 hover:bg-slate-50/50">
                    <td className="px-5 py-2.5 font-mono text-xs font-semibold text-slate-700">{log.version}</td>
                    <td className="px-5 py-2.5 text-xs text-slate-500">{log.time}</td>
                    <td className="px-5 py-2.5 text-xs text-slate-500">{log.duration}</td>
                    <td className="px-5 py-2.5 text-xs text-slate-700">{Number(log.rows || 0).toLocaleString()}</td>
                    <td className="px-5 py-2.5">
                      <Badge className={`text-[10px] ${log.status === "success" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                        {log.status === "success" ? "成功" : "处理中/告警"}
                      </Badge>
                    </td>
                    <td className="px-5 py-2.5 text-xs text-slate-500">{log.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

