import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/components/LanguageContext";
import { getActiveDatasetId, setActiveDatasetId } from "@/lib/activeDataset";

export default function DatasetSelector({ value, onChange }) {
  const { t } = useLanguage();
  const ds = t('datasetSelector');

  const getStatusDisplay = (dataset) => {
    if (!dataset) return { bg: "bg-slate-50", text: "text-slate-700", label: ds.unknown };
    if (dataset.status === 'completed' && (dataset.processing_warnings || []).length > 0) {
      return { bg: "bg-amber-50", text: "text-amber-700", label: 'Partial' };
    }
    if (dataset.status === 'completed') return { bg: "bg-emerald-50", text: "text-emerald-700", label: ds.completed };
    if (dataset.status === 'error') return { bg: "bg-red-50", text: "text-red-700", label: ds.failed };
    if (dataset.status === 'pending') return { bg: "bg-amber-50", text: "text-amber-700", label: ds.pending };
    if (dataset.status === 'processing') {
      const progress = dataset.processing_progress || 0;
      return { bg: "bg-blue-50", text: "text-blue-700", label: `${Math.round(progress)}%` };
    }
    return { bg: "bg-slate-50", text: "text-slate-700", label: ds.unknown };
  };

  const { data: datasets = [], isLoading } = useQuery({
    queryKey: ['datasets'],
    queryFn: async () => {
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 10000)
      );
      const dataPromise = base44.entities.DataUpload.list('-created_date', 50);
      return Promise.race([dataPromise, timeoutPromise]);
    },
    refetchInterval: (query) => {
      const currentDatasets = query.state.data || [];
      return currentDatasets.some((dataset) => dataset.status === "processing") ? 2000 : 10000;
    },
    retry: 1,
  });

  // Auto-select active dataset or latest dataset
  React.useEffect(() => {
    if (!datasets.length) return;
    const activeId = getActiveDatasetId();
    const activeDataset = datasets.find((dataset) => dataset.id === activeId);
    const fallback = activeDataset || datasets[0];
    if ((!value || !datasets.some((dataset) => dataset.id === value)) && fallback) {
      onChange?.(fallback.id);
    }
  }, [datasets, value, onChange]);

  if (isLoading) return null;

  return (
    <Select
      value={value || ''}
      onValueChange={(nextValue) => {
        setActiveDatasetId(nextValue);
        onChange?.(nextValue);
      }}
    >
      <SelectTrigger className="w-[280px]">
              <SelectValue placeholder={ds.placeholder} />
      </SelectTrigger>
      <SelectContent>
        {datasets.map(d => {
          const status = getStatusDisplay(d);
          return (
            <SelectItem key={d.id} value={d.id}>
              <div className="flex items-center gap-2 w-full">
                <span className="font-medium truncate text-xs">
                  {d.version_label || d.file_name}
                </span>
                <Badge className={`${status.bg} ${status.text} text-[9px] ml-auto whitespace-nowrap`}>
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
