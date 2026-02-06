import React from "react";
import { Info } from "lucide-react";

export default function ConclusionBar({ text, status = "neutral" }) {
  const statusStyles = {
    good: "bg-emerald-50 border-emerald-200 text-emerald-800",
    warning: "bg-amber-50 border-amber-200 text-amber-800",
    bad: "bg-red-50 border-red-200 text-red-800",
    neutral: "bg-blue-50 border-blue-200 text-blue-800",
  };

  return (
    <div className={`rounded-xl border px-4 py-3 flex items-center gap-2.5 ${statusStyles[status]}`}>
      <Info className="w-4 h-4 flex-shrink-0 opacity-60" />
      <p className="text-sm font-medium leading-relaxed">{text}</p>
    </div>
  );
}