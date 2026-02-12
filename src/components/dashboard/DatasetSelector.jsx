import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

const statusColors = {
  completed: { bg: "bg-emerald-50", text: "text-emerald-700", label: "已完成" },
  processing: { bg: "bg-blue-50", text: "text-blue-700", label: "处理中" },
  error: { bg: "bg-red-50", text: "text-red-700", label: "失败" },
  pending: { bg: "bg-amber-50", text: "text-amber-700", label: "待处理" },
};

export default function DatasetSelector({ value, onChange }) {
  const { data: datasets = [], isLoading } = useQuery({
    queryKey: ['datasets'],
    queryFn: async () => {
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('数据加载超时（>10秒），请刷新页面')), 10000)
      );
      const dataPromise = base44.entities.DataUpload.list('-created_date', 50);
      return Promise.race([dataPromise, timeoutPromise]);
    },
    refetchInterval: 3000,
    retry: 1,
  });

  // Auto-select latest completed dataset
  React.useEffect(() => {
    if (datasets.length > 0) {
      const latest = datasets.find(d => d.status === 'completed');
      if (latest && latest.id !== value) {
        onChange?.(latest.id);
      } else if (!value && datasets[0]) {
        onChange?.(datasets[0].id);
      }
    }
  }, [datasets]);

  if (isLoading) return null;

  return (
    <Select value={value || ''} onValueChange={onChange}>
      <SelectTrigger className="w-[280px]">
        <SelectValue placeholder="选择数据集" />
      </SelectTrigger>
      <SelectContent>
        {datasets.map(d => {
          const status = statusColors[d.status] || statusColors.pending;
          return (
            <SelectItem key={d.id} value={d.id}>
              <div className="flex items-center gap-2 w-full">
                <span className="font-medium truncate">
                  {d.version_label || d.file_name}
                </span>
                <Badge className={`${status.bg} ${status.text} text-[9px] ml-auto`}>
                  {status.label}
                </Badge>
              </div>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}