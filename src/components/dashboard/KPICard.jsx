import React from "react";
import { motion } from "framer-motion";
import { useLanguage } from "@/components/LanguageContext";

const statusConfig = {
  green: { bg: "bg-emerald-500", ring: "ring-emerald-100", label: "Healthy", labelZh: "健康", text: "text-emerald-700", surface: "bg-emerald-50" },
  yellow: { bg: "bg-amber-500", ring: "ring-amber-100", label: "Watch", labelZh: "关注", text: "text-amber-700", surface: "bg-amber-50" },
  red: { bg: "bg-red-500", ring: "ring-red-100", label: "Risk", labelZh: "风险", text: "text-red-700", surface: "bg-red-50" },
  neutral: { bg: "bg-slate-400", ring: "ring-slate-100", label: "Partial", labelZh: "部分", text: "text-slate-600", surface: "bg-slate-50" },
};

export default function KPICard({ title, value, target, status = "green", unit = "" }) {
  const { language } = useLanguage();
  const isEn = language === 'en';
  const cfg = statusConfig[status] || statusConfig.green;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl border border-slate-100 p-4 hover:shadow-md hover:border-slate-200 transition-all duration-200 group"
    >
      <div className="flex items-center justify-between mb-2.5">
        <p className="text-[11px] font-medium text-slate-400 leading-tight truncate">{title}</p>
        <span className={`w-2 h-2 rounded-full ${cfg.bg} ring-2 ${cfg.ring} flex-shrink-0`} />
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-[22px] font-bold text-slate-900 tracking-tight tabular-nums leading-none">{value}{unit}</span>
      </div>
      <div className="flex items-center justify-between mt-2">
        {target && <span className="text-[10px] text-slate-300 font-medium">{isEn ? "Target" : "目标"} {target}</span>}
        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${cfg.surface} ${cfg.text}`}>
          {isEn ? cfg.label : cfg.labelZh}
        </span>
      </div>
    </motion.div>
  );
}
