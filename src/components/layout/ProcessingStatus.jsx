import React from "react";
import { Clock, CheckCircle2, AlertCircle } from "lucide-react";

export default function ProcessingStatus({ 
  status, 
  processingProgress, 
  processingStep,
  processingStartedAt,
  processingCompletedAt 
}) {
  if (status === 'completed' && processingStartedAt && processingCompletedAt) {
    const duration = Math.round((new Date(processingCompletedAt) - new Date(processingStartedAt)) / 1000);
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    
    return (
      <div className="flex items-center gap-2 text-xs text-green-600">
        <CheckCircle2 className="w-4 h-4" />
        <span>生成完成 • {minutes > 0 ? `${minutes}分${seconds}秒` : `${seconds}秒`}</span>
      </div>
    );
  }
  
  if (status === 'processing') {
    return (
      <div className="flex items-center gap-3 text-xs">
        <div className="flex items-center gap-2 text-blue-600">
          <Clock className="w-4 h-4 animate-pulse" />
          <span>{processingStep || '处理中...'}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-32 h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-500 transition-all duration-300"
              style={{ width: `${processingProgress || 0}%` }}
            />
          </div>
          <span className="text-slate-500">{processingProgress || 0}%</span>
        </div>
      </div>
    );
  }
  
  if (status === 'error') {
    return (
      <div className="flex items-center gap-2 text-xs text-red-600">
        <AlertCircle className="w-4 h-4" />
        <span>处理失败</span>
      </div>
    );
  }
  
  return null;
}