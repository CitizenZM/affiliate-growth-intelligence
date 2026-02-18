import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "../../utils";
import { AlertTriangle, Sparkles, ArrowRight, User } from "lucide-react";
import { motion } from "framer-motion";
import { useLanguage } from "@/components/LanguageContext";

export default function RiskOpportunityCard({ type = "risk", title, trigger, action, owner, deadline, linkPage }) {
  const isRisk = type === "risk";
  const { t } = useLanguage();
  const isEn = t('nav.overview') === 'Overview';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border p-4 transition-all duration-200 hover:shadow-md
        ${isRisk ? "border-red-100 bg-white" : "border-blue-100 bg-white"}`}
    >
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 p-1.5 rounded-lg flex-shrink-0 ${isRisk ? "bg-red-50" : "bg-blue-50"}`}>
          {isRisk
            ? <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
            : <Sparkles className="w-3.5 h-3.5 text-blue-500" />
          }
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <h4 className="text-sm font-semibold text-slate-800 leading-snug">{title}</h4>
            {linkPage && (
              <Link to={createPageUrl(linkPage)} className={`flex-shrink-0 ${isRisk ? "text-red-400 hover:text-red-600" : "text-blue-400 hover:text-blue-600"} transition-colors`}>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>

          <p className="text-[11px] text-slate-400 mb-2.5 line-clamp-2 leading-relaxed">{trigger}</p>

          <div className={`rounded-lg px-3 py-2 mb-3 ${isRisk ? "bg-red-50/60 border border-red-100" : "bg-blue-50/60 border border-blue-100"}`}>
            <p className="text-[11px] font-medium text-slate-700 leading-relaxed">{action}</p>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <User className="w-3 h-3" />
            <span className="font-medium text-slate-600">{owner}</span>
            {deadline && (
              <>
                <span className="text-slate-300">·</span>
                <span>{deadline}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}