import React from "react";
import { CheckCircle2, Clock, AlertCircle, Loader2 } from "lucide-react";

export default function ProgressIndicator({ sectionId, sectionsReady = [], status, isProcessing }) {
  const isReady = sectionsReady.includes(sectionId);
  
  // Show loading if processing and not yet ready
  if (isProcessing && !isReady) {
    return <Loader2 className="w-3 h-3 text-blue-500 animate-spin" />;
  }
  
  // Show check if ready
  if (isReady) {
    return <CheckCircle2 className="w-3 h-3 text-green-500" />;
  }
  
  // Show error if status is error
  if (status === 'error') {
    return <AlertCircle className="w-3 h-3 text-red-500" />;
  }
  
  // Show waiting otherwise
  return <Clock className="w-3 h-3 text-slate-300" />;
}