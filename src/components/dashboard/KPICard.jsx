import React, { useState } from "react";
import { TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const statusColors = {
  green: { bg: "bg-emerald-50", dot: "bg-emerald-500", text: "text-emerald-700", border: "border-emerald-200" },
  yellow: { bg: "bg-amber-50", dot: "bg-amber-500", text: "text-amber-700", border: "border-amber-200" },
  red: { bg: "bg-red-50", dot: "bg-red-500", text: "text-red-700", border: "border-red-200" },
};

export default function KPICard({ title, value, target, status = "green", trend, trendLabel, evidenceRows, unit = "" }) {
  const [showEvidence, setShowEvidence] = useState(false);
  const colors = statusColors[status];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl border border-slate-200/80 p-5 hover:shadow-md transition-shadow duration-300"
    >
      <div className="flex items-start justify-between mb-3">
        <p className="text-[13px] font-medium text-slate-500 tracking-tight">{title}</p>
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${colors.bg} ${colors.text} ${colors.border} border`}>
          <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
          {status === "green" ? "健康" : status === "yellow" ? "关注" : "风险"}
        </span>
      </div>

      <div className="flex items-end gap-2 mb-1">
        <span className="text-2xl font-bold text-slate-900 tracking-tight tabular-nums">{value}{unit}</span>
        {target && <span className="text-xs text-slate-400 mb-1">/ 目标 {target}{unit}</span>}
      </div>

      {trend !== undefined && (
        <div className="flex items-center gap-1 mt-1.5">
          {trend > 0 ? (
            <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
          ) : trend < 0 ? (
            <TrendingDown className="w-3.5 h-3.5 text-red-500" />
          ) : (
            <Minus className="w-3.5 h-3.5 text-slate-400" />
          )}
          <span className={`text-xs font-medium ${trend > 0 ? "text-emerald-600" : trend < 0 ? "text-red-600" : "text-slate-500"}`}>
            {trend > 0 ? "+" : ""}{trend}%
          </span>
          {trendLabel && <span className="text-[11px] text-slate-400 ml-1">{trendLabel}</span>}
        </div>
      )}

      {evidenceRows && (
        <>
          <button
            onClick={() => setShowEvidence(!showEvidence)}
            className="mt-3 text-[12px] text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
          >
            {showEvidence ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            查看证据
          </button>
          <AnimatePresence>
            {showEvidence && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-2 bg-slate-50 rounded-lg p-3 text-xs text-slate-600 space-y-1">
                  {evidenceRows.map((r, i) => (
                    <div key={i} className="flex justify-between">
                      <span>{r.label}</span>
                      <span className="font-medium text-slate-800">{r.value}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </motion.div>
  );
}