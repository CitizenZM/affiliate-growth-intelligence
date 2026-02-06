import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, Clock, CheckCircle2, AlertCircle, Loader2, Download } from "lucide-react";
import { motion } from "framer-motion";

const statusConfig = {
  completed: { icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50", label: "已完成" },
  processing: { icon: Loader2, color: "text-blue-600", bg: "bg-blue-50", label: "处理中", spin: true },
  error: { icon: AlertCircle, color: "text-red-600", bg: "bg-red-50", label: "失败" },
  pending: { icon: Clock, color: "text-amber-600", bg: "bg-amber-50", label: "待处理" },
};

export default function HistoryPanel({ onReuse }) {
  const { data: history = [], isLoading } = useQuery({
    queryKey: ['upload-history'],
    queryFn: () => base44.entities.DataUpload.list('-created_date', 20),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="text-center py-8">
        <FileText className="w-12 h-12 text-slate-300 mx-auto mb-2" />
        <p className="text-sm text-slate-500">暂无历史记录</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[500px]">
      <div className="space-y-2 pr-4">
        {history.map((item, idx) => {
          const status = statusConfig[item.status] || statusConfig.pending;
          const Icon = status.icon;
          
          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="p-4 bg-white rounded-xl border border-slate-200 hover:border-blue-300 transition-colors group"
            >
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-lg ${status.bg} flex items-center justify-center flex-shrink-0`}>
                  <Icon className={`w-4 h-4 ${status.color} ${status.spin ? 'animate-spin' : ''}`} />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-medium text-slate-700 truncate">
                      {item.version_label || item.file_name}
                    </p>
                    <Badge className={`${status.bg} ${status.color} text-[10px]`}>
                      {status.label}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    <span>{item.file_name}</span>
                    {item.row_count && <span>• {item.row_count} 行</span>}
                    <span>• {new Date(item.created_date).toLocaleDateString()}</span>
                  </div>
                  
                  {item.platform && (
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline" className="text-[10px]">{item.platform}</Badge>
                      {item.commission_model && (
                        <Badge variant="outline" className="text-[10px]">{item.commission_model}</Badge>
                      )}
                      {item.market && (
                        <Badge variant="outline" className="text-[10px]">{item.market}</Badge>
                      )}
                    </div>
                  )}
                </div>
                
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={() => onReuse(item)}
                  >
                    <Download className="w-3 h-3 mr-1" />
                    复用配置
                  </Button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </ScrollArea>
  );
}