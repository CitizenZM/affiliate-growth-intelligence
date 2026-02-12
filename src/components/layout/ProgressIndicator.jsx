import React from "react";
import { Circle } from "lucide-react";

export default function ProgressIndicator({ sectionId, sectionsReady = [], status, isProcessing }) {
  const isReady = sectionsReady.includes(sectionId);
  
  // Show green if ready
  if (isReady) {
    return <Circle className="w-3 h-3 fill-green-500 text-green-500" />;
  }
  
  // Show yellow if processing and not yet ready
  if (isProcessing && !isReady) {
    return <Circle className="w-3 h-3 fill-yellow-500 text-yellow-500 animate-pulse" />;
  }
  
  // Show gray otherwise
  return <Circle className="w-3 h-3 fill-slate-300 text-slate-300" />;
}